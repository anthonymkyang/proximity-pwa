import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

type MembershipStatus = "hosting" | "co-hosting" | "attending";
type GroupLifecycleStatus = "active" | "in_progress" | null;

type ApiGroup = {
  id: string;
  name: string;
  nextDate: string | null;
  membershipStatus: MembershipStatus;
  lifecycleStatus: GroupLifecycleStatus;
  colorClass: string;
  cover_image_url: string | null;
  categoryName: string | null;
  host_id: string | null;
  cohost_ids: string[];
  location_lat: number | null;
  location_lng: number | null;
  distanceKm: number | null;
};

type AvatarStackItem = {
  src?: string;
  name?: string;
  fallback?: string;
};

type ListingGroup = {
  id: string;
  name: string;
  start_time: string | null;
  cover_image_url: string | null;
  categoryName: string | null;
  host_id: string | null;
  cohost_ids: string[];
  location_lat: number | null;
  location_lng: number | null;
  distanceKm: number | null;
  lifecycleStatus: GroupLifecycleStatus;
};

const COLOR_PALETTE = [
  "bg-emerald-200",
  "bg-amber-200",
  "bg-pink-200",
  "bg-sky-200",
  "bg-violet-200",
  "bg-blue-200",
];

const GROUP_SELECT =
  "id, host_id, cohost_ids, title, start_time, cover_image_url, status, location_lat, location_lng, group_categories(name)";

function initials(name?: string | null) {
  if (!name) return "";
  const parts = String(name).trim().split(/\s+/);
  const a = parts[0]?.[0] || "";
  const b = parts[1]?.[0] || "";
  return (a + b).toUpperCase();
}

function resolveAvatarUrl(path?: string | null): string | undefined {
  if (!path) return undefined;
  const s = String(path);
  if (s.startsWith("http://") || s.startsWith("https://")) return s;
  return `/api/photos/avatars?path=${encodeURIComponent(s)}`;
}

function normalizeLifecycle(status?: string | null): GroupLifecycleStatus {
  if (!status) return null;
  const lower = status.toLowerCase();
  return lower === "in_progress" || lower === "active"
    ? (lower as GroupLifecycleStatus)
    : null;
}

