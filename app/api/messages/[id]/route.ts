// app/api/messages/[id]/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

function calcAge(dobStr?: string | null): number | null {
  if (!dobStr) return null;
  const dob = new Date(dobStr);
  if (isNaN(dob.getTime())) return null;
  const today = new Date();
  let age = today.getFullYear() - dob.getFullYear();
  const m = today.getMonth() - dob.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < dob.getDate())) age--;
  return age;
}

// Helper to extract conversation id robustly (Next 16 may pass params as a Promise)
async function getConversationId(
  req: Request,
  paramsOrPromise: { id?: string } | Promise<{ id?: string }>
) {
  const url = new URL(req.url);
  const tail = url.pathname.split("/").pop();

  let pid: string | null = null;
  try {
    const ctx = (paramsOrPromise as any)?.then
      ? await (paramsOrPromise as Promise<{ id?: string }>)
      : (paramsOrPromise as { id?: string });
    const cid = ctx?.id;
    pid = cid && cid !== "undefined" ? String(cid) : null;
  } catch {
    // ignore; fall back to tail
  }

  const t = tail && tail !== "undefined" ? tail : null;
  return pid || t || null;
}

// GET /api/messages/:id -> list messages in a convo (paginated) + upsert delivered receipts for viewer
export async function GET(
  req: Request,
  { params }: { params: { id: string } }
) {
  const conversationId = await getConversationId(req, params);
  if (!conversationId) {
    return NextResponse.json(
      { error: "conversation_id is required (api)" },
      { status: 400 }
    );
  }

  const supabase = await createClient();
  const {
    data: { user },
    error: userErr,
  } = await supabase.auth.getUser();
  if (userErr || !user) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }

  const url = new URL(req.url);
  const limitParam = parseInt(url.searchParams.get("limit") ?? "", 10);
  const limit =
    Number.isFinite(limitParam) && limitParam > 0
      ? Math.min(limitParam, 100)
      : 30;
  const beforeParam = url.searchParams.get("before");
  const beforeIso =
    beforeParam && !isNaN(new Date(beforeParam).getTime())
      ? new Date(beforeParam).toISOString()
      : null;

  // 1) Fetch messages + sender profiles (paginated, newest first then reversed)
  let baseQuery = supabase
    .from("messages")
    .select(
      `
      id,
      body,
      created_at,
      sender_id,
      reply_to_id,
      reply_to_body,
      reply_to_sender_id,
      profiles:profiles!messages_sender_id_profiles_fkey(profile_title, avatar_url, date_of_birth)
    `
    )
    .eq("conversation_id", conversationId);

  if (beforeIso) {
    baseQuery = baseQuery.lt("created_at", beforeIso);
  }

  const { data: messages, error: msgErr } = await baseQuery
    .order("created_at", { ascending: false })
    .limit(limit + 1);

  if (msgErr) {
    return NextResponse.json({ error: msgErr.message }, { status: 500 });
  }

  const hasMore = (messages ?? []).length > limit;
  const paged = hasMore ? (messages ?? []).slice(0, limit) : messages ?? [];
  const list = [...paged].reverse();

  const listWithAge = list.map((m: any) => {
    const dob = m?.profiles?.date_of_birth ?? null;
    if (m?.profiles) {
      const { date_of_birth, ...rest } = m.profiles;
      return { ...m, profiles: { ...rest, age: calcAge(dob) } };
    }
    return m;
  });

  // Determine 1:1 other participant (if any)
  const { data: members } = await supabase
    .from("conversation_members")
    .select("user_id")
    .eq("conversation_id", conversationId);

  const memberIds = (members ?? []).map((m) => m.user_id);
  const others = memberIds.filter((id) => id !== user.id);
  const otherUserId = others.length === 1 ? others[0] : null;

  // Fetch the other participant (with labels) and compute age + nickname
  let otherMeta: {
    profile_title: string | null;
    display_name?: string | null;
    avatar_url: string | null;
    age: number | null;
    sexuality: { label: string } | null;
    position: { label: string } | null;
    presence?: string | null;
    user_id?: string | null;
  } | null = null;

  if (otherUserId) {
    const { data: other } = await supabase
      .from("profiles")
      .select(
        `
        profile_title,
        avatar_url,
        date_of_birth,
        nickname,
        sexuality:sexualities!profiles_sexuality_id_fkey(label),
        position:positions!profiles_position_id_fkey(label)
      `
      )
      .eq("id", otherUserId)
      .maybeSingle();

    if (other) {
      const age = calcAge((other as any).date_of_birth ?? null);
      const { data: presenceRow } = await supabase
        .from("user_presence")
        .select("status")
        .eq("user_id", otherUserId)
        .maybeSingle();
      otherMeta = {
        profile_title: (other as any).profile_title ?? null,
        display_name: (other as any).nickname ?? null,
        avatar_url: (other as any).avatar_url ?? null,
        age: age ?? null,
        sexuality: (other as any).sexuality?.label
          ? { label: (other as any).sexuality.label }
          : null,
        position: (other as any).position?.label
          ? { label: (other as any).position.label }
          : null,
        presence: presenceRow?.status ?? null,
        user_id: otherUserId,
      };
    }
  }

  // Attach the other participant's meta (age/sexuality/position) onto each message's profiles
  const listWithMeta = listWithAge.map((m: any) => {
    const base = m?.profiles ?? {};
    return {
      ...m,
      profiles: otherMeta
        ? {
            ...base,
            profile_title:
              otherMeta.profile_title ?? base.profile_title ?? null,
            avatar_url: otherMeta.avatar_url ?? base.avatar_url ?? null,
            age: otherMeta.age ?? base.age ?? null,
            sexuality: otherMeta.sexuality ?? base.sexuality ?? null,
            position: otherMeta.position ?? base.position ?? null,
          }
        : base,
    };
  });

  // 2) Upsert delivered receipts for all messages from others (idempotent)
  if (listWithMeta.length) {
    const toDeliver = listWithMeta
      .filter((m) => m.sender_id !== user.id)
      .map((m) => ({
        message_id: m.id,
        user_id: user.id,
        delivered_at: new Date().toISOString(),
      }));
    if (toDeliver.length) {
      const { error: deliverErr } = await supabase
        .from("message_receipts")
        .upsert(toDeliver, { onConflict: "message_id,user_id" });
      if (deliverErr) {
        // Non-fatal: continue returning messages even if receipts fail
        console.warn("deliver upsert error", deliverErr);
      }
    }
  }

  // 3) Fetch current user's receipts for these messages and merge into payload
  let receiptsById: Record<
    string,
    { delivered_at: string | null; read_at: string | null }
  > = {};
  if (listWithMeta.length) {
    const ids = listWithMeta.map((m: any) => m.id);
    const { data: receipts, error: recErr } = await supabase
      .from("message_receipts")
      .select("message_id, delivered_at, read_at")
      .in("message_id", ids)
      .eq("user_id", user.id);
    if (!recErr && receipts) {
      for (const r of receipts) {
        receiptsById[r.message_id] = {
          delivered_at: r.delivered_at ?? null,
          read_at: r.read_at ?? null,
        };
      }
    }
  }

  // For 1:1: fetch the recipient's receipts to reflect their read/delivery on the sender's messages
  let otherReceiptsById: Record<
    string,
    { delivered_at: string | null; read_at: string | null }
  > = {};
  if (otherUserId && listWithMeta.length) {
    const ids = listWithMeta.map((m: any) => m.id);
    const { data: otherReceipts } = await supabase
      .from("message_receipts")
      .select("message_id, delivered_at, read_at")
      .in("message_id", ids)
      .eq("user_id", otherUserId);

    if (otherReceipts) {
      for (const r of otherReceipts) {
        otherReceiptsById[r.message_id] = {
          delivered_at: r.delivered_at ?? null,
          read_at: r.read_at ?? null,
        };
      }
    }
  }

  const enriched = listWithMeta.map((m: any) => {
    const mine = m.sender_id === user.id;
    if (mine && otherUserId) {
      return {
        ...m,
        delivered_at: otherReceiptsById[m.id]?.delivered_at ?? null,
        read_at: otherReceiptsById[m.id]?.read_at ?? null,
      };
    }
    return {
      ...m,
      delivered_at: receiptsById[m.id]?.delivered_at ?? null,
      read_at: receiptsById[m.id]?.read_at ?? null,
    };
  });

  // 4) Reactions: gather per-message counts + caller's reaction
  let enrichedWithReactions = enriched;
  if (enriched.length) {
    const ids = enriched.map((m: any) => m.id);
    const { data: reactions } = await supabase
      .from("message_reactions")
      .select("message_id, user_id, type")
      .in("message_id", ids);

    const countsByMsg: Record<string, Record<string, number>> = {};
    const myReactionByMsg: Record<string, string> = {};

    reactions?.forEach((r) => {
      const mid = (r as any).message_id;
      const type = (r as any).type;
      const uid = (r as any).user_id;
      if (!mid || !type) return;
      if (!countsByMsg[mid]) countsByMsg[mid] = {};
      countsByMsg[mid][type] = (countsByMsg[mid][type] || 0) + 1;
      if (uid === user.id) {
        myReactionByMsg[mid] = type;
      }
    });

    enrichedWithReactions = enriched.map((m) => ({
      ...m,
      my_reaction: myReactionByMsg[m.id] ?? null,
      reaction_counts: countsByMsg[m.id] ?? {},
    }));
  }

  return NextResponse.json(
    { messages: enrichedWithReactions, other: otherMeta ?? null, hasMore },
    { status: 200 }
  );
}

