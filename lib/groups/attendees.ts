// lib/groups/attendees.ts
import { createClient } from "@/utils/supabase/server";

type RequestToJoinInput = {
  groupId: string;
  message: string | null;
};

type LeaveGroupInput = {
  groupId: string;
  message: string | null;
};

export async function requestToJoinGroup({
  groupId,
  message,
}: RequestToJoinInput) {
  const supabase = await createClient();

  // 1. Auth
  const {
    data: { user },
    error: authErr,
  } = await supabase.auth.getUser();

  if (authErr || !user) {
    throw new Error("You need to be signed in to request an invite.");
  }

  const userId = user.id;

  // 2. Fetch group, basic checks
  const { data: group, error: groupErr } = await supabase
    .from("groups")
    .select("id, host_id, cohost_ids, status")
    .eq("id", groupId)
    .maybeSingle();

  if (groupErr) {
    throw new Error("Could not load group.");
  }
  if (!group) {
    throw new Error("Group not found.");
  }

  const cohostIds: string[] = Array.isArray(group.cohost_ids)
    ? (group.cohost_ids as string[])
    : [];

  const isHost = group.host_id === userId;
  const isCohost = cohostIds.includes(userId);

  if (isHost || isCohost) {
    throw new Error("You are already hosting this group.");
  }

  if (group.status === "cancelled" || group.status === "completed") {
    throw new Error("This group is no longer accepting requests.");
  }

  // 3. Check existing attendee row
  const { data: existing, error: existingErr } = await supabase
    .from("group_attendees")
    .select("group_id, user_id, status")
    .eq("group_id", groupId)
    .eq("user_id", userId)
    .maybeSingle();

  if (existingErr) {
    throw new Error("Could not check your current status.");
  }

  if (existing) {
    const status = String(existing.status || "").toLowerCase();

    if (status === "accepted" || status === "approved") {
      throw new Error("You are already in this group.");
    }

    if (status === "pending") {
      // Update message only, keep status pending
      const { data: updated, error: updErr } = await supabase
        .from("group_attendees")
        .update({
          message: message,
        })
        .eq("group_id", groupId)
        .eq("user_id", userId)
        .select("group_id, user_id, status")
        .maybeSingle();

      if (updErr || !updated) {
        throw new Error("Failed to update your existing request.");
      }

      return updated;
    }

    // For any other status (rejected, removed etc) create a fresh pending row
  }

  // 4. Insert new pending request
  const { data: inserted, error: insertErr } = await supabase
    .from("group_attendees")
    .insert({
      group_id: groupId,
      user_id: userId,
      status: "pending",
      message,
    })
    .select("group_id, user_id, status")
    .maybeSingle();

  if (insertErr || !inserted) {
    throw new Error("Failed to create invite request.");
  }

  return inserted;
}

/**
 * User leaves a group and optionally sends a private message to hosts.
 * Inserts a row into group_notifications, then removes them from group_attendees.
 */
export async function leaveGroupWithMessage({
  groupId,
  message,
}: LeaveGroupInput) {
  const supabase = await createClient();

  // 1. Auth
  const {
    data: { user },
    error: authErr,
  } = await supabase.auth.getUser();

  if (authErr || !user) {
    throw new Error("You need to be signed in to leave a group.");
  }

  const userId = user.id;

  // 2. Ensure group exists, basic host info
  const { data: group, error: groupErr } = await supabase
    .from("groups")
    .select("id, host_id, cohost_ids")
    .eq("id", groupId)
    .maybeSingle();

  if (groupErr) {
    throw new Error("Could not load group.");
  }
  if (!group) {
    throw new Error("Group not found.");
  }

  // 3. Ensure this user is actually an attendee
  const { data: attendee, error: attendeeErr } = await supabase
    .from("group_attendees")
    .select("group_id, user_id, status")
    .eq("group_id", groupId)
    .eq("user_id", userId)
    .maybeSingle();

  if (attendeeErr) {
    throw new Error("Could not check your membership.");
  }

  if (!attendee) {
    throw new Error("You are not part of this group.");
  }

  const previousStatus = String(attendee.status || "").toLowerCase();

  // 4. Insert a notification for hosts/cohosts
  // RLS on group_notifications only lets hosts/cohosts read this.
  const trimmedMessage =
    typeof message === "string" && message.trim().length > 0
      ? message.trim().slice(0, 1000)
      : null;

  const { error: notifErr } = await supabase
    .from("group_notifications")
    .insert({
      group_id: groupId,
      actor_id: userId,
      type: "member_left",
      message: trimmedMessage,
      payload: {
        previous_status: previousStatus,
      },
    });

  if (notifErr) {
    throw new Error("Failed to record leave notification.");
  }

  // 5. Remove them from the attendee list
  const { error: deleteErr } = await supabase
    .from("group_attendees")
    .delete()
    .eq("group_id", groupId)
    .eq("user_id", userId);

  if (deleteErr) {
    throw new Error("Failed to leave this group.");
  }

  return {
    group_id: groupId,
    user_id: userId,
  };
}
