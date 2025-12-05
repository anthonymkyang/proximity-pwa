// app/api/user/notifications/groups/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { getGroupNotificationsForMany } from "@/lib/groups/notifications";

export async function GET() {
  try {
    const supabase = await createClient();

    // Auth
    const {
      data: { user },
      error: authErr,
    } = await supabase.auth.getUser();

    if (authErr || !user) {
      return NextResponse.json({ error: "Not signed in" }, { status: 401 });
    }

    const userId = user.id;

    // Fetch groups where user is host
    const { data: hosting } = await supabase
      .from("groups")
      .select("id, title")
      .eq("host_id", userId)
      .is("deleted_at", null);

    // Fetch groups where user is co-host
    const { data: cohosting } = await supabase
      .from("groups")
      .select("id, title, cohost_ids")
      .contains("cohost_ids", [userId])
      .is("deleted_at", null);

    const hostingIds = (hosting ?? []).map((g) => g.id);
    const cohostingIds = (cohosting ?? []).map((g) => g.id);

    const allIds = [...hostingIds, ...cohostingIds];

    if (allIds.length === 0) {
      return NextResponse.json({
        hosting: {},
        cohosting: {},
      });
    }

    // Fetch notifications for all groups in one go
    const allNotifications = await getGroupNotificationsForMany(allIds);

    const hostingMap: any = {};
    const cohostingMap: any = {};

    for (const id of hostingIds) {
      hostingMap[id] = allNotifications[id] ?? [];
    }
    for (const id of cohostingIds) {
      cohostingMap[id] = allNotifications[id] ?? [];
    }

    return NextResponse.json({
      hosting: hostingMap,
      cohosting: cohostingMap,
    });
  } catch (e: any) {
    console.error("[user/notifications/groups] error", e);
    return NextResponse.json(
      { error: e?.message || "Failed to load notifications" },
      { status: 500 }
    );
  }
}
