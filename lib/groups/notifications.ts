// lib/groups/notifications.ts
import { createClient } from "@/utils/supabase/server";

export type GroupNotificationType = "member_left" | string;

export type GroupNotification = {
  id: string;
  group_id: string;
  actor_id: string;
  type: GroupNotificationType;
  message: string | null;
  payload: Record<string, any> | null;
  created_at: string;
};

/**
 * Fetch notifications for a group, only if the current user is host or co-host.
 * This is what you will use on the manage-groups page to show the sheet.
 */
export async function listGroupNotificationsForHost(options: {
  groupId: string;
  limit?: number;
}): Promise<{ data: GroupNotification[]; error: string | null }> {
  const { groupId, limit = 50 } = options;
  const supabase = await createClient();

  // 1. Auth
  const {
    data: { user },
    error: authErr,
  } = await supabase.auth.getUser();

  if (authErr || !user) {
    return { data: [], error: "You must be signed in." };
  }

  const userId = user.id;

  // 2. Verify this user is host or co-host of the group
  const { data: group, error: groupErr } = await supabase
    .from("groups")
    .select("id, host_id, cohost_ids")
    .eq("id", groupId)
    .maybeSingle();

  if (groupErr) {
    return { data: [], error: "Could not load group." };
  }
  if (!group) {
    return { data: [], error: "Group not found." };
  }

  const cohostIds: string[] = Array.isArray(group.cohost_ids)
    ? (group.cohost_ids as string[])
    : [];

  const isHost = group.host_id === userId;
  const isCohost = cohostIds.includes(userId);

  if (!isHost && !isCohost) {
    return { data: [], error: "You are not allowed to view notifications." };
  }

  // 3. Fetch notifications for this group
  const { data, error } = await supabase
    .from("group_notifications")
    .select("id, group_id, actor_id, type, message, payload, created_at")
    .eq("group_id", groupId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    return { data: [], error: "Failed to load notifications." };
  }

  return {
    data: (data || []) as GroupNotification[],
    error: null,
  };
}

export async function getGroupNotificationsForMany(
  groupIds: string[],
  perGroupLimit: number = 50
): Promise<Record<string, GroupNotification[]>> {
  if (!Array.isArray(groupIds) || groupIds.length === 0) {
    return {};
  }

  const supabase = await createClient();

  const { data, error } = await supabase
    .from("group_notifications")
    .select("id, group_id, actor_id, type, message, payload, created_at")
    .in("group_id", groupIds)
    .order("created_at", { ascending: false });

  if (error || !data) {
    return {};
  }

  const map: Record<string, GroupNotification[]> = {};

  for (const row of data as GroupNotification[]) {
    const gid = row.group_id;
    if (!map[gid]) {
      map[gid] = [];
    }
    if (map[gid].length < perGroupLimit) {
      map[gid].push(row);
    }
  }

  return map;
}
