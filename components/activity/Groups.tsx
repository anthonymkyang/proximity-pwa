"use client";

import * as React from "react";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import {
  Avatar14,
  type Avatar14Item,
} from "@/components/shadcn-studio/avatar/avatar-14";
import { MoreHorizontal, ChevronRight, Plus, Users, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import Link from "next/link";
import Image from "next/image";
import { createClient } from "@/utils/supabase/client";

type MyGroupCard = {
  id: string;
  name: string;
  nextDate: string | null; // ISO date string
  status: "hosting" | "co-hosting" | "attending";
  colorClass: string;
  cover_image_url?: string | null;
  categoryName?: string | null;
  host_id?: string | null;
  cohost_ids?: string[];
  location_lat?: number | null;
  location_lng?: number | null;
  distanceKm?: number | null; // computed client-side
};

// --- NearbyGroup type for nearby groups fetched from Supabase ---
type NearbyGroup = {
  id: string;
  name: string;
  start_time: string | null;
  cover_image_url?: string | null;
  categoryName?: string | null;
  location_lat?: number | null;
  location_lng?: number | null;
  distanceKm?: number | null;
};

function monthDay(dateStr?: string | null): { month: string; day: string } {
  if (!dateStr) return { month: "TBD", day: "" };
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return { month: "TBD", day: "" };
  return {
    month: d.toLocaleString(undefined, { month: "short" }),
    day: String(d.getDate()).padStart(2, "0"),
  };
}

function haversineKm(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number }
) {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const la1 = (a.lat * Math.PI) / 180;
  const la2 = (b.lat * Math.PI) / 180;
  const sinDLat = Math.sin(dLat / 2);
  const sinDLng = Math.sin(dLng / 2);
  const h =
    sinDLat * sinDLat + Math.cos(la1) * Math.cos(la2) * sinDLng * sinDLng;
  const c = 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
  return R * c;
}

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

function resolveCoverUrl(path?: string | null): string | undefined {
  if (!path) return undefined;
  const s = String(path);
  if (s.startsWith("http://") || s.startsWith("https://")) return s;
  // Proxy through our storage API, which supports private or public buckets
  return `/api/groups/storage?path=${encodeURIComponent(
    s.replace(/^\/+/, "")
  )}`;
}