export async function GET() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authErr,
    } = await supabase.auth.getUser();

    const userId = authErr ? null : user?.id ?? null;

    const byId = new Map<string, ApiGroup>();

    if (userId) {
      const [hostRes, cohostRes, attendeeRes] = await Promise.all([
        supabase
          .from("groups")
          .select(GROUP_SELECT)
          .in("status", ["active", "in_progress"])
          .eq("host_id", userId),
        supabase
          .from("groups")
          .select(GROUP_SELECT)
          .in("status", ["active", "in_progress"])
          .contains("cohost_ids", [userId]),
        supabase
          .from("group_attendees")
          .select(
            "group_id, status, groups:groups!inner(id, host_id, cohost_ids, title, start_time, cover_image_url, status, location_lat, location_lng, group_categories(name))"
          )
          .eq("user_id", userId)
          .eq("status", "accepted")
          .in("groups.status", ["active", "in_progress"]),
      ]);

      if (hostRes.error) {
        console.warn("[groups/activity] host fetch error", hostRes.error);
      }
      if (cohostRes.error) {
        console.warn("[groups/activity] cohost fetch error", cohostRes.error);
      }
      if (attendeeRes.error) {
        console.warn(
          "[groups/activity] attendee fetch error",
          attendeeRes.error
        );
      }

      let colorIdx = 0;

      const pushGroup = (
        row: any,
        membershipStatus: MembershipStatus,
        fallbackIndex?: number
      ) => {
        if (!row?.id || byId.has(row.id)) return;
        const colorClass =
          COLOR_PALETTE[
            (typeof fallbackIndex === "number" ? fallbackIndex : colorIdx) %
              COLOR_PALETTE.length
          ];
        if (typeof fallbackIndex !== "number") colorIdx += 1;
        const cohosts = Array.isArray(row.cohost_ids)
          ? row.cohost_ids.map((cid: any) => String(cid))
          : [];
        byId.set(row.id, {
          id: row.id,
          name: row.title || "Untitled group",
          nextDate: row.start_time || null,
          membershipStatus,
          lifecycleStatus: normalizeLifecycle(row.status),
          colorClass,
          cover_image_url: row.cover_image_url || null,
          categoryName: row.group_categories?.name ?? null,
          host_id: row.host_id || null,
          cohost_ids: cohosts,
          location_lat:
            typeof row.location_lat === "number" ? row.location_lat : null,
          location_lng:
            typeof row.location_lng === "number" ? row.location_lng : null,
          distanceKm: null,
        });
      };

      (hostRes.data || []).forEach((row, index) =>
        pushGroup(row, "hosting", index)
      );
      (cohostRes.data || []).forEach((row, index) =>
        pushGroup(row, "co-hosting", index)
      );
      (attendeeRes.data || []).forEach((row: any, index: number) =>
        pushGroup(row?.groups, "attending", index)
      );
    }

    const groups = Array.from(byId.values());

    groups.sort((a, b) => {
      const ta = a.nextDate ? Date.parse(a.nextDate) : Number.NaN;
      const tb = b.nextDate ? Date.parse(b.nextDate) : Number.NaN;
      const aValid = Number.isFinite(ta);
      const bValid = Number.isFinite(tb);
      if (aValid && bValid) return ta - tb;
      if (aValid && !bValid) return -1;
      if (!aValid && bValid) return 1;
      return 0;
    });

    const groupIds = groups.map((g) => g.id);
    const attendeeAvatars: Record<
      string,
      { avatars: AvatarStackItem[]; extra: number }
    > = {};

    if (groupIds.length) {
      try {
        const hostAndCohostIds = Array.from(
          new Set(
            groups
              .flatMap((g) => [
                g.host_id,
                ...(Array.isArray(g.cohost_ids) ? g.cohost_ids : []),
              ])
              .filter(Boolean) as string[]
          )
        );

        const attendeesPromise = supabase
          .from("group_attendees")
          .select(
            "group_id, user_id, profiles:profiles!inner(id, avatar_url, profile_title, name)"
          )
          .in("group_id", groupIds)
          .eq("status", "accepted");

        const profilesPromise = hostAndCohostIds.length
          ? supabase
              .from("profiles")
              .select("id, avatar_url, profile_title, name")
              .in("id", hostAndCohostIds)
          : Promise.resolve({ data: [], error: null } as {
              data: any[] | null;
              error: any;
            });

        const [{ data: attendees }, { data: profiles }] = await Promise.all([
          attendeesPromise,
          profilesPromise,
        ]);

        const hostProfileMap = new Map(
          (profiles || []).map((p: any) => [p.id, p])
        );
        const attendeesByGroup = new Map<string, any[]>();
        (attendees || []).forEach((row: any) => {
          const gid = row.group_id as string;
          if (!gid) return;
          if (!attendeesByGroup.has(gid)) attendeesByGroup.set(gid, []);
          attendeesByGroup.get(gid)!.push(row);
        });

        // Add hostProfile to each group
        for (const group of groups) {
          if (group.host_id) {
            const hp = hostProfileMap.get(group.host_id);
            (group as any).hostProfile = hp
              ? {
                  name: hp.profile_title || hp.name || null,
                  avatar_url: hp.avatar_url || null,
                }
              : null;
          }

          const items: AvatarStackItem[] = [];
          const seen = new Set<string>();

          if (group.host_id) {
            const hp = hostProfileMap.get(group.host_id);
            const name = hp?.profile_title || hp?.name || "";
            items.push({
              src: resolveAvatarUrl(hp?.avatar_url),
              name,
              fallback: initials(name),
            });
            seen.add(group.host_id);
          }

          const cohosts = Array.isArray(group.cohost_ids)
            ? group.cohost_ids
            : [];
          for (const cid of cohosts) {
            if (!cid || seen.has(cid)) continue;
            const cp = hostProfileMap.get(cid);
            if (!cp) continue;
            const name = cp?.profile_title || cp?.name || "";
            items.push({
              src: resolveAvatarUrl(cp?.avatar_url),
              name,
              fallback: initials(name),
            });
            seen.add(cid);
          }

          const accepted = attendeesByGroup.get(group.id) || [];
          for (const row of accepted) {
            const profile = row?.profiles;
            const pid = profile?.id as string | undefined;
            if (!pid || seen.has(pid)) continue;
            const name = profile?.profile_title || profile?.name || "";
            items.push({
              src: resolveAvatarUrl(profile?.avatar_url),
              name,
              fallback: initials(name),
            });
            seen.add(pid);
          }

          const avatars = items.slice(0, 5);
          const extra = Math.max(0, items.length - avatars.length);
          attendeeAvatars[group.id] = { avatars, extra };
        }
      } catch (e) {
        console.warn("[groups/activity] avatar preload failed", e);
      }
    }

    let listings: ListingGroup[] = [];
    try {
      const { data: listingRows, error: listingsErr } = await supabase
        .from("groups")
        .select(
          "id, title, start_time, cover_image_url, is_public, status, host_id, cohost_ids, location_lat, location_lng, group_categories(name)"
        )
        .in("status", ["active", "in_progress"])
        .eq("is_public", true)
        .not("location_lat", "is", null)
        .not("location_lng", "is", null)
        .limit(30);

      if (listingsErr) {
        console.warn("[groups/activity] listings fetch error", listingsErr);
      } else {
        listings = (listingRows || []).map((row: any) => ({
          id: row.id,
          name: row.title || "Untitled group",
          start_time: row.start_time || null,
          cover_image_url: row.cover_image_url || null,
          categoryName: row.group_categories?.name ?? null,
          host_id: row.host_id || null,
          cohost_ids: Array.isArray(row.cohost_ids)
            ? row.cohost_ids.map((cid: any) => String(cid))
            : [],
          location_lat:
            typeof row.location_lat === "number" ? row.location_lat : null,
          location_lng:
            typeof row.location_lng === "number" ? row.location_lng : null,
          distanceKm: null,
          lifecycleStatus: normalizeLifecycle(row.status),
        }));
      }
    } catch (e) {
      console.warn("[groups/activity] listings fetch threw", e);
    }

    // Compute people counts for badge rendering (host + co-hosts + attendees)
    const peopleCounts: Record<string, number> = {};
    try {
      const allGroups = [
        ...groups.map((g) => ({
          id: g.id,
          host_id: g.host_id,
          cohost_ids: Array.isArray(g.cohost_ids) ? g.cohost_ids : [],
        })),
        ...listings.map((g) => ({
          id: g.id,
          host_id: g.host_id,
          cohost_ids: Array.isArray(g.cohost_ids) ? g.cohost_ids : [],
        })),
      ];

      const allIds = Array.from(new Set(allGroups.map((g) => g.id)));
      const sets = new Map<string, Set<string>>();
      for (const g of allGroups) {
        if (!g.id) continue;
        if (!sets.has(g.id)) sets.set(g.id, new Set());
        const s = sets.get(g.id)!;
        if (g.host_id) s.add(String(g.host_id));
        for (const cid of g.cohost_ids || []) {
          if (cid) s.add(String(cid));
        }
      }

      if (allIds.length) {
        const { data: attendeeRows, error: attendeeErr } = await supabase
          .from("group_attendees")
          .select("group_id, user_id")
          .in("group_id", allIds)
          .eq("status", "accepted");

        if (attendeeErr) {
          console.warn(
            "[groups/activity] attendee count fetch error",
            attendeeErr
          );
        } else {
          (attendeeRows || []).forEach((row: any) => {
            const gid = row?.group_id ? String(row.group_id) : null;
            const uid = row?.user_id ? String(row.user_id) : null;
            if (!gid || !uid) return;
            if (!sets.has(gid)) sets.set(gid, new Set());
            sets.get(gid)!.add(uid);
          });
        }
      }

      for (const id of allIds) {
        peopleCounts[id] = sets.get(id)?.size ?? 0;
      }
    } catch (e) {
      console.warn("[groups/activity] people count compute failed", e);
    }

    return NextResponse.json({
      groups,
      attendeeAvatars,
      listings,
      peopleCounts,
    });
  } catch (e) {
    console.error("[groups/activity] failed", e);
    return NextResponse.json(
      { error: "Failed to load groups", groups: [], attendeeAvatars: {} },
      { status: 500 }
    );
  }
}
