"use client";

import * as React from "react";
import { Home, Loader2, MoreHorizontal, Plus, Users, User } from "lucide-react";
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
import { useRouter } from "next/navigation";
import {
  Avatar14,
  type Avatar14Item,
} from "@/components/shadcn-studio/avatar/avatar-14";
import Wizard from "@/components/activity/groups/create/Wizard";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import TopBar from "@/components/nav/TopBar";
import BackButton from "@/components/ui/back-button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { updateGroup } from "@/lib/groups/client";
import { createClient } from "@/utils/supabase/client";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

type MembershipStatus = "hosting" | "co-hosting" | "attending";
type GroupLifecycleStatus = "active" | "in_progress" | null;

type MyGroupCard = {
  id: string;
  name: string;
  nextDate: string | null;
  membershipStatus: MembershipStatus;
  lifecycleStatus: GroupLifecycleStatus;
  colorClass: string;
  cover_image_url?: string | null;
  categoryName?: string | null;
  host_id?: string | null;
  cohost_ids?: string[];
  location_lat?: number | null;
  location_lng?: number | null;
  distanceKm?: number | null;
};

type NearbyGroup = {
  id: string;
  name: string;
  start_time: string | null;
  cover_image_url?: string | null;
  categoryName?: string | null;
  location_lat?: number | null;
  location_lng?: number | null;
  distanceKm?: number | null;
  lifecycleStatus?: "active" | "in_progress" | null;
};

type PendingRequest = {
  userId: string;
  name: string;
  avatarUrl: string | null;
  message: string | null;
  createdAt: string | null;
};

type ApprovedAttendee = {
  userId: string;
  name: string;
  avatarUrl: string | null;
  joinedAt: string | null;
};

type ActivityResponse = {
  groups?: MyGroupCard[];
  attendeeAvatars?: Record<string, { avatars: Avatar14Item[]; extra: number }>;
  listings?: NearbyGroup[];
};

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
  return `/api/groups/storage?path=${encodeURIComponent(s.replace(/^\//, ""))}`;
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

function isFuture(dateStr?: string | null): boolean {
  if (!dateStr) return false;
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return false;
  return d.getTime() > Date.now();
}

function minutesUntil(dateStr?: string | null): number | null {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return null;
  const diffMs = d.getTime() - Date.now();
  return diffMs / 60000;
}

function membershipLabel(status: MembershipStatus) {
  if (status === "hosting") return "Hosting";
  if (status === "co-hosting") return "Co-hosting";
  return "Attending";
}

function sameDay(dateStr?: string | null, day?: Date | null): boolean {
  if (!dateStr || !day) return false;
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return false;
  return (
    d.getFullYear() === day.getFullYear() &&
    d.getMonth() === day.getMonth() &&
    d.getDate() === day.getDate()
  );
}

