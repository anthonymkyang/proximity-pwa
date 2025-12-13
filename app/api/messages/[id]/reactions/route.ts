// app/api/messages/[id]/reactions/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

function getConversationId(params: { id?: string }, pathname: string) {
  const tail = pathname.split("/").pop();
  const pid = params?.id && params.id !== "undefined" ? String(params.id) : null;
  return pid || (tail && tail !== "undefined" ? tail : null);
}

async function canActInConversation(
  supabase: Awaited<ReturnType<typeof createClient>>,
  conversationId: string,
  userId: string
) {
  // Allow if the user is a member or has sent a message in the conversation (legacy convos missing membership rows)
  const { data: memberRow } = await supabase
    .from("conversation_members")
    .select("user_id")
    .eq("conversation_id", conversationId)
    .eq("user_id", userId)
    .maybeSingle();

  if (memberRow) return true;

  const { data: anyMsg } = await supabase
    .from("messages")
    .select("id")
    .eq("conversation_id", conversationId)
    .eq("sender_id", userId)
    .limit(1)
    .maybeSingle();

  return Boolean(anyMsg);
}

export async function POST(
  req: Request,
  { params }: { params: { id: string } }
) {
  const conversationId = getConversationId(params, new URL(req.url).pathname);
  if (!conversationId) {
    return NextResponse.json({ error: "conversation_id required" }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
    error: userErr,
  } = await supabase.auth.getUser();
  if (userErr || !user) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }

  let payload: any;
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid payload" }, { status: 400 });
  }

  const messageId = payload?.message_id;
  const type = payload?.type ?? null;
  if (!messageId) {
    return NextResponse.json({ error: "message_id required" }, { status: 400 });
  }

  // Ensure message belongs to conversation
  const { data: msgRow, error: msgErr } = await supabase
    .from("messages")
    .select("id, sender_id, conversation_id")
    .eq("id", messageId)
    .maybeSingle();
  if (msgErr) {
    console.error("reaction msg fetch error", msgErr);
    return NextResponse.json({ error: msgErr.message }, { status: 500 });
  }
  if (!msgRow) {
    return NextResponse.json({ error: "message not found" }, { status: 404 });
  }
  const convId = msgRow.conversation_id ?? conversationId;

  // Ensure the actor is allowed: conversation member, sender of the message, or sender of any message in the conversation
  const canAct = msgRow.sender_id === user.id
    ? true
    : await canActInConversation(supabase, convId, user.id);
  if (!canAct) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  if (type) {
    const { error: upErr } = await supabase
      .from("message_reactions")
      .upsert(
        { message_id: messageId, user_id: user.id, type },
        { onConflict: "message_id,user_id" }
      );
    if (upErr) {
      console.error("reaction upsert error", upErr);
      return NextResponse.json({ error: upErr.message }, { status: 500 });
    }
  } else {
    const { error: delErr } = await supabase
      .from("message_reactions")
      .delete()
      .eq("message_id", messageId)
      .eq("user_id", user.id);
    if (delErr) {
      console.error("reaction delete error", delErr);
      return NextResponse.json({ error: delErr.message }, { status: 500 });
    }
  }

  return NextResponse.json({ message_id: messageId, type }, { status: 200 });
}

export async function DELETE(
  req: Request,
  ctx: { params: { id: string } }
) {
  const conversationId = getConversationId(ctx.params, new URL(req.url).pathname);
  if (!conversationId) {
    return NextResponse.json({ error: "conversation_id required" }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
    error: userErr,
  } = await supabase.auth.getUser();
  if (userErr || !user) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }

  let payload: any;
  try {
    payload = await req.json();
  } catch {
    payload = null;
  }
  const messageId = payload?.message_id;
  if (!messageId) {
    return NextResponse.json({ error: "message_id required" }, { status: 400 });
  }

  const { data: msgRow, error: msgErr } = await supabase
    .from("messages")
    .select("id, sender_id, conversation_id")
    .eq("id", messageId)
    .maybeSingle();
  if (msgErr) {
    console.error("reaction msg fetch error", msgErr);
    return NextResponse.json({ error: msgErr.message }, { status: 500 });
  }
  if (!msgRow) {
    return NextResponse.json({ error: "message not found" }, { status: 404 });
  }
  const convId = msgRow.conversation_id ?? conversationId;

  const canAct = msgRow.sender_id === user.id
    ? true
    : await canActInConversation(supabase, convId, user.id);
  if (!canAct) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const { error: delErr } = await supabase
    .from("message_reactions")
    .delete()
    .eq("message_id", messageId)
    .eq("user_id", user.id);
  if (delErr) {
    console.error("reaction delete error", delErr);
    return NextResponse.json({ error: delErr.message }, { status: 500 });
  }

  return NextResponse.json({ message_id: messageId, type: null }, { status: 200 });
}
