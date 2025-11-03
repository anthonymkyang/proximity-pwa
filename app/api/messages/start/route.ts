// app/api/messages/start/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server"; // <- your server helper above

export async function POST(req: Request) {
  const supabase = await createClient(); // your helper returns a promise
  const body = await req.json().catch(() => ({} as any));

  // who are we
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return NextResponse.json({ error: "not_authenticated" }, { status: 401 });
  }

  // maybe you sent a target user id in the body
  const { target_user_id } = body ?? {};

  // 1) do we already have a 1:1 conversation with this user?
  // (if you don’t have a 1:1 pattern yet, skip this lookup)
  // for now we’ll just always create / reuse a single “test” conversation
  const conversationId =
    body?.conversation_id ?? "00000000-0000-0000-0000-000000000001";

  // 2) make sure the conversation exists (insert … on conflict do nothing)
  const { error: convError } = await supabase.from("conversations").upsert(
    [
      {
        id: conversationId,
        type: "direct",
        created_by: user.id,
        updated_at: new Date().toISOString(),
      },
    ],
    { onConflict: "id" } // <- important
  );

  if (convError) {
    return NextResponse.json(
      { error: "upsert_conversation_failed", details: convError.message },
      { status: 400 }
    );
  }

  // 3) make sure *this* user is in conversation_members
  // your table PK is (conversation_id, user_id) so we MUST upsert with onConflict
  const { error: memberError } = await supabase
    .from("conversation_members")
    .upsert(
      [
        {
          conversation_id: conversationId,
          user_id: user.id,
          role: "member",
          joined_at: new Date().toISOString(),
        },
      ],
      {
        onConflict: "conversation_id,user_id",
      }
    );

  if (memberError) {
    // this is where you were getting 23505 before
    return NextResponse.json(
      {
        error: "upsert_member_failed",
        details: memberError.message,
      },
      { status: 400 }
    );
  }

  // 4) optionally also add the target user (but don’t blow up if they’re already there)
  if (target_user_id && target_user_id !== user.id) {
    await supabase.from("conversation_members").upsert(
      [
        {
          conversation_id: conversationId,
          user_id: target_user_id,
          role: "member",
          joined_at: new Date().toISOString(),
        },
      ],
      {
        onConflict: "conversation_id,user_id",
      }
    );
  }

  return NextResponse.json(
    {
      conversation_id: conversationId,
    },
    { status: 200 }
  );
}
