// lib/messages/messages.ts
import { createClient } from "@/utils/supabase/server";

type ConversationJoin =
  | {
      id: string;
      type: string;
    }
  | {
      // what Supabase sometimes returns with !inner(...) as array
      id: string;
      type: string;
    }[];

type ConversationMemberRow = {
  conversation_id: string;
  conversations: ConversationJoin | null;
};

export async function getOrCreateDirectConversation(
  currentUserId: string,
  otherUserId: string
): Promise<string> {
  const supabase = await createClient();

  // 1) conversations I'm in
  const { data: myMemberships, error: membershipsErr } = await supabase
    .from("conversation_members")
    .select("conversation_id, conversations!inner(id, type)")
    .eq("user_id", currentUserId);

  if (membershipsErr) {
    throw membershipsErr;
  }

  const typedMemberships = (myMemberships ?? []) as ConversationMemberRow[];

  // normalise: conversations can be an object or an array
  const myDirectConversationIds = typedMemberships
    .map((m) => {
      if (!m.conversations) return null;

      // if it's an array, take first
      if (Array.isArray(m.conversations)) {
        const first = m.conversations[0];
        if (!first) return null;
        return first.type === "direct" ? m.conversation_id : null;
      }

      // it's an object
      return m.conversations.type === "direct" ? m.conversation_id : null;
    })
    .filter(Boolean) as string[];

  // 2) check if other user is in any of these
  if (myDirectConversationIds.length > 0) {
    const { data: shared } = await supabase
      .from("conversation_members")
      .select("conversation_id")
      .eq("user_id", otherUserId)
      .in("conversation_id", myDirectConversationIds)
      .maybeSingle();

    if (shared?.conversation_id) {
      return shared.conversation_id;
    }
  }

  // 3) no existing → create the conversation
  const { data: newConvo, error: convoErr } = await supabase
    .from("conversations")
    .insert({
      type: "direct",
      created_by: currentUserId,
    })
    .select("id")
    .single();

  if (convoErr || !newConvo) {
    throw convoErr ?? new Error("Failed to create conversation");
  }

  // 4) add both members
  const { error: membersErr } = await supabase
    .from("conversation_members")
    .insert([
      {
        conversation_id: newConvo.id,
        user_id: currentUserId,
      },
      {
        conversation_id: newConvo.id,
        user_id: otherUserId,
      },
    ]);

  if (membersErr) {
    throw membersErr;
  }

  return newConvo.id;
}
