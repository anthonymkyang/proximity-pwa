import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const admin =
  SUPABASE_URL && SERVICE_ROLE_KEY
    ? createAdminClient(SUPABASE_URL, SERVICE_ROLE_KEY)
    : null;

async function getConversationId(
  req: Request,
  paramsOrPromise: { id?: string } | Promise<{ id?: string }>
) {
  const url = new URL(req.url);
  const tail = url.pathname.split("/").slice(-2)[0];

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

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const conversationId = await getConversationId(req, params);
  if (!conversationId) {
    return NextResponse.json(
      { error: "conversation_id is required" },
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

  const db = admin ?? supabase;
  const { data: membership, error: memberErr } = await db
    .from("conversation_members")
    .select("conversation_id")
    .eq("conversation_id", conversationId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (memberErr || !membership) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const { data: msgs, error: idsErr } = await db
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

  const nowIso = new Date().toISOString();
  const rows = otherIds.map((message_id) => ({
    message_id,
    user_id: user.id,
    delivered_at: nowIso,
    read_at: nowIso,
  }));
  const { error: upsertErr } = await db
    .from("message_receipts")
    .upsert(rows, { onConflict: "message_id,user_id" });
  if (upsertErr) {
    return NextResponse.json({ error: upsertErr.message }, { status: 500 });
  }

  return NextResponse.json({ updated: otherIds.length }, { status: 200 });
}