function formatRequestDate(dateStr?: string | null): string {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleString(undefined, {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function GroupsNew() {
  const router = useRouter();
  const supabase = React.useMemo(() => createClient(), []);
  const [myGroups, setMyGroups] = React.useState<MyGroupCard[] | null>(null);
  const [loadingGroups, setLoadingGroups] = React.useState(false);
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
  const [markingLiveId, setMarkingLiveId] = React.useState<string | null>(null);
  const [editSheetOpen, setEditSheetOpen] = React.useState(false);
  const [editingGroupId, setEditingGroupId] = React.useState<string | null>(
    null
  );
  const [editWizardStep, setEditWizardStep] = React.useState(0);
  const [wizardBackSignal, setWizardBackSignal] = React.useState(0);
  const [requestsSheetOpen, setRequestsSheetOpen] = React.useState(false);
  const [requestsGroupId, setRequestsGroupId] = React.useState<string | null>(
    null
  );
  const [requestsLoading, setRequestsLoading] = React.useState(false);
  const [requestsError, setRequestsError] = React.useState<string | null>(null);
  const [requests, setRequests] = React.useState<PendingRequest[] | null>(null);
  const [attendeesSheetOpen, setAttendeesSheetOpen] = React.useState(false);
  const [attendeesGroupId, setAttendeesGroupId] = React.useState<string | null>(
    null
  );
  const [attendeesLoading, setAttendeesLoading] = React.useState(false);
  const [attendeesError, setAttendeesError] = React.useState<string | null>(
    null
  );
  const [attendees, setAttendees] = React.useState<ApprovedAttendee[] | null>(
    null
  );
  const upcomingDays = React.useMemo(
    () =>
      Array.from({ length: 14 }, (_, i) => {
        const d = new Date();
        d.setHours(0, 0, 0, 0);
        d.setDate(d.getDate() + i);
        return d;
      }),
    []
  );
  const [selectedHostingDayIndex, setSelectedHostingDayIndex] =
    React.useState(0);

  const openEditSheet = React.useCallback((groupId: string) => {
    setEditingGroupId(groupId);
    setEditSheetOpen(true);
    setEditWizardStep(0);
    setWizardBackSignal(0);
  }, []);

  const handleEditSheetOpenChange = React.useCallback((open: boolean) => {
    setEditSheetOpen(open);
    if (!open) {
      setEditingGroupId(null);
      setEditWizardStep(0);
      setWizardBackSignal(0);
    }
  }, []);

  const handleWizardStepChange = React.useCallback((idx: number) => {
    setEditWizardStep(idx);
  }, []);

  const handleBackButton = React.useCallback(() => {
    if (editWizardStep <= 0) {
      setEditSheetOpen(false);
    } else {
      setWizardBackSignal((v) => v + 1);
    }
  }, [editWizardStep]);

  const openRequestsSheet = React.useCallback((groupId: string) => {
    setRequestsGroupId(groupId);
    setRequestsSheetOpen(true);
  }, []);

  const handleRequestsSheetOpenChange = React.useCallback((open: boolean) => {
    setRequestsSheetOpen(open);
    if (!open) {
      setRequestsGroupId(null);
      setRequests(null);
      setRequestsError(null);
    }
  }, []);

  const openAttendeesSheet = React.useCallback((groupId: string) => {
    setAttendeesGroupId(groupId);
    setAttendeesSheetOpen(true);
  }, []);

  const handleAttendeesSheetOpenChange = React.useCallback((open: boolean) => {
    setAttendeesSheetOpen(open);
    if (!open) {
      setAttendeesGroupId(null);
      setAttendees(null);
      setAttendeesError(null);
    }
  }, []);

  React.useEffect(() => {
    if (!requestsSheetOpen || !requestsGroupId) return;
    let active = true;
    setRequestsError(null);
    setRequests(null);
    setRequestsLoading(true);
    (async () => {
      const { data, error } = await supabase
        .from("group_attendees")
        .select("user_id, message, created_at")
        .eq("group_id", requestsGroupId)
        .eq("status", "pending")
        .order("created_at", { ascending: false });
      if (!active) return;
      if (error) {
        console.error("[GroupsNew] requests fetch error", error);
        setRequestsError("Failed to load requests.");
        setRequests([]);
        setRequestsLoading(false);
        return;
      }
      const ids = Array.from(
        new Set((data ?? []).map((row: any) => row.user_id).filter(Boolean))
      );
      let profileMap = new Map<
        string,
        { name: string; avatarUrl: string | null }
      >();
      if (ids.length) {
        const { data: profiles, error: profilesErr } = await supabase
          .from("profiles")
          .select("id, profile_title, name, avatar_url")
          .in("id", ids);
        if (profilesErr) {
          console.warn("[GroupsNew] requests profile fetch error", profilesErr);
        } else if (profiles) {
          profiles.forEach((p: any) => {
            profileMap.set(p.id, {
              name: p.profile_title || p.name || "Pending member",
              avatarUrl: p.avatar_url || null,
            });
          });
        }
      }
      const mapped =
        data?.map((row: any) => {
          const profile = profileMap.get(row.user_id);
          return {
            userId: row.user_id as string,
            name: profile?.name || "Pending member",
            avatarUrl: profile?.avatarUrl || null,
            message: row.message || null,
            createdAt: row.created_at || null,
          };
        }) ?? [];
      setRequests(mapped);
      setRequestsLoading(false);
    })();
    return () => {
      active = false;
    };
  }, [requestsSheetOpen, requestsGroupId, supabase]);

  React.useEffect(() => {
    if (!attendeesSheetOpen || !attendeesGroupId) return;
    let active = true;
    setAttendeesError(null);
    setAttendees(null);
    setAttendeesLoading(true);
    (async () => {
      const { data, error } = await supabase
        .from("group_attendees")
        .select("user_id, created_at")
        .eq("group_id", attendeesGroupId)
        .eq("status", "accepted")
        .order("created_at", { ascending: false });
      if (!active) return;
      if (error) {
        console.error("[GroupsNew] attendees fetch error", error);
        setAttendeesError("Failed to load attendees.");
        setAttendees([]);
        setAttendeesLoading(false);
        return;
      }
      const ids = Array.from(
        new Set((data ?? []).map((row: any) => row.user_id).filter(Boolean))
      );
      let profileMap = new Map<
        string,
        { name: string; avatarUrl: string | null }
      >();
      if (ids.length) {
        const { data: profiles, error: profilesErr } = await supabase
          .from("profiles")
          .select("id, profile_title, name, avatar_url")
          .in("id", ids);
        if (profilesErr) {
          console.warn(
            "[GroupsNew] attendees profile fetch error",
            profilesErr
          );
        } else if (profiles) {
          profiles.forEach((p: any) => {
            profileMap.set(p.id, {
              name: p.profile_title || p.name || "Group member",
              avatarUrl: p.avatar_url || null,
            });
          });
        }
      }
      const mapped =
        data?.map((row: any) => {
          const profile = profileMap.get(row.user_id);
          return {
            userId: row.user_id as string,
            name: profile?.name || "Group member",
            avatarUrl: profile?.avatarUrl || null,
            joinedAt: row.created_at || null,
          };
        }) ?? [];
      setAttendees(mapped);
      setAttendeesLoading(false);
    })();
    return () => {
      active = false;
    };
  }, [attendeesSheetOpen, attendeesGroupId, supabase]);

  React.useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        setLoadingGroups(true);

        const res = await fetch("/api/groups/activity", {
          method: "GET",
          cache: "no-store",
        });

        if (!res.ok) {
          console.warn("[GroupsNew] groups activity fetch failed", res.status);
          if (!cancelled) {
            setMyGroups([]);
            setAttendeeAvatars({});
            setNearbyGroups([]);
          }
          return;
        }

        const data = (await res
          .json()
          .catch(() => null)) as ActivityResponse | null;

        if (!data) {
          if (!cancelled) {
            setMyGroups([]);
            setAttendeeAvatars({});
            setNearbyGroups([]);
          }
          return;
        }

        if (!cancelled) {
          setMyGroups(Array.isArray(data.groups) ? data.groups : []);
          setAttendeeAvatars(
            data.attendeeAvatars && typeof data.attendeeAvatars === "object"
              ? data.attendeeAvatars
              : {}
          );
          setNearbyGroups(Array.isArray(data.listings) ? data.listings : []);
        }
      } catch (e) {
        console.warn("[GroupsNew] groups activity fetch error", e);
        if (!cancelled) {
          setMyGroups([]);
          setAttendeeAvatars({});
          setNearbyGroups([]);
        }
      } finally {
        if (!cancelled) {
          setLoadingGroups(false);
        }
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
      cancelled = true;
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
              lat: g.location_lat!,
              lng: g.location_lng!,
            }),
          };
        }
        return { ...g, distanceKm: null };
      });
    });
  }, [userPos, myGroups?.length]);

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
  }, [userPos, nearbyGroups?.length]);

  const allGroups = myGroups || [];
  const hostingGroups = allGroups.filter(
    (g) => g.membershipStatus !== "attending"
  );
  const hostingIds = React.useMemo(
    () =>
      new Set(
        hostingGroups
          .filter((g) => g.membershipStatus === "hosting")
          .map((g) => g.id)
      ),
    [hostingGroups]
  );
  const attendingGroupsOnly = allGroups.filter(
    (g) => g.membershipStatus === "attending"
  );

  const hostingLiveGroups = hostingGroups.filter(
    (g) => g.lifecycleStatus === "in_progress"
  );
  const hostingUpcomingGroups = hostingGroups.filter((g) => {
    if (!g.nextDate) return true;
    if (isFuture(g.nextDate)) return true;
    return (
      g.lifecycleStatus === "active" || g.lifecycleStatus === "in_progress"
    );
  });
  const hostingGroupsByDay = React.useMemo(
    () =>
      upcomingDays.map((day) =>
        hostingUpcomingGroups.filter(
          (g) => g.nextDate && sameDay(g.nextDate, day)
        )
      ),
    [hostingUpcomingGroups, upcomingDays]
  );
  const hostingGroupsForSelectedDay =
    hostingGroupsByDay[selectedHostingDayIndex] ?? [];
  const hostingDayHosts = hostingGroupsForSelectedDay.filter(
    (g) => g.membershipStatus === "hosting"
  );
  const hostingDayCohosts = hostingGroupsForSelectedDay.filter((g) => {
    const status = (g.membershipStatus || "").toLowerCase();
    return status === "co-hosting" || status === "cohosting";
  });

  const attendingLiveGroups = attendingGroupsOnly.filter(
    (g) => g.lifecycleStatus === "in_progress"
  );
  const attendingUpcomingGroups = attendingGroupsOnly.filter((g) => {
    if (!g.nextDate) return true;
    if (isFuture(g.nextDate)) return true;
    return (
      g.lifecycleStatus === "active" || g.lifecycleStatus === "in_progress"
    );
  });

  const listingsArray = Array.isArray(nearbyGroups) ? nearbyGroups : null;
  const listingsByDistance = listingsArray
    ? [...listingsArray].sort((a, b) => {
        const da = a.distanceKm ?? Number.POSITIVE_INFINITY;
        const db = b.distanceKm ?? Number.POSITIVE_INFINITY;
        if (da !== db) return da - db;
        return (a.name || "").localeCompare(b.name || "");
      })
    : [];
  const listingsComingSoon = listingsArray
    ? [...listingsArray]
        .filter((g) => {
          if (g.lifecycleStatus === "in_progress") return true;
          if (!g.start_time) return false;
          const ts = Date.parse(g.start_time);
          if (Number.isNaN(ts)) return false;
          return ts >= Date.now();
        })
        .sort((a, b) => {
          const ta = a.start_time
            ? Date.parse(a.start_time)
            : Number.POSITIVE_INFINITY;
          const tb = b.start_time
            ? Date.parse(b.start_time)
            : Number.POSITIVE_INFINITY;
          return ta - tb;
        })
    : [];

  const involvedIds = React.useMemo(
    () => new Set(allGroups.map((g) => g.id)),
    [allGroups]
  );

  async function handleMarkLive(group: MyGroupCard) {
    try {
      setMarkingLiveId(group.id);
      await updateGroup(group.id, { status: "in_progress" });
      setMyGroups((prev) =>
        (prev || []).map((g) =>
          g.id === group.id ? { ...g, lifecycleStatus: "in_progress" } : g
        )
      );
    } catch (error) {
      console.warn("[GroupsNew] mark live error", error);
    } finally {
      setMarkingLiveId(null);
    }
  }

  const renderMenuButton = (group: MyGroupCard) => {
    const allowSetLive = group.lifecycleStatus !== "in_progress";
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            variant="secondary"
            size="icon"
            className="h-8 w-8 rounded-full text-muted-foreground"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
            }}
            aria-label="More options"
            data-stop-row-nav="true"
          >
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="end"
          className="w-44"
          onPointerDown={(e) => e.stopPropagation()}
          data-stop-row-nav="true"
        >
          <DropdownMenuItem
            onSelect={(event) => {
              event.preventDefault();
              event.stopPropagation();
              openEditSheet(group.id);
            }}
            data-stop-row-nav="true"
          >
            Edit
          </DropdownMenuItem>
          <DropdownMenuItem
            onSelect={(event) => {
              event.preventDefault();
              event.stopPropagation();
              openRequestsSheet(group.id);
            }}
            data-stop-row-nav="true"
          >
            Requests
          </DropdownMenuItem>
          <DropdownMenuItem
            onSelect={(event) => {
              event.preventDefault();
              event.stopPropagation();
              openAttendeesSheet(group.id);
            }}
            data-stop-row-nav="true"
          >
            Attending
          </DropdownMenuItem>
          {allowSetLive ? (
            <DropdownMenuItem
              onSelect={(event) => {
                event.preventDefault();
                event.stopPropagation();
                handleMarkLive(group);
              }}
              data-stop-row-nav="true"
            >
              Set in progress
            </DropdownMenuItem>
          ) : null}
          <DropdownMenuItem
            variant="destructive"
            data-stop-row-nav="true"
            onSelect={(event) => {
              event.preventDefault();
              event.stopPropagation();
            }}
          >
            Cancel
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    );
  };

  function canMarkLive(group: MyGroupCard): boolean {
    if (
      group.membershipStatus === "attending" ||
      group.lifecycleStatus !== "active"
    ) {
      return false;
    }
    const mins = minutesUntil(group.nextDate);
    if (mins == null) return false;
    return mins >= 0 && mins <= 15;
  }

  function renderGroupRow(
    group: MyGroupCard,
    inlineRight?: React.ReactNode,
    options?: {
      hideMembership?: boolean;
      hideDate?: boolean;
      showTimeChip?: boolean;
      menuButton?: React.ReactNode;
    }
  ) {
    const opts = options || {};
    const km = typeof group.distanceKm === "number" ? group.distanceKm : null;
    const num =
      km != null ? (km < 10 ? km.toFixed(1) : Math.round(km).toString()) : "--";

    const coverUrl = group.cover_image_url
      ? resolveCoverUrl(group.cover_image_url)
      : null;
    const isLive = group.lifecycleStatus === "in_progress";
    const isHost = group.membershipStatus === "hosting";

    const handleRowClick = (e: React.MouseEvent<HTMLDivElement>) => {
      if (e.defaultPrevented) return;
      const target = e.target as HTMLElement | null;
      if (target?.closest("[data-stop-row-nav='true']")) return;
      router.push(`/app/activity/group/${group.id}`);
    };

    return (
      <div
        key={group.id}
        role="button"
        tabIndex={0}
        onClick={handleRowClick}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            router.push(`/app/activity/group/${group.id}`);
          }
        }}
        className="relative rounded-xl border bg-card text-card-foreground px-3 py-3 flex items-center gap-3 cursor-pointer"
      >
        {opts.menuButton ? (
          <div className="absolute right-2 top-2">{opts.menuButton}</div>
        ) : null}
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted shrink-0">
          {isHost ? (
            <Home className="h-5 w-5 text-emerald-600" />
          ) : (
            <div className="text-center leading-tight">
              <div className="text-sm font-semibold">{num}</div>
              <div className="text-[10px] text-muted-foreground">km</div>
            </div>
          )}
        </div>

        <div className="relative h-10 w-10 rounded-lg overflow-hidden bg-muted shrink-0">
          {coverUrl ? (
            // Same-origin API URLs with query strings bypass next/image's localPatterns guard
            coverUrl.includes("?") ? (
              <img
                src={coverUrl}
                alt={group.name}
                className="absolute inset-0 h-full w-full object-cover"
                loading="lazy"
                decoding="async"
              />
            ) : (
              <Image
                src={coverUrl}
                alt={group.name}
                fill
                sizes="(max-width: 768px) 40px, 40px"
                className="absolute inset-0 object-cover"
              />
            )
          ) : (
            <div className={`absolute inset-0 ${group.colorClass}`} />
          )}
        </div>

        <div className="min-w-0 flex-1 pr-10">
          <div className="flex items-center gap-2 min-w-0">
            <p className="font-medium truncate">{group.name}</p>
            {opts.showTimeChip ? (
              isLive ? (
                <span className="inline-flex items-center rounded-full bg-green-600 text-white px-2.5 py-0.5 text-[11px] font-medium">
                  In progress
                </span>
              ) : group.nextDate ? (
                <span className="inline-flex items-center rounded-full bg-primary text-primary-foreground px-2.5 py-0.5 text-[11px] font-medium">
                  {formatTime(group.nextDate)}
                </span>
              ) : null
            ) : null}
          </div>
          <div className="flex items-center gap-2 mt-1">
            {!opts.hideMembership ? (
              <span className="inline-flex items-center rounded-full border px-1.5 py-0.5 text-[10px] text-muted-foreground">
                {membershipLabel(group.membershipStatus)}
              </span>
            ) : null}
            {!opts.hideDate ? (
              isLive ? (
                <span className="text-[10px] font-semibold text-green-600">
                  In progress
                </span>
              ) : group.nextDate ? (
                <span className="text-[10px] text-muted-foreground">
                  {formatDateShort(group.nextDate)} ·{" "}
                  {formatTime(group.nextDate)}
                </span>
              ) : null
            ) : null}
          </div>
          <div className="mt-1 flex items-center">
            <Avatar14
              avatars={attendeeAvatars[group.id]?.avatars || []}
              extraCount={attendeeAvatars[group.id]?.extra || 0}
            />
          </div>
        </div>

        {inlineRight}
      </div>
    );
  }

  function renderGroupSkeleton(rows = 3) {
    return (
      <div className="space-y-3">
        {Array.from({ length: rows }).map((_, i) => (
          <div
            key={i}
            className="rounded-xl border bg-card px-3 py-3 flex items-center gap-3 animate-pulse"
          >
            <div className="h-12 w-12 rounded-full bg-muted/40" />
            <div className="h-10 w-10 rounded-lg bg-muted/40" />
            <div className="flex-1 space-y-2">
              <div className="h-3 w-2/3 bg-muted/40 rounded" />
              <div className="h-3 w-1/3 bg-muted/40 rounded" />
            </div>
            <div className="h-7 w-7 rounded-full bg-muted/40" />
          </div>
        ))}
      </div>
    );
  }

  function renderListingRow(group: NearbyGroup) {
    const km = typeof group.distanceKm === "number" ? group.distanceKm : null;
    const num =
      km != null ? (km < 10 ? km.toFixed(1) : Math.round(km).toString()) : "--";
    const coverUrl = group.cover_image_url
      ? resolveCoverUrl(group.cover_image_url)
      : null;
    const isLive = group.lifecycleStatus === "in_progress";
    const isHost = hostingIds.has(group.id);
    const hasStart =
      !!group.start_time && !Number.isNaN(Date.parse(group.start_time));

    return (
      <Link
        key={group.id}
        href={`/app/activity/group/${group.id}`}
        className="rounded-xl border bg-card text-card-foreground px-3 py-3 flex items-center gap-3"
      >
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted shrink-0">
          {isHost ? (
            <Home className="h-5 w-5 text-emerald-600" />
          ) : (
            <div className="text-center leading-tight">
              <div className="text-sm font-semibold">{num}</div>
              <div className="text-[10px] text-muted-foreground">km</div>
            </div>
          )}
        </div>

        <div className="relative h-10 w-10 rounded-lg overflow-hidden bg-muted shrink-0">
          {coverUrl ? (
            // Same-origin API URLs with query strings bypass next/image's localPatterns guard
            coverUrl.includes("?") ? (
              <img
                src={coverUrl}
                alt={group.name}
                className="absolute inset-0 h-full w-full object-cover"
                loading="lazy"
                decoding="async"
              />
            ) : (
              <Image
                src={coverUrl}
                alt={group.name}
                fill
                sizes="(max-width: 768px) 40px, 40px"
                className="absolute inset-0 object-cover"
              />
            )
          ) : (
            <div className="absolute inset-0 bg-muted" />
          )}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="font-medium truncate">{group.name}</p>
            {isLive ? (
              <span className="inline-flex items-center rounded-full bg-green-600 text-white px-2.5 py-0.5 text-[11px] font-medium">
                In progress
              </span>
            ) : hasStart ? (
              <span className="inline-flex items-center rounded-full bg-primary text-primary-foreground px-2.5 py-0.5 text-[11px] font-medium">
                {formatTime(group.start_time)}
              </span>
            ) : null}
          </div>
          <div className="mt-1 flex items-center">
            <Avatar14
              avatars={attendeeAvatars[group.id]?.avatars || []}
              extraCount={attendeeAvatars[group.id]?.extra || 0}
            />
          </div>
        </div>

        {involvedIds.has(group.id) ? (
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
          <div className="h-5 w-5 rounded-full bg-muted flex items-center justify-center">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-3.5 w-3.5 text-muted-foreground"
            >
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </div>
        )}
      </Link>
    );
  }

  return (
    <>
      <section className="space-y-8">
        {/* Coming up (Listings) */}
        <div>
          <div className="flex items-center justify-between px-1 mb-2">
            <h3 className="text-base font-semibold">Coming up</h3>
          </div>
          {!Array.isArray(nearbyGroups) ? (
            renderGroupSkeleton(4)
          ) : listingsComingSoon.length === 0 ? (
            <div className="w-full py-4">
              <Empty>
                <EmptyHeader>
                  <EmptyMedia variant="icon">
                    <Users className="h-6 w-6" />
                  </EmptyMedia>
                  <EmptyTitle>No upcoming listings</EmptyTitle>
                  <EmptyDescription>
                    There are no public groups scheduled yet.
                  </EmptyDescription>
                </EmptyHeader>
              </Empty>
            </div>
          ) : (
            <div className="space-y-3">
              {listingsComingSoon.slice(0, 10).map((g) => renderListingRow(g))}
            </div>
          )}
        </div>

        {/* Live Hosting */}
        {hostingLiveGroups.length > 0 && (
          <div>
            <div className="flex items-center justify-between px-1 mb-2">
              <h3 className="text-base font-semibold">Hosting · live now</h3>
            </div>
            <div className="space-y-3">
              {hostingLiveGroups.map((g) =>
                renderGroupRow(g, null, {
                  hideMembership: true,
                  hideDate: true,
                  showTimeChip: true,
                  menuButton: renderMenuButton(g),
                })
              )}
            </div>
          </div>
        )}

        {/* Live Attending */}
        {attendingLiveGroups.length > 0 && (
          <div>
            <div className="flex items-center justify-between px-1 mb-2">
              <h3 className="text-base font-semibold">Attending · live now</h3>
            </div>
            <div className="space-y-3">
              {attendingLiveGroups.map((g) =>
                renderGroupRow(g, null, { menuButton: renderMenuButton(g) })
              )}
            </div>
          </div>
        )}

        {/* Hosting Upcoming */}
        {hostingUpcomingGroups.length > 0 && (
          <div>
            <div className="flex items-center justify-between px-1 mb-2 gap-3">
              <h3 className="text-base font-semibold">Upcoming</h3>
              <div className="flex items-center gap-2">
                <Link
                  href="/app/activity/groups/manage"
                  aria-label="Manage your groups"
                >
                  <Button
                    variant="outline"
                    size="sm"
                    className="rounded-full gap-2"
                  >
                    Manage
                  </Button>
                </Link>
                <Link
                  href="/app/activity/groups/create"
                  aria-label="Host a new group or event"
                >
                  <Button
                    variant="outline"
                    size="sm"
                    className="rounded-full gap-2"
                  >
                    <Plus className="h-4 w-4" />
                    Host
                  </Button>
                </Link>
              </div>
            </div>
            <div className="mt-3 space-y-4">
              <div className="relative rounded-2xl bg-foreground/90 text-background p-4 shadow-[0_20px_40px_-15px_rgba(0,0,0,0.35)]">
                <div className="flex items-start justify-between">
                  <div>
                    <h4 className="text-lg tracking-tight">Calendar</h4>
                    <p className="text-sm/6 opacity-70">Next 2 weeks</p>
                  </div>
                  <button
                    className="opacity-60 hover:opacity-100 transition"
                    aria-label="More options"
                  >
                    <MoreHorizontal className="h-5 w-5" />
                  </button>
                </div>
                <div className="mt-6 grid grid-cols-7 gap-2 place-items-center">
                  {upcomingDays.map((day, index) => (
                    <button
                      key={day.toISOString()}
                      onClick={() => setSelectedHostingDayIndex(index)}
                      className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-medium transition ${
                        index === selectedHostingDayIndex
                          ? "bg-background text-foreground ring-2 ring-background/80"
                          : "bg-background/10 text-background/80"
                      }`}
                      aria-pressed={index === selectedHostingDayIndex}
                    >
                      {day.getDate()}
                    </button>
                  ))}
                </div>
              </div>

              {loadingGroups && !allGroups.length ? (
                renderGroupSkeleton()
              ) : hostingUpcomingGroups.length === 0 ? (
                <div className="w-full py-4">
                  <Empty>
                    <EmptyHeader>
                      <EmptyMedia variant="icon">
                        <Users className="h-6 w-6" />
                      </EmptyMedia>
                      <EmptyTitle>No upcoming hosting</EmptyTitle>
                      <EmptyDescription>
                        Create or host a group and it will show here.
                      </EmptyDescription>
                    </EmptyHeader>
                  </Empty>
                </div>
              ) : hostingGroupsForSelectedDay.length === 0 ? (
                <div className="w-full py-4">
                  <Empty>
                    <EmptyHeader>
                      <EmptyMedia variant="icon">
                        <Users className="h-6 w-6" />
                      </EmptyMedia>
                      <EmptyTitle>No groups this day</EmptyTitle>
                      <EmptyDescription>
                        Pick another date to see upcoming hosts.
                      </EmptyDescription>
                    </EmptyHeader>
                  </Empty>
                </div>
              ) : (
                <div className="space-y-5">
                  {hostingDayHosts.length > 0 ? (
                    <div className="space-y-2">
                      <div className="text-xs uppercase text-muted-foreground px-1">
                        Hosting
                      </div>
                      <div className="space-y-3">
                        {hostingDayHosts.map((g) => {
                          const showMarkLive = canMarkLive(g);
                          return renderGroupRow(
                            g,
                            showMarkLive ? (
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                className="h-7 px-2 text-[11px]"
                                onClick={(e) => {
                                  e.preventDefault();
                                  handleMarkLive(g);
                                }}
                                disabled={markingLiveId === g.id}
                              >
                                {markingLiveId === g.id
                                  ? "Marking…"
                                  : "Mark live"}
                              </Button>
                            ) : null,
                            {
                              hideMembership: true,
                              hideDate: true,
                              showTimeChip: true,
                              menuButton: renderMenuButton(g),
                            }
                          );
                        })}
                      </div>
                    </div>
                  ) : null}

                  {hostingDayCohosts.length > 0 ? (
                    <div className="space-y-2">
                      <div className="text-xs uppercase text-muted-foreground px-1">
                        Co-hosting
                      </div>
                      <div className="space-y-3">
                        {hostingDayCohosts.map((g) => {
                          const showMarkLive = canMarkLive(g);
                          return renderGroupRow(
                            g,
                            showMarkLive ? (
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                className="h-7 px-2 text-[11px]"
                                onClick={(e) => {
                                  e.preventDefault();
                                  handleMarkLive(g);
                                }}
                                disabled={markingLiveId === g.id}
                              >
                                {markingLiveId === g.id
                                  ? "Marking…"
                                  : "Mark live"}
                              </Button>
                            ) : null,
                            {
                              hideMembership: true,
                              hideDate: true,
                              showTimeChip: true,
                              menuButton: renderMenuButton(g),
                            }
                          );
                        })}
                      </div>
                    </div>
                  ) : null}

                  {hostingDayHosts.length === 0 &&
                  hostingDayCohosts.length === 0 ? (
                    <div className="w-full py-4">
                      <Empty>
                        <EmptyHeader>
                          <EmptyMedia variant="icon">
                            <Users className="h-6 w-6" />
                          </EmptyMedia>
                          <EmptyTitle>No upcoming hosting</EmptyTitle>
                          <EmptyDescription>
                            Create or host a group and it will show here.
                          </EmptyDescription>
                        </EmptyHeader>
                      </Empty>
                    </div>
                  ) : null}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Attending Upcoming */}
        {attendingUpcomingGroups.length > 0 && (
          <div>
            <div className="flex items-center justify-between px-1 mb-2">
              <h3 className="text-base font-semibold">Attending</h3>
            </div>
            <div className="space-y-3">
              {attendingUpcomingGroups.map((g) => renderGroupRow(g))}
            </div>
          </div>
        )}
      </section>

      <Sheet open={editSheetOpen} onOpenChange={handleEditSheetOpenChange}>
        <SheetContent
          side="right"
          className="w-full sm:max-w-3xl lg:max-w-4xl overflow-y-auto p-0"
          hideCloseButton
        >
          <TopBar
            className="px-4"
            leftContent={<BackButton onClick={handleBackButton} />}
          />
          <SheetHeader className="sr-only">
            <SheetTitle>Edit group</SheetTitle>
            <SheetDescription>Update group information</SheetDescription>
          </SheetHeader>
          <div className="px-4 pb-8">
            {editingGroupId ? (
              <Wizard
                key={editingGroupId}
                groupId={editingGroupId}
                persistToUrl={false}
                onStepChange={handleWizardStepChange}
                externalBackSignal={wizardBackSignal}
              />
            ) : (
              <div className="text-sm text-muted-foreground">
                Select a group to edit.
              </div>
            )}
          </div>
        </SheetContent>
      </Sheet>

      <Sheet
        open={requestsSheetOpen}
        onOpenChange={handleRequestsSheetOpenChange}
      >
        <SheetContent
          side="right"
          className="w-full sm:max-w-md overflow-y-auto p-0"
          hideCloseButton
        >
          <TopBar
            className="px-4"
            leftContent={
              <BackButton onClick={() => setRequestsSheetOpen(false)} />
            }
          />
          <SheetHeader className="sr-only">
            <SheetTitle>Requests</SheetTitle>
            <SheetDescription>Pending join requests</SheetDescription>
          </SheetHeader>
          <div className="px-4 pb-8 space-y-4">
            {requestsLoading ? (
              <div className="flex items-center justify-center py-10 text-sm text-muted-foreground">
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Loading requests…
              </div>
            ) : requestsError ? (
              <div className="text-sm text-destructive">{requestsError}</div>
            ) : requests && requests.length > 0 ? (
              <div className="space-y-3">
                {requests.map((req) => (
                  <div
                    key={req.userId}
                    className="rounded-xl border bg-card text-card-foreground p-3 flex gap-3"
                  >
                    <Avatar className="h-12 w-12">
                      {req.avatarUrl ? (
                        <AvatarImage src={req.avatarUrl} alt={req.name} />
                      ) : null}
                      <AvatarFallback>
                        {req.name?.slice(0, 2).toUpperCase() || "GU"}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <div className="font-medium">{req.name}</div>
                      {req.message ? (
                        <p className="text-sm text-muted-foreground line-clamp-3 mt-1">
                          {req.message}
                        </p>
                      ) : null}
                      {req.createdAt ? (
                        <p className="text-xs text-muted-foreground mt-1">
                          {formatRequestDate(req.createdAt)}
                        </p>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <Empty>
                <EmptyHeader>
                  <EmptyMedia variant="icon">
                    <Users className="h-6 w-6" />
                  </EmptyMedia>
                  <EmptyTitle>No pending requests</EmptyTitle>
                  <EmptyDescription>
                    When someone requests to join, they will appear here.
                  </EmptyDescription>
                </EmptyHeader>
              </Empty>
            )}
          </div>
        </SheetContent>
      </Sheet>

      <Sheet
        open={attendeesSheetOpen}
        onOpenChange={handleAttendeesSheetOpenChange}
      >
        <SheetContent
          side="right"
          className="w-full sm:max-w-md overflow-y-auto p-0"
          hideCloseButton
        >
          <TopBar
            className="px-4"
            leftContent={
              <BackButton onClick={() => setAttendeesSheetOpen(false)} />
            }
          />
          <SheetHeader className="sr-only">
            <SheetTitle>Attendees</SheetTitle>
            <SheetDescription>Approved attendees</SheetDescription>
          </SheetHeader>
          <div className="px-4 pb-8 space-y-4">
            {attendeesLoading ? (
              <div className="flex items-center justify-center py-10 text-sm text-muted-foreground">
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Loading attendees…
              </div>
            ) : attendeesError ? (
              <div className="text-sm text-destructive">{attendeesError}</div>
            ) : attendees && attendees.length > 0 ? (
              <div className="space-y-3">
                {attendees.map((att) => (
                  <div
                    key={att.userId}
                    className="rounded-xl border bg-card text-card-foreground p-3 flex gap-3"
                  >
                    <Avatar className="h-12 w-12">
                      {att.avatarUrl ? (
                        <AvatarImage src={att.avatarUrl} alt={att.name} />
                      ) : null}
                      <AvatarFallback>
                        {att.name?.slice(0, 2).toUpperCase() || "GM"}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <div className="font-medium">{att.name}</div>
                      {att.joinedAt ? (
                        <p className="text-xs text-muted-foreground mt-1">
                          Joined {formatRequestDate(att.joinedAt)}
                        </p>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <Empty>
                <EmptyHeader>
                  <EmptyMedia variant="icon">
                    <Users className="h-6 w-6" />
                  </EmptyMedia>
                  <EmptyTitle>No attendees yet</EmptyTitle>
                  <EmptyDescription>
                    Approved attendees will appear here once you accept them.
                  </EmptyDescription>
                </EmptyHeader>
              </Empty>
            )}
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