// POST /api/messages/:id -> send message and create sender self-receipt (delivered+read)
export async function POST(
  req: Request,
  { params }: { params: { id: string } }
) {
  const conversationId = await getConversationId(req, params);
  if (!conversationId) {
    return NextResponse.json(
      { error: "conversation_id is required (api)" },
      { status: 400 }
    );
  }

  const supabase = await createClient();
  const {
    data: { user },
    error: userErr,
  } = await supabase.auth.getUser();
  if (userErr || !user) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }

  const payload = await req.json();
  const body = payload?.body;
  if (!body || typeof body !== "string" || !body.trim()) {
    return NextResponse.json({ error: "body required" }, { status: 400 });
  }

  const reply_to_id = payload?.reply_to_id ?? null;
  const reply_to_body = payload?.reply_to_body ?? null;
  const reply_to_sender_id = payload?.reply_to_sender_id ?? null;

  console.log("Received message payload:", { body: body.trim(), reply_to_id, reply_to_body, reply_to_sender_id });

  const { data: inserted, error: insErr } = await supabase
    .from("messages")
    .insert({
      conversation_id: conversationId,
      sender_id: user.id,
      body: body.trim(),
      reply_to_id,
      reply_to_body,
      reply_to_sender_id,
    })
    .select(
      `
        id,
        body,
        created_at,
        sender_id,
        reply_to_id,
        reply_to_body,
        reply_to_sender_id,
        profiles:profiles!messages_sender_id_profiles_fkey(profile_title, avatar_url, date_of_birth)
      `
    )
    .single();

  if (insErr || !inserted) {
    console.error("Insert error:", insErr);
    return NextResponse.json(
      { error: insErr?.message || "Failed to send message" },
      { status: 500 }
    );
  }

  console.log("Inserted message:", inserted);

  let insertedWithAge: any = inserted;
  if (insertedWithAge?.profiles) {
    const { date_of_birth, ...rest } = insertedWithAge.profiles;
    insertedWithAge = {
      ...insertedWithAge,
      profiles: { ...rest, age: calcAge(date_of_birth ?? null) },
    };
  }

  // Attach sexuality/position labels by looking up the sender's profile
  let sexuality = null;
  let position = null;
  const { data: senderProfile } = await supabase
    .from("profiles")
    .select("id, sexuality_id, positions_id, position_id")
    .eq("id", user.id)
    .maybeSingle();

  if (senderProfile?.sexuality_id) {
    const { data } = await supabase
      .from("sexualities")
      .select("label")
      .eq("id", senderProfile.sexuality_id)
      .maybeSingle();
    sexuality = data?.label ? { label: data.label } : null;
  }
  const pid = senderProfile?.positions_id ?? senderProfile?.position_id;
  if (pid) {
    const { data } = await supabase
      .from("positions")
      .select("label")
      .eq("id", pid)
      .maybeSingle();
    position = data?.label ? { label: data.label } : null;
  }

  if (insertedWithAge?.profiles) {
    insertedWithAge = {
      ...insertedWithAge,
      profiles: {
        ...insertedWithAge.profiles,
        sexuality,
        position,
      },
    };
  }

  // Do not set sender read/delivered here; recipient delivery will be recorded when they fetch/view
  const nowIso = new Date().toISOString();

  // Bump conversation metadata (best-effort)
  await supabase
    .from("conversations")
    .update({ updated_at: nowIso, last_message: body.trim() })
    .eq("id", conversationId);

  const message = { ...insertedWithAge, delivered_at: null, read_at: null };
  return NextResponse.json({ message }, { status: 201 });
}

