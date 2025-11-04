// app/api/messages/[id]/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

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

// GET /api/messages/:id -> list messages in a convo + upsert delivered receipts for viewer
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

  // 1) Fetch messages + sender profiles
  const { data: messages, error: msgErr } = await supabase
    .from("messages")
    .select(
      `
      id,
      body,
      created_at,
      sender_id,
      profiles:profiles!messages_sender_id_profiles_fkey(profile_title, avatar_url)
    `
    )
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true })
    .limit(200);

  if (msgErr) {
    return NextResponse.json({ error: msgErr.message }, { status: 500 });
  }

  const list = messages ?? [];

  // Determine 1:1 other participant (if any)
  const { data: members } = await supabase
    .from("conversation_members")
    .select("user_id")
    .eq("conversation_id", conversationId);

  const memberIds = (members ?? []).map((m) => m.user_id);
  const others = memberIds.filter((id) => id !== user.id);
  const otherUserId = others.length === 1 ? others[0] : null;

  // 2) Upsert delivered receipts for all messages from others (idempotent)
  if (list.length) {
    const toDeliver = list
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
  if (list.length) {
    const ids = list.map((m) => m.id);
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
  if (otherUserId && list.length) {
    const ids = list.map((m) => m.id);
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

  const enriched = list.map((m) => {
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

  return NextResponse.json({ messages: enriched }, { status: 200 });
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

  const { body } = await req.json();
  if (!body || typeof body !== "string" || !body.trim()) {
    return NextResponse.json({ error: "body required" }, { status: 400 });
  }

  const { data: inserted, error: insErr } = await supabase
    .from("messages")
    .insert({
      conversation_id: conversationId,
      sender_id: user.id,
      body: body.trim(),
    })
    .select(
      `
        id,
        body,
        created_at,
        sender_id,
        profiles:profiles!messages_sender_id_profiles_fkey(profile_title, avatar_url)
      `
    )
    .single();

  if (insErr || !inserted) {
    return NextResponse.json(
      { error: insErr?.message || "Failed to send message" },
      { status: 500 }
    );
  }

  // Do not set sender read/delivered here; recipient delivery will be recorded when they fetch/view
  const nowIso = new Date().toISOString();

  // Bump conversation metadata (best-effort)
  await supabase
    .from("conversations")
    .update({ updated_at: nowIso, last_message: body.trim() })
    .eq("id", conversationId);

  const message = { ...inserted, delivered_at: null, read_at: null };
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
