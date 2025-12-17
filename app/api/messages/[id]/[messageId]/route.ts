// app/api/messages/[id]/[messageId]/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

// DELETE /api/messages/:conversationId/:messageId -> soft delete a message
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string; messageId: string }> }
) {
  const { id: conversationId, messageId } = await params;

  if (!conversationId || !messageId) {
    return NextResponse.json(
      { error: "conversation_id and message_id are required" },
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

  // Verify message exists and belongs to current user
  const { data: message, error: getErr } = await supabase
    .from("messages")
    .select("id, sender_id, conversation_id")
    .eq("id", messageId)
    .eq("conversation_id", conversationId)
    .maybeSingle();

  if (getErr) {
    return NextResponse.json({ error: getErr.message }, { status: 500 });
  }

  if (!message) {
    return NextResponse.json({ error: "message not found" }, { status: 404 });
  }

  // Only allow deleting your own messages
  if (message.sender_id !== user.id) {
    return NextResponse.json(
      { error: "can only delete your own messages" },
      { status: 403 }
    );
  }

  // Soft delete by setting deleted_at timestamp
  const { error: deleteErr } = await supabase
    .from("messages")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", messageId);

  if (deleteErr) {
    return NextResponse.json({ error: deleteErr.message }, { status: 500 });
  }

  return NextResponse.json({ deleted: true }, { status: 200 });
}