// PATCH /api/messages/:id -> mark messages in this conversation as read for current user
export async function PATCH(
  req: Request,
  { params }: { params: { id: string } }
) {
  const conversationId = await getConversationId(req, params);
  if (!conversationId) {
    return NextResponse.json(
      { error: "conversation_id is required (api)" },
      { status: 400 }
    );
  }

  const supabase = await createClient();
  const {
    data: { user },
    error: userErr,
  } = await supabase.auth.getUser();
  if (userErr || !user) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }

  // Get IDs of messages from others in this conversation
  const { data: msgs, error: idsErr } = await supabase
    .from("messages")
    .select("id, sender_id")
    .eq("conversation_id", conversationId);
  if (idsErr) {
    return NextResponse.json({ error: idsErr.message }, { status: 500 });
  }

  const otherIds = (msgs ?? [])
    .filter((m) => m.sender_id !== user.id)
    .map((m) => m.id);

  if (otherIds.length === 0) {
    return NextResponse.json({ updated: 0 }, { status: 200 });
  }

  const { error: updErr } = await supabase
    .from("message_receipts")
    .update({ read_at: new Date().toISOString() })
    .in("message_id", otherIds)
    .eq("user_id", user.id)
    .is("read_at", null);

  if (updErr) {
    return NextResponse.json({ error: updErr.message }, { status: 500 });
  }

  return NextResponse.json({ updated: otherIds.length }, { status: 200 });
}
