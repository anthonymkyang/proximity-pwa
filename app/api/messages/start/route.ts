import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import crypto from "crypto";

// Stable, order-independent UUID from two user ids (v5-like)
function stablePairUUID(a: string, b: string): string {
  const [u1, u2] = [a, b].sort();
  const input = `${u1}::${u2}`;
  const hash = crypto.createHash("sha1").update(input).digest(); // 20 bytes
  const bytes = Buffer.from(hash.slice(0, 16)); // 16 bytes
  // version 5
  bytes[6] = (bytes[6] & 0x0f) | 0x50;
  // variant RFC 4122
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = bytes.toString("hex");
  return (
    hex.slice(0, 8) +
    "-" +
    hex.slice(8, 12) +
    "-" +
    hex.slice(12, 16) +
    "-" +
    hex.slice(16, 20) +
    "-" +
    hex.slice(20)
  );
}

export async function POST(req: Request) {
  const supabase = await createClient();
  const body = await req.json().catch(() => ({} as any));

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return NextResponse.json({ error: "not_authenticated" }, { status: 401 });
  }

  const { target_user_id } = body ?? {};
  if (!target_user_id || typeof target_user_id !== "string") {
    return NextResponse.json(
      { error: "target_user_id_required" },
      { status: 400 }
    );
  }
  if (target_user_id === user.id) {
    return NextResponse.json({ error: "cannot_message_self" }, { status: 400 });
  }

  // Deterministic pair ID so the same two users always land in the same convo
  const conversationId = stablePairUUID(user.id, target_user_id);

  // Idempotent upsert of conversation
  const { error: convErr } = await supabase.from("conversations").upsert(
    [
      {
        id: conversationId,
        type: "direct",
        created_by: user.id,
        updated_at: new Date().toISOString(),
      },
    ],
    { onConflict: "id" }
  );

  if (convErr) {
    return NextResponse.json(
      { error: "upsert_conversation_failed", details: convErr.message },
      { status: 400 }
    );
  }

  // Idempotent upsert of both members
  const { error: memberErr } = await supabase
    .from("conversation_members")
    .upsert(
      [
        {
          conversation_id: conversationId,
          user_id: user.id,
          role: "member",
          joined_at: new Date().toISOString(),
        },
        {
          conversation_id: conversationId,
          user_id: target_user_id,
          role: "member",
          joined_at: new Date().toISOString(),
        },
      ],
      { onConflict: "conversation_id,user_id" }
    );

  if (memberErr) {
    return NextResponse.json(
      { error: "upsert_member_failed", details: memberErr.message },
      { status: 400 }
    );
  }

  return NextResponse.json(
    { conversation_id: conversationId },
    { status: 200 }
  );
}
