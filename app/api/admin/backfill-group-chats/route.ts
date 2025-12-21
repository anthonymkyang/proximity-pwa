import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function POST(_req: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceKey) {
    return NextResponse.json(
      { error: "Missing environment variables" },
      { status: 500 }
    );
  }

  const admin = createClient(supabaseUrl, serviceKey);
  const pageSize = 200;
  let offset = 0;
  let updated = 0;

  while (true) {
    const { data: groups, error } = await admin
      .from("groups")
      .select("id, title, host_id, cohost_ids, status")
      .eq("status", "active")
      .range(offset, offset + pageSize - 1);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (!groups || groups.length === 0) break;

    for (const group of groups) {
      const groupId = String(group.id);
      const hostId = group.host_id ? String(group.host_id) : null;
      if (!hostId) continue;

      await admin.from("conversations").upsert(
        {
          id: groupId,
          type: "group",
          name: group.title || "Group",
          created_by: hostId,
        },
        { onConflict: "id" }
      );

      const { data: attendeeRows } = await admin
        .from("group_attendees")
        .select("user_id")
        .eq("group_id", groupId)
        .in("status", ["accepted", "approved"]);

      const memberIds = new Set<string>();
      memberIds.add(hostId);
      const cohostIds: string[] = Array.isArray(group.cohost_ids)
        ? group.cohost_ids.map((id: any) => String(id))
        : [];
      cohostIds.forEach((id) => {
        if (id) memberIds.add(id);
      });
      (attendeeRows ?? []).forEach((row: any) => {
        if (row?.user_id) memberIds.add(String(row.user_id));
      });

      const rows = Array.from(memberIds).map((userId) => ({
        conversation_id: groupId,
        user_id: userId,
        role: userId === hostId ? "host" : "member",
      }));

      await admin
        .from("conversation_members")
        .upsert(rows, { onConflict: "conversation_id,user_id" });

      updated += 1;
    }

    offset += groups.length;
    if (groups.length < pageSize) break;
  }

  return NextResponse.json({ updated });
}
