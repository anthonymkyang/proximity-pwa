import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { getOrCreateDirectConversation } from "@/lib/messages/messages";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: groupId } = await params;
    const supabase = await createClient();
    const {
      data: { user },
      error: authErr,
    } = await supabase.auth.getUser();

    if (authErr || !user) {
      return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
    }

    const body = await req.json();
    const targetUserId = body?.userId;
    const action = body?.action;

    if (!groupId || !targetUserId || !action) {
      return NextResponse.json(
        { error: "groupId, userId, and action required" },
        { status: 400 }
      );
    }

    if (!["approved", "declined", "removed"].includes(action)) {
      return NextResponse.json({ error: "invalid action" }, { status: 400 });
    }

    const { data: group, error: groupErr } = await supabase
      .from("groups")
      .select("id, title, host_id, cohost_ids")
      .eq("id", groupId)
      .maybeSingle();

    if (groupErr) {
      return NextResponse.json({ error: groupErr.message }, { status: 500 });
    }

    if (!group) {
      return NextResponse.json({ error: "group not found" }, { status: 404 });
    }

    const cohosts = Array.isArray(group.cohost_ids)
      ? group.cohost_ids.map((cid: any) => String(cid))
      : [];
    const isHost = group.host_id === user.id;
    const isCohost = cohosts.includes(user.id);

    if (!isHost && !isCohost) {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }

    const groupTitle = group.title || "Group";
    const messageText =
      action === "approved"
        ? `You have been approved to the group: ${groupTitle}.`
        : action === "removed"
        ? `You have been removed from the group: ${groupTitle}.`
        : `Your request to join ${groupTitle} was declined.`;

    const conversationId = await getOrCreateDirectConversation(
      user.id,
      targetUserId
    );

    const { error: msgErr } = await supabase.from("messages").insert({
      conversation_id: conversationId,
      sender_id: user.id,
      body: messageText,
      message_type: "group",
      metadata: {
        group: {
          id: groupId,
          title: groupTitle,
          action,
          message: messageText,
        },
      },
    });

    if (msgErr) {
      return NextResponse.json({ error: msgErr.message }, { status: 500 });
    }

    await supabase
      .from("conversations")
      .update({ updated_at: new Date().toISOString(), last_message: messageText })
      .eq("id", conversationId);

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || "failed to notify" },
      { status: 500 }
    );
  }
}
