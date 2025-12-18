"use client";

import * as React from "react";
import { Plus, MapPin, Clock, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { useRouter } from "next/navigation";
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
  colorClass: string;
  cover_image_url?: string | null;
  categoryName?: string | null;
  distanceKm?: number | null;
  host_id?: string | null;
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
  location_lat?: number | null;
  location_lng?: number | null;
};

function resolveCoverUrl(path?: string | null): string | undefined {
  if (!path) return undefined;
  const s = String(path);
  if (s.startsWith("http://") || s.startsWith("https://")) return s;
  return `/api/groups/storage?path=${encodeURIComponent(s.replace(/^\//, ""))}`;
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
}

function GroupCard({ group, isMyGroup = false, onClick }: GroupCardProps) {
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
    <Card
      className="overflow-hidden cursor-pointer hover:shadow-lg transition-shadow"
      onClick={onClick}
    >
      {coverUrl && (
        <div className="relative h-32 w-full overflow-hidden bg-muted">
          <img
            src={coverUrl}
            alt={groupName}
            className="h-full w-full object-cover"
            onError={(e) => {
              (e.currentTarget as HTMLImageElement).style.display = "none";
            }}
          />
        </div>
      )}
      <CardHeader className={coverUrl ? "pb-2" : ""}>
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1">
            <CardTitle className="line-clamp-2">{groupName}</CardTitle>
            {group.categoryName && (
              <CardDescription className="mt-1">
                {group.categoryName}
              </CardDescription>
            )}
          </div>
          {isMyGroup && (group as MyGroupCard).membershipStatus && (
            <Badge
              variant={membershipBadgeVariant(
                (group as MyGroupCard).membershipStatus
              )}
            >
              {membershipLabel((group as MyGroupCard).membershipStatus)}
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        {dateStr && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Clock className="h-4 w-4" />
            <span>{formatDateShort(dateStr)}</span>
            <span className="text-xs">{formatTime(dateStr)}</span>
          </div>
        )}
        {group.distanceKm !== undefined && group.distanceKm !== null && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <MapPin className="h-4 w-4" />
            <span>{group.distanceKm.toFixed(1)}km away</span>
          </div>
        )}
        {!isFutureEvent && dateStr && (
          <Badge variant="destructive" className="w-fit">
            In Progress
          </Badge>
        )}
      </CardContent>
    </Card>
  );
}

export default function ActivityGroupsPage() {
  const router = useRouter();
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
        setMyGroups(data.groups || []);
        setNearbyGroups(data.listings || []);
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
  const upcomingGroups = React.useMemo(
    () =>
      myGroups?.filter(
        (g) => isFuture(g.nextDate) && g.lifecycleStatus !== "in_progress"
      ) || [],
    [myGroups]
  );

  const inProgressGroups = React.useMemo(
    () =>
      myGroups?.filter(
        (g) =>
          g.lifecycleStatus === "in_progress" ||
          isCurrentlyHappening(g.nextDate)
      ) || [],
    [myGroups]
  );

  const availableNearbyGroups = React.useMemo(
    () =>
      nearbyGroups?.filter(
        (g) => isFuture(g.start_time) && g.lifecycleStatus !== "in_progress"
      ) || [],
    [nearbyGroups]
  );

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-center justify-between px-1">
        <h1 className="text-4xl font-extrabold tracking-tight">Groups</h1>
        <div className="inline-flex w-fit -space-x-px rounded-md shadow-xs">
          <Button
            variant="secondary"
            className="rounded-none rounded-l-md shadow-none focus-visible:z-10"
            size="sm"
            asChild
          >
            <Link href="/app/activity/groups/manage">Manage</Link>
          </Button>
          <Button
            variant="secondary"
            className="rounded-none rounded-r-md shadow-none focus-visible:z-10"
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

      {error && (
        <div className="rounded-lg bg-destructive/10 p-4 text-sm text-destructive">
          {error}
        </div>
      )}

      {/* Upcoming Groups - Horizontal Scrolling */}
      {upcomingGroups.length > 0 && (
        <section className="space-y-3">
          <p className="px-1 text-xs font-semibold tracking-wider text-muted-foreground uppercase mb-3">
            Upcoming groups
          </p>
          <GroupScrolling groups={upcomingGroups} avatarStacks={avatarStacks} />
        </section>
      )}

      {upcomingGroups.length === 0 && (
        <Empty>
          <EmptyHeader>
            <EmptyTitle>No Upcoming Groups</EmptyTitle>
            <EmptyDescription>
              Create a new group or join one nearby to get started
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      )}

      {/* In Progress Groups */}
      {inProgressGroups.length > 0 && (
        <section className="space-y-3">
          <div className="flex items-center gap-2 px-1">
            <Users className="h-5 w-5" />
            <h2 className="text-xl font-bold">In Progress</h2>
            <Badge variant="secondary">{inProgressGroups.length}</Badge>
          </div>
          <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
            {inProgressGroups.map((group) => (
              <GroupCard
                key={group.id}
                group={group}
                isMyGroup
                onClick={() => router.push(`/app/groups/${group.id}`)}
              />
            ))}
          </div>
        </section>
      )}

      {/* Nearby Groups */}
      <section className="space-y-3">
        <p className="px-1 text-xs font-semibold tracking-wider text-muted-foreground uppercase mb-3">
          Nearby groups
        </p>
        {availableNearbyGroups.length > 0 ? (
          <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
            {availableNearbyGroups.map((group) => (
              <GroupCard
                key={group.id}
                group={group}
                onClick={() => router.push(`/app/groups/${group.id}`)}
              />
            ))}
          </div>
        ) : (
          <NearbyGroupsMap groups={nearbyGroups || []} />
        )}
      </section>
    </div>
  );
}
