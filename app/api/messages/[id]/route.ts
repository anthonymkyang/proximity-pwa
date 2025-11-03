// app/api/messages/[id]/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

// GET /api/messages/:id -> list messages in a convo
export async function GET(
  req: Request,
  { params }: { params: { id: string } }
) {
  // derive id from route param OR path tail
  const url = new URL(req.url);
  const pathTail = url.pathname.split("/").pop();
  const conversationId =
    (params.id && params.id !== "undefined" ? params.id : null) ||
    (pathTail && pathTail !== "undefined" ? pathTail : null);

  if (!conversationId) {
    return NextResponse.json(
      { error: "conversation_id is required (api)" },
      { status: 400 }
    );
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }

  const { data: messages, error } = await supabase
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
    .limit(50);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ messages }, { status: 200 });
}

// POST /api/messages/:id -> send message
export async function POST(
  req: Request,
  { params }: { params: { id: string } }
) {
  const url = new URL(req.url);
  const pathTail = url.pathname.split("/").pop();
  const conversationId =
    (params.id && params.id !== "undefined" ? params.id : null) ||
    (pathTail && pathTail !== "undefined" ? pathTail : null);

  if (!conversationId) {
    return NextResponse.json(
      { error: "conversation_id is required (api)" },
      { status: 400 }
    );
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }

  const { body } = await req.json();

  if (!body || typeof body !== "string") {
    return NextResponse.json({ error: "body required" }, { status: 400 });
  }

  // must be a member to send
  const { data: member } = await supabase
    .from("conversation_members")
    .select("id")
    .eq("conversation_id", conversationId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!member) {
    return NextResponse.json({ error: "not a member" }, { status: 403 });
  }

  const { data, error } = await supabase
    .from("messages")
    .insert({
      conversation_id: conversationId,
      sender_id: user.id,
      body,
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
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // bump conversation
  await supabase
    .from("conversations")
    .update({
      updated_at: new Date().toISOString(),
      last_message: body,
    })
    .eq("id", conversationId);

  return NextResponse.json({ message: data }, { status: 201 });
}
