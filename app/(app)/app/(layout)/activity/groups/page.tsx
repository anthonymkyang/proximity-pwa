"use client";

import * as React from "react";
import { Plus, MapPin, Clock, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import Avatar14 from "@/components/shadcn-studio/avatar/avatar-14";
import { GroupScrolling } from "@/components/activity/groups/listing/GroupScrolling";
import { NearbyGroupsMap } from "@/components/activity/groups/NearbyGroupsMap";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty";

type MyGroupCard = {
  id: string;
  title: string;
  name?: string; // API might use name instead of title
  nextDate: string | null; // from API
  membershipStatus: "hosting" | "co-hosting" | "attending";
  lifecycleStatus: "active" | "in_progress" | null;
  status?: string; // <-- Add this line to match API and fix TS error
  live?: boolean; // Added to support live status
  colorClass: string;
  cover_image_url?: string | null;
  categoryName?: string | null;
  distanceKm?: number | null;
  host_id?: string | null;
  hostProfile?: {
    name: string | null;
    avatar_url: string | null;
  } | null;
};

type NearbyGroup = {
  id: string;
  name: string;
  title?: string; // Some endpoints might use title
  start_time: string | null;
  cover_image_url?: string | null;
  categoryName?: string | null;
  distanceKm?: number | null;
  lifecycleStatus?: "active" | "in_progress" | null;
  live?: boolean; // Added to support live status
  location_lat?: number | null;
  location_lng?: number | null;
};

function resolveCoverUrl(path?: string | null): string | undefined {
  if (!path) return undefined;
  const s = String(path);
  if (s.startsWith("http://") || s.startsWith("https://")) return s;
  return `/api/groups/storage?path=${encodeURIComponent(s.replace(/^\//, ""))}`;
}

function resolveAvatarUrl(path?: string | null): string | undefined {
  if (!path) return undefined;
  const s = String(path);
  if (s.startsWith("http://") || s.startsWith("https://")) return s;
  return `/api/photos/avatars?path=${encodeURIComponent(s)}`;
}

function formatDateShort(dateStr?: string | null): string {
  if (!dateStr) return "Date TBC";
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return "Date TBC";
  return d.toLocaleDateString(undefined, {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

function formatTime(dateStr?: string | null): string {
  if (!dateStr) return "TBD";
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return "TBD";
  let h = d.getHours();
  const m = d.getMinutes();
  const ampm = h >= 12 ? "pm" : "am";
  h = h % 12;
  if (h === 0) h = 12;
  if (m === 0) return `${h}${ampm}`;
  return `${h}:${String(m).padStart(2, "0")}${ampm}`;
}

function isFuture(dateStr?: string | null): boolean {
  if (!dateStr) return false;
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return false;
  return d.getTime() > Date.now();
}

function isCurrentlyHappening(dateStr?: string | null): boolean {
  if (!dateStr) return false;
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return false;
  const now = Date.now();
  // Consider a group as happening if start time is within last 4 hours and not more than 4 hours in the future
  // This accounts for variable group durations
  const fourHoursInMs = 4 * 60 * 60 * 1000;
  const eventTime = d.getTime();
  return eventTime <= now + fourHoursInMs && eventTime > now - fourHoursInMs;
}

function membershipLabel(status: string) {
  if (status === "hosting") return "Hosting";
  if (status === "co-hosting") return "Co-hosting";
  return "Attending";
}

function membershipBadgeVariant(status: string) {
  if (status === "hosting") return "default";
  if (status === "co-hosting") return "secondary";
  return "outline";
}

interface GroupCardProps {
  group: MyGroupCard | NearbyGroup;
  isMyGroup?: boolean;
  onClick?: () => void;
  avatarStacks?: Record<
    string,
    {
      avatars: { src?: string; name?: string; fallback?: string }[];
      extra: number;
    }
  >;
}

function GroupCard({
  group,
  isMyGroup = false,
  onClick,
  avatarStacks,
}: GroupCardProps) {
  const coverUrl = resolveCoverUrl(group.cover_image_url);
  const dateStr = isMyGroup
    ? (group as MyGroupCard).nextDate
    : (group as NearbyGroup).start_time;
  // Handle both 'name' and 'title' fields
  const groupName = isMyGroup
    ? (group as MyGroupCard).title || (group as MyGroupCard).name
    : (group as NearbyGroup).name || (group as NearbyGroup).title;
  const isFutureEvent = isFuture(dateStr);

  return (
    <div
      className="overflow-hidden cursor-pointer transition-shadow bg-transparent border-0 shadow-none hover:shadow-none"
      onClick={onClick}
    >
      <div className="relative mb-3 aspect-14/9 w-full overflow-hidden rounded-xl bg-card/60">
        {coverUrl && (
          <img
            src={coverUrl}
            alt={groupName}
            className="h-full w-full object-cover shadow-3xl"
            onError={(e) => {
              (e.currentTarget as HTMLImageElement).style.display = "none";
            }}
          />
        )}
        <div className="absolute inset-0 bg-linear-to-t from-black/60 via-black/20 to-transparent" />
        <div
          className="absolute inset-0"
          style={{
            backgroundImage:
              "radial-gradient(ellipse at bottom left, rgba(0,0,0,0.5) 0%, rgba(0,0,0,0.2) 40%, transparent 70%)",
          }}
        />
        {group.categoryName && (
          <Badge className="absolute top-2 right-2 px-2 py-0.5 text-[10px] rounded-full bg-primary text-primary-foreground">
            {group.categoryName}
          </Badge>
        )}
        <div className="absolute left-3 right-3 bottom-3">
          {isMyGroup && (group as MyGroupCard).hostProfile && (
            <Avatar className="size-12 mb-2 border border-white/30 shadow-lg drop-shadow-3xl">
              {(group as MyGroupCard).hostProfile?.avatar_url && (
                <img
                  src={resolveAvatarUrl(
                    (group as MyGroupCard).hostProfile?.avatar_url
                  )}
                  alt={(group as MyGroupCard).hostProfile?.name || groupName}
                  className="h-full w-full object-cover"
                />
              )}
              <AvatarFallback className="text-xs font-semibold">
                {((group as MyGroupCard).hostProfile?.name || groupName)
                  ?.slice(0, 2)
                  .toUpperCase()}
              </AvatarFallback>
            </Avatar>
          )}
          <div className="flex items-center justify-between gap-2">
            <div className="text-lg font-semibold text-white drop-shadow-lg truncate flex-1">
              {groupName}
            </div>
            {avatarStacks &&
            avatarStacks[group.id] &&
            avatarStacks[group.id].avatars.length > 0 ? (
              <div className="flex -space-x-2 shrink-0">
                {avatarStacks[group.id].avatars.slice(0, 3).map((a, idx) => (
                  <Avatar
                    key={`${group.id}-av-${idx}`}
                    className="h-6 w-6 ring-1 ring-background"
                  >
                    {a.src ? (
                      <img
                        src={a.src}
                        alt={a.name || "User"}
                        className="h-full w-full object-cover rounded-full"
                      />
                    ) : null}
                    {!a.src ? (
                      <AvatarFallback className="text-[9px]">
                        {a.fallback || ""}
                      </AvatarFallback>
                    ) : null}
                  </Avatar>
                ))}
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ActivityGroupsPage() {
  const router = useRouter();
  const supabase = React.useMemo(() => createClient(), []);
  const [myGroups, setMyGroups] = React.useState<MyGroupCard[] | null>(null);
  const [nearbyGroups, setNearbyGroups] = React.useState<NearbyGroup[] | null>(
    null
  );
  const [avatarStacks, setAvatarStacks] = React.useState<
    Record<
      string,
      {
        avatars: { src?: string; name?: string; fallback?: string }[];
        extra: number;
      }
    >
  >({});
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    async function loadGroups() {
      try {
        const response = await fetch("/api/groups/activity");
        if (!response.ok) throw new Error("Failed to load groups");

        const data = await response.json();
        // Debug log for raw API response
        // eslint-disable-next-line no-console
        console.log("[Groups Debug] API response:", data);
        const myGroupsList = data.groups || [];

        // Normalize my groups to always have nextDate populated (fallback to start_time)
        const normalizedMyGroups = myGroupsList.map((g: any) => ({
          ...g,
          title: g.title || g.name || "Untitled group",
          nextDate:
            g?.nextDate ||
            g?.start_time ||
            g?.startDate ||
            g?.startTime ||
            null,
        }));
        const listings = data.listings || [];

        // Add any live listings that aren't already in myGroups
        const myGroupIds = new Set(myGroupsList.map((g: any) => g.id));
        const liveListings = listings
          .filter((g: any) => g.live === true && !myGroupIds.has(g.id))
          .map((g: any) => ({
            ...g,
            title: g.name || g.title,
            nextDate: g.start_time,
            membershipStatus: "attending" as const,
          }));

        const allGroups = [...normalizedMyGroups, ...liveListings];

        // Sort: live groups first, then by start time (earliest first)
        allGroups.sort((a, b) => {
          const aLive = (a as any).live === true;
          const bLive = (b as any).live === true;
          if (aLive && !bLive) return -1;
          if (!aLive && bLive) return 1;

          const aTime = new Date(a.nextDate || a.start_time || 0).getTime();
          const bTime = new Date(b.nextDate || b.start_time || 0).getTime();
          return aTime - bTime;
        });

        setMyGroups(allGroups);
        setNearbyGroups(listings);
        setAvatarStacks(data.attendeeAvatars || {});
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : "An error occurred");
        setMyGroups([]);
        setNearbyGroups([]);
      }
    }

    loadGroups();
  }, []);

  // Separate my groups into categories
  const upcomingGroups = React.useMemo(() => {
    if (!myGroups) return [];
    const filtered = myGroups.filter(
      (g) => isFuture(g.nextDate) && g.status === "active"
    );
    filtered.sort((a, b) => {
      const ta = a.nextDate ? new Date(a.nextDate).getTime() : 0;
      const tb = b.nextDate ? new Date(b.nextDate).getTime() : 0;
      return ta - tb;
    });
    return filtered;
  }, [myGroups]);

  const inProgressGroups = React.useMemo(
    () => myGroups?.filter((g) => (g as any).live === true) || [],
    [myGroups]
  );

  const availableNearbyGroups = React.useMemo(
    () =>
      nearbyGroups?.filter(
        (g) => isFuture(g.start_time) && g.lifecycleStatus !== "in_progress"
      ) || [],
    [nearbyGroups]
  );

  const nextUpcomingGroup = React.useMemo(() => {
    const liveIds = new Set(inProgressGroups.map((g) => g.id));
    const notLive = upcomingGroups.filter(
      (g) => !liveIds.has(g.id) && !isCurrentlyHappening(g.nextDate)
    );
    return upcomingGroups.length ? upcomingGroups[0] : null;
  }, [upcomingGroups, inProgressGroups]);

  // Fallback: if Next up stack is empty, fetch attendees client-side (approved/accepted) + cohosts.
  React.useEffect(() => {
    async function loadNextUpAvatars() {
      if (!nextUpcomingGroup) return;
      const gid = nextUpcomingGroup.id;
      const existing = avatarStacks[gid];
      if (
        existing &&
        Array.isArray(existing.avatars) &&
        existing.avatars.length > 0
      )
        return;

      try {
        const hostId = (nextUpcomingGroup as any).host_id as string | null;
        const cohostIds: string[] = Array.isArray(
          (nextUpcomingGroup as any).cohost_ids
        )
          ? ((nextUpcomingGroup as any).cohost_ids as string[])
          : [];

        const [attRes, cohostRes] = await Promise.all([
          supabase
            .from("group_attendees")
            .select(
              `user_id, status, profile:profiles!group_attendees_user_id_fkey(id, profile_title, name, avatar_url)`
            )
            .eq("group_id", gid)
            .in("status", ["approved", "accepted"])
            .limit(30),
          cohostIds.length
            ? supabase
                .from("profiles")
                .select("id, profile_title, name, avatar_url")
                .in("id", cohostIds)
            : Promise.resolve({ data: [], error: null } as {
                data: any[] | null;
                error: any;
              }),
        ]);

        const items: { src?: string; name?: string; fallback?: string }[] = [];
        const seen = new Set<string>();

        // Include cohosts
        (cohostRes.data || []).forEach((p: any) => {
          const pid = String(p.id);
          if (!pid || seen.has(pid)) return;
          items.push({
            src: resolveAvatarUrl(p.avatar_url),
            name: p.profile_title || p.name || "",
            fallback: (p.profile_title || p.name || "")
              .toString()
              .slice(0, 2)
              .toUpperCase(),
          });
          seen.add(pid);
        });

        // Include attendees (exclude host)
        (attRes.data || []).forEach((row: any) => {
          const pid = String(row.user_id || "");
          if (!pid || seen.has(pid) || (hostId && pid === hostId)) return;
          const p = row.profile;
          items.push({
            src: resolveAvatarUrl(p?.avatar_url),
            name: (p?.profile_title || p?.name || "") as string,
            fallback: ((p?.profile_title || p?.name || "") as string)
              .slice(0, 2)
              .toUpperCase(),
          });
          seen.add(pid);
        });

        const avatars = items.slice(0, 5);
        const extra = Math.max(0, items.length - avatars.length);
        if (avatars.length > 0 || existing) {
          setAvatarStacks((prev) => ({ ...prev, [gid]: { avatars, extra } }));
        }
      } catch (e) {
        console.warn("[activity/groups] next up avatars fallback failed", e);
      }
    }

    loadNextUpAvatars();
  }, [nextUpcomingGroup, supabase]);

  return (
    <div className="flex flex-col gap-6 pb-[calc(72px+env(safe-area-inset-bottom))]">
      <div className="flex items-center justify-between px-4">
        <h1 className="text-4xl font-extrabold tracking-tight">Groups</h1>
        <div className="inline-flex w-fit gap-2">
          <Button
            variant="secondary"
            className="rounded-full focus-visible:z-10 backdrop-blur-2xl bg-white/10 dark:bg-white/5 border border-white/20 dark:border-white/10 shadow-[0_8px_32px_0_rgba(0,0,0,0.12)] hover:bg-white/20 dark:hover:bg-white/10 transition-all"
            size="sm"
            asChild
          >
            <Link href="/app/activity/groups/manage">Manage</Link>
          </Button>
          <Button
            variant="secondary"
            className="rounded-full focus-visible:z-10 backdrop-blur-2xl bg-white/10 dark:bg-white/5 border border-white/20 dark:border-white/10 shadow-[0_8px_32px_0_rgba(0,0,0,0.12)] hover:bg-white/20 dark:hover:bg-white/10 transition-all"
            size="sm"
            asChild
          >
            <Link href="/app/activity/groups/create">
              Host
              <Plus className="h-4 w-4 ml-2" />
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