export default function Groups() {
  const upcomingDays = Array.from({ length: 14 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() + i);
    return d;
  });

  const [selectedDayIndex, setSelectedDayIndex] = React.useState(0);
  const [myGroups, setMyGroups] = React.useState<MyGroupCard[] | null>(null);
  const [loadingGroups, setLoadingGroups] = React.useState(false);
  const [visiblePerDay, setVisiblePerDay] = React.useState<number[]>(() =>
    Array.from({ length: upcomingDays.length }, () => 5)
  );
  const [userPos, setUserPos] = React.useState<{
    lat: number;
    lng: number;
  } | null>(null);
  const [attendeeAvatars, setAttendeeAvatars] = React.useState<
    Record<string, { avatars: Avatar14Item[]; extra: number }>
  >({});
  const [nearbyGroups, setNearbyGroups] = React.useState<NearbyGroup[] | null>(
    null
  );
  const [loadingNearby, setLoadingNearby] = React.useState(false);

  React.useEffect(() => {
    let mounted = true;
    const supa = createClient();

    async function load() {
      try {
        setLoadingGroups(true);
        const { data: auth } = await supa.auth.getUser();
        const uid = auth?.user?.id || null;
        if (!uid) {
          if (mounted) setMyGroups([]);
          return;
        }

        // Host groups
        const { data: hostGroups, error: hostErr } = await supa
          .from("groups")
          .select(
            "id, host_id, cohost_ids, title, start_time, cover_image_url, status, location_lat, location_lng, group_categories(name)"
          )
          .in("status", ["active", "in_progress"])
          .eq("host_id", uid);
        if (hostErr) {
          // eslint-disable-next-line no-console
          console.warn("[Groups] host fetch error", hostErr);
        }

        // Co-host groups
        const { data: cohostGroups, error: coErr } = await supa
          .from("groups")
          .select(
            "id, host_id, cohost_ids, title, start_time, cover_image_url, status, location_lat, location_lng, group_categories(name)"
          )
          .in("status", ["active", "in_progress"])
          .contains("cohost_ids", [uid]);
        if (coErr) {
          // eslint-disable-next-line no-console
          console.warn("[Groups] cohost fetch error", coErr);
        }

        // Accepted attendee groups
        const { data: attendeeRows, error: attErr } = await supa
          .from("group_attendees")
          .select(
            "group_id, status, groups:groups!inner(id, host_id, cohost_ids, title, start_time, cover_image_url, status, location_lat, location_lng, group_categories(name))"
          )
          .eq("user_id", uid)
          .eq("status", "accepted")
          .in("groups.status", ["active", "in_progress"]);
        if (attErr) {
          // eslint-disable-next-line no-console
          console.warn("[Groups] attendee fetch error", attErr);
        }

        const palette = [
          "bg-emerald-200",
          "bg-amber-200",
          "bg-pink-200",
          "bg-sky-200",
          "bg-violet-200",
          "bg-blue-200",
        ];

        // Merge, prefer hosting over attending for duplicates
        const byId = new Map<string, MyGroupCard>();

        (hostGroups || []).forEach((g, i) => {
          if (!g?.id) return;
          byId.set(g.id, {
            id: g.id,
            name: g.title || "Untitled group",
            nextDate: g.start_time || null,
            status: "hosting",
            cover_image_url: g.cover_image_url || null,
            categoryName: (g as any)?.group_categories?.name ?? null,
            host_id: (g as any)?.host_id ?? null,
            cohost_ids: Array.isArray((g as any)?.cohost_ids)
              ? (g as any).cohost_ids
              : [],
            location_lat:
              typeof g.location_lat === "number" ? g.location_lat : null,
            location_lng:
              typeof g.location_lng === "number" ? g.location_lng : null,
            distanceKm: null,
            colorClass: palette[i % palette.length],
          });
        });

        (cohostGroups || []).forEach((g, i) => {
          if (!g?.id) return;
          if (!byId.has(g.id)) {
            byId.set(g.id, {
              id: g.id,
              name: g.title || "Untitled group",
              nextDate: g.start_time || null,
              status: "co-hosting",
              cover_image_url: g.cover_image_url || null,
              categoryName: (g as any)?.group_categories?.name ?? null,
              host_id: (g as any)?.host_id ?? null,
              cohost_ids: Array.isArray((g as any)?.cohost_ids)
                ? (g as any).cohost_ids
                : [],
              location_lat:
                typeof g.location_lat === "number" ? g.location_lat : null,
              location_lng:
                typeof g.location_lng === "number" ? g.location_lng : null,
              distanceKm: null,
              colorClass: palette[i % palette.length],
            });
          }
        });

        (attendeeRows || []).forEach((r: any, i: number) => {
          const g = r?.groups;
          if (!g?.id) return;
          if (byId.has(g.id)) return;
          byId.set(g.id, {
            id: g.id,
            name: g.title || "Untitled group",
            nextDate: g.start_time || null,
            status: "attending",
            cover_image_url: g.cover_image_url || null,
            categoryName: g.group_categories?.name ?? null,
            host_id: (g as any)?.host_id ?? null,
            cohost_ids: Array.isArray((g as any)?.cohost_ids)
              ? (g as any).cohost_ids
              : [],
            location_lat:
              typeof g.location_lat === "number" ? g.location_lat : null,
            location_lng:
              typeof g.location_lng === "number" ? g.location_lng : null,
            distanceKm: null,
            colorClass: palette[i % palette.length],
          });
        });

        const list: MyGroupCard[] = Array.from(byId.values());

        // Compute distances if we have a user position already
        if (userPos) {
          list.forEach((g) => {
            if (
              typeof g.location_lat === "number" &&
              typeof g.location_lng === "number"
            ) {
              g.distanceKm = haversineKm(userPos, {
                lat: g.location_lat,
                lng: g.location_lng,
              });
            } else {
              g.distanceKm = null;
            }
          });
        }

        // Chronological order
        list.sort((a, b) => {
          const ta = a.nextDate ? Date.parse(a.nextDate) : NaN;
          const tb = b.nextDate ? Date.parse(b.nextDate) : NaN;
          const aValid = Number.isFinite(ta);
          const bValid = Number.isFinite(tb);
          if (aValid && bValid) return ta - tb;
          if (aValid && !bValid) return -1;
          if (!aValid && bValid) return 1;
          return 0;
        });

        if (mounted) setMyGroups(list);

        // Build avatar stacks: host, co-hosts, accepted attendees
        try {
          const groupIds = list.map((g) => g.id);
          if (groupIds.length) {
            // Accepted attendees with profiles
            const { data: att, error: attErr2 } = await supa
              .from("group_attendees")
              .select(
                "group_id, user_id, profiles:profiles!inner(id, avatar_url, profile_title, name)"
              )
              .in("group_id", groupIds)
              .eq("status", "accepted");

            // Collect hosts and cohosts
            const hostIds = new Set<string>();
            const cohostIds = new Set<string>();
            for (const g of list) {
              if (g.host_id) hostIds.add(g.host_id);
              if (Array.isArray(g.cohost_ids)) {
                for (const cid of g.cohost_ids) cohostIds.add(String(cid));
              }
            }
            const needIds = Array.from(
              new Set<string>([...hostIds, ...cohostIds])
            );

            // Fetch host and cohost profiles
            let hostCohostProfiles: any[] = [];
            if (needIds.length) {
              const { data: profs, error: profErr } = await supa
                .from("profiles")
                .select("id, avatar_url, profile_title, name")
                .in("id", needIds);
              if (!profErr && Array.isArray(profs)) hostCohostProfiles = profs;
            }

            // Index attendees by group
            const byGroup: Record<string, any[]> = {};
            if (!attErr2 && Array.isArray(att)) {
              for (const row of att) {
                const gid = row.group_id as string;
                if (!byGroup[gid]) byGroup[gid] = [];
                byGroup[gid].push(row);
              }
            }

            // Build ordered stacks
            const map: Record<
              string,
              { avatars: Avatar14Item[]; extra: number }
            > = {};

            for (const g of list) {
              const items: Avatar14Item[] = [];
              const seen = new Set<string>();

              // Host
              if (g.host_id) {
                const hp = hostCohostProfiles.find((p) => p.id === g.host_id);
                const name = hp?.profile_title || hp?.name || "";
                items.push({
                  src: resolveAvatarUrl(hp?.avatar_url),
                  name,
                  fallback: initials(name),
                });
                seen.add(g.host_id);
              }

              // Co-hosts
              const coh = Array.isArray(g.cohost_ids) ? g.cohost_ids : [];
              for (const cid of coh) {
                const cp = hostCohostProfiles.find((p) => p.id === cid);
                if (!cp || seen.has(String(cid))) continue;
                const name = cp?.profile_title || cp?.name || "";
                items.push({
                  src: resolveAvatarUrl(cp?.avatar_url),
                  name,
                  fallback: initials(name),
                });
                seen.add(String(cid));
              }

              // Attendees
              const attRows = byGroup[g.id] || [];
              for (const r of attRows) {
                const uid = r?.profiles?.id as string | undefined;
                if (!uid || seen.has(uid)) continue;
                const prof = r.profiles || {};
                const name = prof.profile_title || prof.name || "";
                items.push({
                  src: resolveAvatarUrl(prof.avatar_url),
                  name,
                  fallback: initials(name),
                });
                seen.add(uid);
              }

              const avatars = items.slice(0, 5);
              const extra = Math.max(0, items.length - avatars.length);
              map[g.id] = { avatars, extra };
            }

            if (mounted) setAttendeeAvatars(map);
          }
        } catch (e) {
          // eslint-disable-next-line no-console
          console.warn("[Groups] avatars preload error", e);
        }
      } finally {
        if (mounted) setLoadingGroups(false);
      }
    }

    load();

    if (typeof window !== "undefined" && navigator?.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setUserPos({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        },
        () => {
          // ignore
        },
        { enableHighAccuracy: false, timeout: 5000, maximumAge: 60_000 }
      );
    }
    return () => {
      mounted = false;
    };
  }, []);

  React.useEffect(() => {
    if (!userPos || !Array.isArray(myGroups)) return;
    setMyGroups((prev) => {
      if (!prev) return prev;
      return prev.map((g) => {
        if (
          typeof g.location_lat === "number" &&
          typeof g.location_lng === "number"
        ) {
          return {
            ...g,
            distanceKm: haversineKm(userPos, {
              lat: g.location_lat,
              lng: g.location_lng,
            }),
          };
        }
        return { ...g, distanceKm: null };
      });
    });
  }, [userPos]);

  function sameDay(a?: string | Date | null, b?: Date | null) {
    if (!a || !b) return false;
    const da = typeof a === "string" ? new Date(a) : a;
    const db = b;
    return (
      da.getFullYear() === db.getFullYear() &&
      da.getMonth() === db.getMonth() &&
      da.getDate() === db.getDate()
    );
  }

  function formatStartTime(dateStr?: string | null): {
    big: string;
    small: string;
  } {
    if (!dateStr) return { big: "--", small: "Starts" };
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return { big: "--", small: "Starts" };
    let h = d.getHours();
    const m = d.getMinutes();
    const ampm = h >= 12 ? "pm" : "am";
    h = h % 12;
    if (h === 0) h = 12;
    const big =
      m === 0 ? `${h}${ampm}` : `${h}:${String(m).padStart(2, "0")}${ampm}`;
    return { big, small: "Starts" };
  }

  const groupsByDay: MyGroupCard[][] = upcomingDays.map((d) => {
    if (!Array.isArray(myGroups)) return [];
    return myGroups.filter((g) => g.nextDate && sameDay(g.nextDate, d));
  });

  const groupsForSelectedDay: MyGroupCard[] =
    groupsByDay[selectedDayIndex] ?? [];

  const involvedIds = React.useMemo(
    () => new Set((myGroups || []).map((g) => g.id)),
    [myGroups]
  );

  // Load public nearby groups and compute distances
  React.useEffect(() => {
    let mounted = true;
    const supa = createClient();

    async function loadNearby() {
      try {
        setLoadingNearby(true);
        const { data } = await supa
          .from("groups")
          .select(
            `id, title, start_time, cover_image_url, is_public, status, location_lat, location_lng, group_categories(name)`
          )
          .in("status", ["active", "in_progress"]) // live groups only
          .eq("is_public", true)
          .not("location_lat", "is", null)
          .not("location_lng", "is", null)
          .limit(30);

        let list: NearbyGroup[] = (data || []).map((g: any) => ({
          id: g.id,
          name: g.title || "Untitled group",
          start_time: g.start_time || null,
          cover_image_url: g.cover_image_url || null,
          categoryName: g.group_categories?.name ?? null,
          location_lat:
            typeof g.location_lat === "number" ? g.location_lat : null,
          location_lng:
            typeof g.location_lng === "number" ? g.location_lng : null,
          distanceKm: null,
        }));

        if (userPos) {
          list = list.map((g) => {
            if (
              typeof g.location_lat === "number" &&
              typeof g.location_lng === "number"
            ) {
              return {
                ...g,
                distanceKm: haversineKm(userPos, {
                  lat: g.location_lat!,
                  lng: g.location_lng!,
                }),
              };
            }
            return { ...g, distanceKm: null };
          });
        }

        list.sort((a, b) => {
          const da = a.distanceKm ?? Number.POSITIVE_INFINITY;
          const db = b.distanceKm ?? Number.POSITIVE_INFINITY;
          if (da !== db) return da - db;
          const ta = a.start_time
            ? Date.parse(a.start_time)
            : Number.POSITIVE_INFINITY;
          const tb = b.start_time
            ? Date.parse(b.start_time)
            : Number.POSITIVE_INFINITY;
          return ta - tb;
        });

        if (mounted) setNearbyGroups(list);
      } finally {
        if (mounted) setLoadingNearby(false);
      }
    }

    loadNearby();
    return () => {
      mounted = false;
    };
    // Only run initially and whenever userPos changes so we can compute distance
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userPos]);

  // Recompute distances for already-loaded nearby groups when userPos changes
  React.useEffect(() => {
    if (!userPos || !Array.isArray(nearbyGroups)) return;
    setNearbyGroups((prev) => {
      if (!prev) return prev;
      return prev.map((g) => {
        if (
          typeof g.location_lat === "number" &&
          typeof g.location_lng === "number"
        ) {
          return {
            ...g,
            distanceKm: haversineKm(userPos, {
              lat: g.location_lat!,
              lng: g.location_lng!,
            }),
          };
        }
        return { ...g, distanceKm: null };
      });
    });
  }, [userPos]);

  return (
    <>
      {/* Your groups section */}
      <section className="mt-4">
        <div className="px-1 mb-3 flex items-center justify-between">
          <h3 className="text-lg font-semibold">Your groups</h3>
          <Link
            href="/app/activity/groups/create"
            aria-label="Host a new group or event"
          >
            <Button variant="ghost" size="sm" className="rounded-full gap-2">
              <Plus className="h-4 w-4" />
              Host
            </Button>
          </Link>
        </div>
        <div className="flex gap-3 overflow-x-auto -mx-4 px-4 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
          {Array.isArray(myGroups) && myGroups.length > 0 ? (
            myGroups.map((g) => {
              const md = monthDay(g.nextDate);
              return (
                <Link
                  key={g.id}
                  href={`/app/activity/group/${g.id}`}
                  className="flex flex-col items-start gap-2"
                >
                  <div className="relative w-48 aspect-4/3 rounded-xl bg-muted flex items-center justify-center text-sm font-medium text-muted-foreground shrink-0">
                    {/* Square thumb area uses cover image or fallback color */}
                    <div className="absolute inset-0 rounded-lg overflow-hidden bg-muted">
                      {g.cover_image_url ? (
                        <Image
                          src={resolveCoverUrl(g.cover_image_url)!}
                          alt={g.name}
                          fill
                          sizes="(max-width: 768px) 192px, 192px"
                          className="absolute inset-0 object-cover"
                          priority={false}
                          loading="lazy"
                          unoptimized
                        />
                      ) : (
                        <div className={`absolute inset-0 ${g.colorClass}`} />
                      )}
                      <div className="pointer-events-none absolute inset-0 rounded-lg bg-[radial-gradient(ellipse_at_center,rgba(0,0,0,0)_55%,rgba(0,0,0,0.35)_100%)]" />
                    </div>

                    {/* Date badge */}
                    <div className="absolute -top-2 -right-2 bg-card text-card-foreground rounded-full h-10 w-10 flex flex-col items-center justify-center shadow-md">
                      <span className="text-xs font-bold leading-tight">
                        {md.day || "--"}
                      </span>
                      <span className="text-[10px] font-light tracking-tight">
                        {md.month.toUpperCase()}
                      </span>
                    </div>

                    {/* Status dot and label */}
                    <div className="absolute bottom-2 left-2 flex items-center gap-1">
                      {(() => {
                        const s = (g.status || "").toLowerCase();
                        const dotClass =
                          s === "hosting"
                            ? "bg-red-500"
                            : s === "co-hosting" || s === "cohosting"
                            ? "bg-orange-500"
                            : "bg-blue-500";
                        const label =
                          s === "hosting"
                            ? "Hosting"
                            : s === "co-hosting" || s === "cohosting"
                            ? "Co-hosting"
                            : "Attending";
                        return (
                          <>
                            <span
                              className={`block h-2.5 w-2.5 rounded-full ${dotClass}`}
                            />
                            <span className="text-[10px] font-medium text-foreground opacity-90 drop-shadow-[0_1px_1px_rgba(0,0,0,0.8)]">
                              {label}
                            </span>
                          </>
                        );
                      })()}
                    </div>
                  </div>
                  <p className="text-sm text-foreground w-48 truncate">
                    {g.name}
                  </p>
                </Link>
              );
            })
          ) : loadingGroups ? (
            <div className="flex gap-3 overflow-x-auto -mx-4 px-4 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
              {[...Array(3)].map((_, i) => (
                <div
                  key={i}
                  className="flex flex-col items-start gap-2 animate-pulse shrink-0 w-48"
                >
                  <div className="relative w-48 aspect-4/3 rounded-xl bg-muted/40" />
                  <div className="h-3 w-3/4 bg-muted/40 rounded" />
                  <div className="h-3 w-1/2 bg-muted/40 rounded" />
                </div>
              ))}
            </div>
          ) : (
            <div className="w-full py-6">
              <Empty>
                <EmptyHeader>
                  <EmptyMedia variant="icon">
                    <Users className="h-6 w-6" />
                  </EmptyMedia>
                  <EmptyTitle>No groups yet</EmptyTitle>
                  <EmptyDescription>
                    You aren’t hosting or attending any groups yet. Create one
                    to get started.
                  </EmptyDescription>
                </EmptyHeader>
                <EmptyContent>
                  <Link href="/app/activity/groups/create">
                    <Button variant="secondary" size="sm">
                      <Plus className="h-4 w-4 mr-2" />
                      Host a group
                    </Button>
                  </Link>
                </EmptyContent>
              </Empty>
            </div>
          )}
        </div>
      </section>

      {/* Upcoming section */}
      <section className="mt-8">
        {/* Dark summary card */}
        <div className="relative rounded-2xl bg-foreground/90 text-background p-4 shadow-[0_20px_40px_-15px_rgba(0,0,0,0.35)]">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-xl tracking-tight">Upcoming</h2>
              <p className="text-sm/6 opacity-70">In the next 2 weeks</p>
            </div>
            <button
              className="opacity-60 hover:opacity-100"
              aria-label="More options"
            >
              <MoreHorizontal className="h-5 w-5" />
            </button>
          </div>
          {/* Calendar dots row */}
          <div className="mt-6 grid grid-cols-7 gap-2 place-items-center">
            {upcomingDays.map((date, index) => (
              <button
                key={date.toISOString()}
                onClick={() => setSelectedDayIndex(index)}
                className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-medium ${
                  index === selectedDayIndex
                    ? "bg-background text-foreground ring-2 ring-background/80"
                    : "bg-background/10 text-background/80"
                }`}
                aria-pressed={index === selectedDayIndex}
              >
                {date.getDate()}
              </button>
            ))}
          </div>
        </div>

        {/* List below with soft cards */}
        <div className="mt-4 space-y-3">
          {(() => {
            const visibleCount = visiblePerDay[selectedDayIndex] ?? 5;
            const toRender = groupsForSelectedDay.slice(0, visibleCount);
            return (
              <>
                {groupsForSelectedDay.length === 0 ? (
                  <div className="w-full py-4">
                    <Empty>
                      <EmptyHeader>
                        <EmptyMedia variant="icon">
                          <Users className="h-6 w-6" />
                        </EmptyMedia>
                        <EmptyTitle>No groups this day</EmptyTitle>
                        <EmptyDescription>
                          Pick another date or create a new group for this day.
                        </EmptyDescription>
                      </EmptyHeader>
                    </Empty>
                  </div>
                ) : (
                  <>
                    {toRender.map((g) => {
                      return (
                        <Link
                          key={g.id}
                          href={`/app/activity/group/${g.id}`}
                          className="rounded-xl border bg-card text-card-foreground px-3 py-3 flex items-center gap-3"
                        >
                          {/* Left circular distance badge (computed) */}
                          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted shrink-0">
                            {(() => {
                              const km =
                                typeof g.distanceKm === "number"
                                  ? g.distanceKm
                                  : null;
                              const num =
                                km != null
                                  ? km < 10
                                    ? km.toFixed(1)
                                    : Math.round(km).toString()
                                  : "--";
                              return (
                                <div className="text-center leading-tight">
                                  <div className="text-sm font-semibold">
                                    {num}
                                  </div>
                                  <div className="text-[10px] text-muted-foreground">
                                    km
                                  </div>
                                </div>
                              );
                            })()}
                          </div>

                          {/* Square thumb with cover image (fallback to color) */}
                          <div className="relative h-10 w-10 rounded-lg overflow-hidden bg-muted shrink-0">
                            {g.cover_image_url ? (
                              <Image
                                src={resolveCoverUrl(g.cover_image_url)!}
                                alt={g.name}
                                fill
                                sizes="(max-width: 768px) 40px, 40px"
                                className="absolute inset-0 object-cover"
                                priority={false}
                                loading="lazy"
                                unoptimized
                              />
                            ) : (
                              <div
                                className={`absolute inset-0 ${g.colorClass}`}
                              />
                            )}
                          </div>

                          {/* Content: name + attendees preview */}
                          <div className="min-w-0 flex-1">
                            <p className="font-medium truncate">{g.name}</p>
                            <div className="mt-1 flex items-center">
                              <Avatar14
                                avatars={attendeeAvatars[g.id]?.avatars || []}
                                extraCount={attendeeAvatars[g.id]?.extra || 0}
                              />
                            </div>
                          </div>

                          {/* Right action: tick if involved, else circle + User */}
                          {involvedIds.has(g.id) ? (
                            <div className="h-5 w-5 rounded-full bg-green-200 flex items-center justify-center">
                              <svg
                                xmlns="http://www.w3.org/2000/svg"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="3"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                className="h-3.5 w-3.5 text-green-700"
                              >
                                <polyline points="20 6 9 17 4 12" />
                              </svg>
                            </div>
                          ) : (
                            <button
                              type="button"
                              className="h-7 w-7 rounded-full border border-muted-foreground/20 bg-muted flex items-center justify-center text-muted-foreground"
                              aria-label="User"
                              onClick={(e) => e.preventDefault()}
                            >
                              <User className="h-4 w-4" />
                            </button>
                          )}
                        </Link>
                      );
                    })}
                    {groupsForSelectedDay.length >
                    (visiblePerDay[selectedDayIndex] ?? 5) ? (
                      <div className="pt-2">
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() =>
                            setVisiblePerDay((prev) =>
                              prev.map((n, i) =>
                                i === selectedDayIndex ? n + 5 : n
                              )
                            )
                          }
                        >
                          Load more
                        </Button>
                      </div>
                    ) : null}
                  </>
                )}
              </>
            );
          })()}
        </div>
      </section>

      {/* Nearby groups */}
      <section className="mt-8">
        <h3 className="text-lg font-semibold px-1 mb-3">Nearby groups</h3>
        <div className="space-y-3">
          {Array.isArray(nearbyGroups) ? (
            nearbyGroups.length > 0 ? (
              nearbyGroups.slice(0, 10).map((g) => {
                const km =
                  typeof g.distanceKm === "number" ? g.distanceKm : null;
                const num =
                  km != null
                    ? km < 10
                      ? km.toFixed(1)
                      : Math.round(km).toString()
                    : "--";
                return (
                  <Link
                    key={g.id}
                    href={`/app/activity/group/${g.id}`}
                    className="rounded-xl border bg-card text-card-foreground px-3 py-3 flex items-center gap-3"
                  >
                    {/* Left circular distance badge */}
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted shrink-0">
                      <div className="text-center leading-tight">
                        <div className="text-sm font-semibold">{num}</div>
                        <div className="text-[10px] text-muted-foreground">
                          km
                        </div>
                      </div>
                    </div>

                    {/* Square thumb with cover image if present */}
                    <div className="relative h-10 w-10 rounded-lg overflow-hidden bg-muted shrink-0">
                      {g.cover_image_url ? (
                        <Image
                          src={resolveCoverUrl(g.cover_image_url)!}
                          alt={g.name}
                          fill
                          sizes="(max-width: 768px) 40px, 40px"
                          className="absolute inset-0 object-cover"
                          priority={false}
                          loading="lazy"
                          unoptimized
                        />
                      ) : (
                        <div className="absolute inset-0 bg-muted" />
                      )}
                    </div>

                    {/* Content: name (truncate) */}
                    <div className="min-w-0 flex-1">
                      <p className="font-medium truncate">{g.name}</p>
                    </div>

                    {/* Right action: tick if involved, else circle + User */}
                    {involvedIds.has(g.id) ? (
                      <div className="h-5 w-5 rounded-full bg-green-200 flex items-center justify-center">
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="3"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          className="h-3.5 w-3.5 text-green-700"
                        >
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                      </div>
                    ) : (
                      <button
                        type="button"
                        className="h-7 w-7 rounded-full border border-muted-foreground/20 bg-muted flex items-center justify-center text-muted-foreground"
                        aria-label="User"
                        onClick={(e) => e.preventDefault()}
                      >
                        <User className="h-4 w-4" />
                      </button>
                    )}
                  </Link>
                );
              })
            ) : (
              <div className="w-full py-4">
                <Empty>
                  <EmptyHeader>
                    <EmptyMedia variant="icon">
                      <Users className="h-6 w-6" />
                    </EmptyMedia>
                    <EmptyTitle>No nearby groups</EmptyTitle>
                    <EmptyDescription>
                      We couldn't find any public groups near you.
                    </EmptyDescription>
                  </EmptyHeader>
                </Empty>
              </div>
            )
          ) : (
            <div className="space-y-3">
              {[0, 1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="rounded-xl border bg-card px-3 py-3 flex items-center gap-3 animate-pulse"
                >
                  <div className="h-12 w-12 rounded-full bg-muted/40" />
                  <div className="h-10 w-10 rounded-lg bg-muted/40" />
                  <div className="flex-1 space-y-2">
                    <div className="h-3 w-1/2 bg-muted/40 rounded" />
                    <div className="h-3 w-1/3 bg-muted/40 rounded" />
                  </div>
                  <div className="h-7 w-7 rounded-full bg-muted/40" />
                </div>
              ))}
            </div>
          )}
        </div>
      </section>
    </>
  );
}
