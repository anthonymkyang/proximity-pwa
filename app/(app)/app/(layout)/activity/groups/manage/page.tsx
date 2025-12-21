"use client";

import * as React from "react";
import Link from "next/link";
import { createClient } from "@/utils/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import {
  Item,
  ItemActions,
  ItemContent,
  ItemMedia,
  ItemTitle,
} from "@/components/ui/item";
import { Card } from "@/components/ui/card";
import { CalendarClock, Shield, EllipsisVertical, Plus } from "lucide-react";
import { toast } from "sonner";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import Sheet01 from "@/components/shadcn-studio/sheet/sheet-01";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { Archive } from "lucide-react";

type GroupRow = {
  id: string;
  title: string | null;
  category_id: string | null;
  start_time: string | null;
  end_time: string | null;
  location_text: string | null;
  postcode: string | null;
  cover_image_url: string | null;
  is_public: boolean | null;
  attendee_count: number | null;
  status: string | null;
};

type CategoryRow = {
  id: string;
  name: string;
};

type Attendee = {
  id: string;
  name: string | null;
  username: string | null;
  avatar_url: string | null;
};

type ExtendedGroup = GroupRow & {
  category_name: string | null;
  coverUrl: string | null;
  attendeesPreview: Attendee[];
  attendeesExtra: number;
  pendingRequests: number;
};

type SupaClient = ReturnType<typeof createClient>;

function initialsFrom(text?: string | null): string {
  if (!text) return "U";
  const parts = String(text).trim().split(/\s+/);
  const first = parts[0]?.[0] ?? "";
  const last = parts.length > 1 ? parts[parts.length - 1][0] ?? "" : "";
  return (first + last || first || "U").toUpperCase().slice(0, 2);
}

async function fetchAttendeesPreview(
  supabase: SupaClient,
  groupId: string,
  limit = 4
): Promise<Attendee[]> {
  const { data: joins } = await supabase
    .from("group_attendees")
    .select("user_id")
    .eq("group_id", groupId)
    .order("joined_at", { ascending: false })
    .limit(limit);

  const ids = (joins ?? []).map((j: any) => j.user_id).filter(Boolean);
  if (!ids.length) return [];

  const { data: profs } = await supabase
    .from("profiles")
    .select("id, profile_title, username, avatar_url")
    .in("id", ids);

  const byId = new Map((profs ?? []).map((p: any) => [p.id, p]));
  return ids
    .map((id: string) => byId.get(id))
    .filter(Boolean)
    .map((p: any) => ({
      id: p.id,
      name: p.profile_title,
      username: p.username,
      avatar_url: p.avatar_url,
    }));
}

// --- helpers ---
function fmtWhen(
  start?: string | null,
  end?: string | null,
  isArchive = false
) {
  if (!start) return "TBC";
  const s = new Date(start);
  const e = end ? new Date(end) : null;
  const now = new Date();

  // Helper to format time (e.g., "7pm", "11am")
  const formatTime = (date: Date) => {
    const hours = date.getHours();
    const minutes = date.getMinutes();
    const ampm = hours >= 12 ? "pm" : "am";
    const displayHours = hours % 12 || 12;
    return minutes === 0
      ? `${displayHours}${ampm}`
      : `${displayHours}:${String(minutes).padStart(2, "0")}${ampm}`;
  };

  // Helper to get day difference
  const getDayDiff = (from: Date, to: Date) => {
    const fromMidnight = new Date(
      from.getFullYear(),
      from.getMonth(),
      from.getDate()
    );
    const toMidnight = new Date(to.getFullYear(), to.getMonth(), to.getDate());
    return Math.floor(
      (toMidnight.getTime() - fromMidnight.getTime()) / (1000 * 60 * 60 * 24)
    );
  };

  const dayDiff = getDayDiff(now, s);
  const sameDay = e
    ? s.getFullYear() === e.getFullYear() &&
      s.getMonth() === e.getMonth() &&
      s.getDate() === e.getDate()
    : true;

  const st = formatTime(s);
  const et = e ? formatTime(e) : null;

  if (isArchive) {
    // Archive tab: use past reference
    const daysSince = -dayDiff;

    if (daysSince === 0) {
      return "Today";
    } else if (daysSince === 1) {
      return "Yesterday";
    } else if (daysSince < 7) {
      // Weekday name for under a week
      return s.toLocaleDateString(undefined, { weekday: "long" });
    } else {
      // Date for over a week
      return s.toLocaleDateString(undefined, {
        day: "numeric",
        month: "short",
      });
    }
  } else {
    // Active/Drafts tab: use future reference
    let datePrefix: string;

    if (dayDiff === 0) {
      datePrefix = "Today";
    } else if (dayDiff === 1) {
      datePrefix = "Tomorrow";
    } else if (dayDiff < 7) {
      // Weekday name for under a week ahead
      datePrefix = s.toLocaleDateString(undefined, { weekday: "long" });
    } else {
      // Date for over a week
      datePrefix = s.toLocaleDateString(undefined, {
        day: "numeric",
        month: "short",
      });
    }

    if (!e) {
      return `${datePrefix}, ${st} onwards`;
    } else if (sameDay) {
      return `${datePrefix}, ${st} to ${et}`;
    } else {
      // Different days
      const eDatePrefix = s.toLocaleDateString(undefined, {
        day: "numeric",
        month: "short",
      });
      const e2DatePrefix = e.toLocaleDateString(undefined, {
        day: "numeric",
        month: "short",
      });
      return `${eDatePrefix}, ${st} to ${e2DatePrefix}, ${et}`;
    }
  }
}

function resolveCoverUrl(raw: string | null): string | null {
  if (!raw || typeof raw !== "string") return null;

  const val = String(raw);

  // If DB already stores a full URL, use it as-is
  if (/^https?:\/\//i.test(val)) return val;

  // Our storage proxy expects a path relative to the `group-media` bucket.
  let path = val.replace(/^\/+/, "");
  if (path.toLowerCase().startsWith("group-media/")) {
    path = path.slice("group-media/".length);
  }

  const origin =
    typeof window !== "undefined" && window.location?.origin
      ? window.location.origin
      : "";

  return origin
    ? `${origin}/api/groups/storage?bucket=group-media&path=${encodeURIComponent(
        path
      )}`
    : `/api/groups/storage?bucket=group-media&path=${encodeURIComponent(path)}`;
}

const tabs = ["Active", "Drafts", "Archive"] as const;

export default function ManageGroupsPage() {
  const supabase = React.useMemo(() => createClient(), []);
  const [deleteDialogOpen, setDeleteDialogOpen] = React.useState(false);
  const [pendingDeleteId, setPendingDeleteId] = React.useState<string | null>(
    null
  );
  const [userId, setUserId] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [hostingGroups, setHostingGroups] = React.useState<ExtendedGroup[]>([]);
  const [cohostingGroups, setCohostingGroups] = React.useState<ExtendedGroup[]>(
    []
  );
  const [attendingGroups, setAttendingGroups] = React.useState<ExtendedGroup[]>(
    []
  );
  const [error, setError] = React.useState<string | null>(null);
  const [activeTab, setActiveTab] =
    React.useState<(typeof tabs)[number]>("Active");

  const [notificationsOpen, setNotificationsOpen] = React.useState(false);
  const [notifications, setNotifications] = React.useState<any[] | null>(null);
  const [notificationsLoading, setNotificationsLoading] = React.useState(false);
  const [leaveDrawerOpen, setLeaveDrawerOpen] = React.useState(false);
  const [leaveTarget, setLeaveTarget] = React.useState<ExtendedGroup | null>(
    null
  );
  const [leaveMessage, setLeaveMessage] = React.useState("");
  const [leaving, setLeaving] = React.useState(false);

  const managedGroupIds = React.useMemo(() => {
    const ids = [...hostingGroups, ...cohostingGroups]
      .map((g) => g.id)
      .filter(Boolean);
    return Array.from(new Set(ids));
  }, [hostingGroups, cohostingGroups]);

  const applyPendingCounts = React.useCallback(
    (counts: Record<string, number>) => {
      setHostingGroups((prev) =>
        prev.map((g) => ({
          ...g,
          pendingRequests: counts[g.id] ?? 0,
        }))
      );
      setCohostingGroups((prev) =>
        prev.map((g) => ({
          ...g,
          pendingRequests: counts[g.id] ?? 0,
        }))
      );
    },
    []
  );

  const getGroupTitle = React.useCallback(
    (groupId: string) => {
      const group =
        hostingGroups.find((g) => g.id === groupId) ||
        cohostingGroups.find((g) => g.id === groupId);
      return group?.title || "a group";
    },
    [hostingGroups, cohostingGroups]
  );

  const bumpPendingCount = React.useCallback((groupId: string, delta: number) => {
    if (!groupId || !Number.isFinite(delta) || delta === 0) return;
    setHostingGroups((prev) =>
      prev.map((g) =>
        g.id === groupId
          ? {
              ...g,
              pendingRequests: Math.max(0, (g.pendingRequests ?? 0) + delta),
            }
          : g
      )
    );
    setCohostingGroups((prev) =>
      prev.map((g) =>
        g.id === groupId
          ? {
              ...g,
              pendingRequests: Math.max(0, (g.pendingRequests ?? 0) + delta),
            }
          : g
      )
    );
  }, []);

  const handleDelete = async (groupId: string) => {
    if (!groupId) return;
    setDeleteDialogOpen(false);
    const { error } = await supabase.from("groups").delete().eq("id", groupId);
    if (error) {
      toast.error("Failed to delete group");
    } else {
      toast.success("Group deleted");
      setHostingGroups((prev) => prev.filter((g) => g.id !== groupId));
      setCohostingGroups((prev) => prev.filter((g) => g.id !== groupId));
      setAttendingGroups((prev) => prev.filter((g) => g.id !== groupId));
    }
    setPendingDeleteId(null);
  };

  const buildLeaveMessage = React.useCallback(
    (group: ExtendedGroup) => {
      const title = group.title || "this group";
      const when = fmtWhen(
        group.start_time as any,
        group.end_time as any,
        false
      );
      if (!when || when === "TBC") {
        return `Sorry, I can no longer make it to ${title}.`;
      }
      const needsOn =
        typeof when === "string" &&
        !when.startsWith("Today") &&
        !when.startsWith("Tomorrow");
      return `Sorry, I can no longer make it to ${title}${
        needsOn ? " on" : ""
      } ${when}.`;
    },
    []
  );

  const openLeaveDrawer = React.useCallback(
    (group: ExtendedGroup) => {
      setLeaveTarget(group);
      setLeaveMessage(buildLeaveMessage(group));
      setLeaveDrawerOpen(true);
    },
    [buildLeaveMessage]
  );

  const handleLeaveGroup = async () => {
    if (!leaveTarget?.id || leaving) return;
    const message = leaveMessage.trim();
    setLeaving(true);
    try {
      const res = await fetch(`/api/groups/${leaveTarget.id}/attendees/leave`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: message.length ? message : null }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error || "Failed to leave group");
      }
      toast.success("Left group");
      setAttendingGroups((prev) =>
        prev.filter((g) => g.id !== leaveTarget.id)
      );
      setLeaveDrawerOpen(false);
      setLeaveTarget(null);
      setLeaveMessage("");
    } catch (err: any) {
      toast.error(err?.message || "Failed to leave group");
    } finally {
      setLeaving(false);
    }
  };

  const openDeleteDialog = (groupId: string) => {
    setPendingDeleteId(groupId);
    setDeleteDialogOpen(true);
  };

  // Helper to check if a group has ended (past end time or 12am next day)
  const isGroupEnded = React.useCallback((group: ExtendedGroup): boolean => {
    const now = Date.now();

    if (group.end_time) {
      const endTime = new Date(group.end_time).getTime();
      return now > endTime;
    }

    if (group.start_time) {
      const startTime = new Date(group.start_time);
      // Set to 12am (midnight) the following day
      const nextDayMidnight = new Date(startTime);
      nextDayMidnight.setDate(nextDayMidnight.getDate() + 1);
      nextDayMidnight.setHours(0, 0, 0, 0);
      return now > nextDayMidnight.getTime();
    }

    return false;
  }, []);

  // Filter groups based on active tab
  const filteredHostingGroups = React.useMemo(() => {
    if (activeTab === "Active") {
      return hostingGroups.filter(
        (g) => g.status === "active" && !isGroupEnded(g)
      );
    } else if (activeTab === "Drafts") {
      return hostingGroups.filter((g) => g.status === "draft");
    } else if (activeTab === "Archive") {
      return hostingGroups.filter(
        (g) =>
          g.status === "archived" || (g.status === "active" && isGroupEnded(g))
      );
    }
    return hostingGroups;
  }, [hostingGroups, activeTab, isGroupEnded]);

  const filteredCohostingGroups = React.useMemo(() => {
    if (activeTab === "Active") {
      return cohostingGroups.filter(
        (g) => g.status === "active" && !isGroupEnded(g)
      );
    } else if (activeTab === "Drafts") {
      return cohostingGroups.filter((g) => g.status === "draft");
    } else if (activeTab === "Archive") {
      return cohostingGroups.filter(
        (g) =>
          g.status === "archived" || (g.status === "active" && isGroupEnded(g))
      );
    }
    return cohostingGroups;
  }, [cohostingGroups, activeTab, isGroupEnded]);

  const filteredAttendingGroups = React.useMemo(() => {
    if (activeTab === "Active") {
      return attendingGroups.filter(
        (g) => g.status === "active" && !isGroupEnded(g)
      );
    } else if (activeTab === "Drafts") {
      return attendingGroups.filter((g) => g.status === "draft");
    } else if (activeTab === "Archive") {
      return attendingGroups.filter(
        (g) =>
          g.status === "archived" || (g.status === "active" && isGroupEnded(g))
      );
    }
    return attendingGroups;
  }, [attendingGroups, activeTab, isGroupEnded]);

  const cancelledGroups = React.useMemo(() => {
    const byId = new Map<string, ExtendedGroup>();
    const lists = [hostingGroups, cohostingGroups, attendingGroups];

    lists.forEach((groups) => {
      groups
        .filter((g) => g.status === "cancelled")
        .forEach((g) => byId.set(g.id, g));
    });

    return Array.from(byId.values());
  }, [hostingGroups, cohostingGroups, attendingGroups]);

  const hasYourGroups =
    filteredHostingGroups.length > 0 || filteredCohostingGroups.length > 0;
  const hasAttending = filteredAttendingGroups.length > 0;
  const hasCancelled = activeTab === "Archive" && cancelledGroups.length > 0;

  React.useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        setLoading(true);
        setError(null);

        const {
          data: { user },
          error: authErr,
        } = await supabase.auth.getUser();

        if (authErr || !user) {
          if (!cancelled) {
            setUserId(null);
            setHostingGroups([]);
            setCohostingGroups([]);
            setAttendingGroups([]);
            setLoading(false);
          }
          return;
        }

        if (!cancelled) {
          setUserId(user.id);
        }

        const { data: categories } = await supabase
          .from("group_categories")
          .select("id, name")
          .returns<CategoryRow[]>();

        const catMap = new Map<string, string>(
          (categories ?? []).map((c: CategoryRow) => [c.id, c.name])
        );

        // 1) Groups you are hosting
        const { data: hostRows, error: hostErr } = await supabase
          .from("groups")
          .select(
            "id, title, category_id, start_time, end_time, location_text, postcode, cover_image_url, is_public, attendee_count, status"
          )
          .eq("host_id", user.id)
          .is("deleted_at", null)
          .order("updated_at", { ascending: false });

        if (hostErr) {
          console.error("[groups/manage] load host groups error", hostErr);
        }

        // 2) Groups you are co-hosting
        const { data: cohostRows, error: cohostErr } = await supabase
          .from("groups")
          .select(
            "id, title, category_id, start_time, end_time, location_text, postcode, cover_image_url, is_public, attendee_count, status, cohost_ids"
          )
          .contains("cohost_ids", [user.id])
          .is("deleted_at", null)
          .order("updated_at", { ascending: false });

        if (cohostErr) {
          console.error("[groups/manage] load cohost groups error", cohostErr);
        }

        const pendingCounts: Record<string, number> = {};
        const pendingGroupIds = Array.from(
          new Set([
            ...(hostRows ?? []).map((g: any) => g.id),
            ...(cohostRows ?? []).map((g: any) => g.id),
          ])
        ).filter(Boolean);

        if (pendingGroupIds.length) {
          const { data: pendingRows, error: pendingErr } = await supabase
            .from("group_attendees")
            .select("group_id")
            .in("group_id", pendingGroupIds)
            .eq("status", "pending");

          if (pendingErr) {
            console.error(
              "[groups/manage] load pending requests error",
              pendingErr
            );
          } else {
            (pendingRows ?? []).forEach((row: any) => {
              const id = row?.group_id ? String(row.group_id) : null;
              if (!id) return;
              pendingCounts[id] = (pendingCounts[id] ?? 0) + 1;
            });
          }
        }

        // Helper to enrich a raw group row into ExtendedGroup
        const enrichGroup = async (g: GroupRow): Promise<ExtendedGroup> => {
          console.log("[cover debug]", g.id, g.cover_image_url);
          const coverUrl = resolveCoverUrl(g.cover_image_url);
          const attendees = await fetchAttendeesPreview(supabase, g.id, 4);
          const shown = attendees.length;
          const extra = Math.max(0, (g.attendee_count ?? 0) - shown);

          return {
            ...g,
            category_name: g.category_id
              ? catMap.get(g.category_id) ?? null
              : null,
            coverUrl,
            attendeesPreview: attendees,
            attendeesExtra: extra,
            pendingRequests: pendingCounts[String(g.id)] ?? 0,
          };
        };

        const hostingEnriched: ExtendedGroup[] = await Promise.all(
          (hostRows ?? []).map((g: GroupRow) => enrichGroup(g))
        );

        const cohostingEnriched: ExtendedGroup[] = await Promise.all(
          (cohostRows ?? []).map((g: any) =>
            enrichGroup({
              id: g.id,
              title: g.title,
              category_id: g.category_id,
              start_time: g.start_time,
              end_time: g.end_time,
              location_text: g.location_text,
              postcode: g.postcode,
              cover_image_url: g.cover_image_url,
              is_public: g.is_public,
              attendee_count: g.attendee_count,
              status: g.status,
            })
          )
        );

        // 3) Groups you are attending (approved / accepted)
        const { data: attendingJoins, error: attendErr } = await supabase
          .from("group_attendees")
          .select("group_id")
          .eq("user_id", user.id)
          .in("status", ["accepted", "approved"])
          .order("created_at", { ascending: false });

        if (attendErr) {
          console.error(
            "[groups/manage] load attending joins error",
            attendErr
          );
        }

        const hostIds = new Set((hostRows ?? []).map((g: any) => g.id));
        const cohostIds = new Set((cohostRows ?? []).map((g: any) => g.id));

        const attendingIds = Array.from(
          new Set(
            (attendingJoins ?? [])
              .map((j: any) => j.group_id)
              .filter(
                (id: string | null) =>
                  id && !hostIds.has(id) && !cohostIds.has(id)
              )
          )
        );

        let attendingEnriched: ExtendedGroup[] = [];
        if (attendingIds.length) {
          const { data: attendingRows, error: attendingGroupsErr } =
            await supabase
              .from("groups")
              .select(
                "id, title, category_id, start_time, end_time, location_text, postcode, cover_image_url, is_public, attendee_count, status"
              )
              .in("id", attendingIds)
              .is("deleted_at", null);

          if (attendingGroupsErr) {
            console.error(
              "[groups/manage] load attending groups error",
              attendingGroupsErr
            );
          }

          attendingEnriched = await Promise.all(
            (attendingRows ?? []).map((g: GroupRow) => enrichGroup(g))
          );
        }

        if (!cancelled) {
          setHostingGroups(hostingEnriched);
          setCohostingGroups(cohostingEnriched);
          setAttendingGroups(attendingEnriched);
          setLoading(false);
        }
      } catch (e) {
        console.error("[groups/manage] load error", e);
        if (!cancelled) {
          setError("Something went wrong loading your groups.");
          setHostingGroups([]);
          setCohostingGroups([]);
          setAttendingGroups([]);
          setLoading(false);
        }
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [supabase]);

  React.useEffect(() => {
    if (!userId || managedGroupIds.length === 0) return;

    const refreshPendingCounts = async () => {
      const { data, error } = await supabase
        .from("group_attendees")
        .select("group_id")
        .in("group_id", managedGroupIds)
        .eq("status", "pending");

      if (error) {
        console.error("[groups/manage] refresh pending requests error", error);
        return;
      }

      const counts: Record<string, number> = {};
      (data ?? []).forEach((row: any) => {
        const id = row?.group_id ? String(row.group_id) : null;
        if (!id) return;
        counts[id] = (counts[id] ?? 0) + 1;
      });
      applyPendingCounts(counts);
    };

    const channel = supabase
      .channel(`group-attendees-pending-${userId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "group_attendees",
          filter: `group_id=in.(${managedGroupIds.join(",")})`,
        },
        (payload) => {
          const eventType = payload.eventType;
          if (eventType === "INSERT") {
            const row = payload.new as any;
            if (row?.status === "pending" && row?.group_id) {
              bumpPendingCount(String(row.group_id), 1);
              toast.success(
                `New join request for ${getGroupTitle(String(row.group_id))}`
              );
              return;
            }
          } else if (eventType === "DELETE") {
            const row = payload.old as any;
            if (row?.status === "pending" && row?.group_id) {
              bumpPendingCount(String(row.group_id), -1);
              return;
            }
          } else if (eventType === "UPDATE") {
            const next = payload.new as any;
            const prev = payload.old as any;
            const nextPending = next?.status === "pending";
            const prevPending = prev?.status === "pending";
            if (prev?.group_id && prevPending && !nextPending) {
              bumpPendingCount(String(prev.group_id), -1);
              return;
            }
            if (next?.group_id && nextPending && !prevPending) {
              bumpPendingCount(String(next.group_id), 1);
              return;
            }
          }

          void refreshPendingCounts();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [
    supabase,
    userId,
    managedGroupIds,
    applyPendingCounts,
    bumpPendingCount,
  ]);

  const handlePublish = async (id: string) => {
    try {
      await supabase.from("groups").update({ status: "active" }).eq("id", id);
      setHostingGroups((prev) =>
        prev.map((g) => (g.id === id ? { ...g, status: "active" } : g))
      );
      setCohostingGroups((prev) =>
        prev.map((g) => (g.id === id ? { ...g, status: "active" } : g))
      );
      toast.success("Group published successfully");
    } catch (e) {
      console.error("[groups/manage] publish error", e);
      toast.error("Failed to publish group");
    }
  };

  const handleUnpublish = async (id: string) => {
    try {
      await supabase.from("groups").update({ status: "draft" }).eq("id", id);
      setHostingGroups((prev) =>
        prev.map((g) => (g.id === id ? { ...g, status: "draft" } : g))
      );
      setCohostingGroups((prev) =>
        prev.map((g) => (g.id === id ? { ...g, status: "draft" } : g))
      );
      toast.success("Group unpublished successfully");
    } catch (e) {
      console.error("[groups/manage] unpublish error", e);
      toast.error("Failed to unpublish group");
    }
  };

  const openNotifications = async () => {
    setNotificationsOpen(true);
    setNotifications(null);
    setNotificationsLoading(true);

    try {
      const res = await fetch("/api/user/notifications/groups", {
        method: "GET",
      });

      if (!res.ok) {
        console.error("[groups/manage] notifications fetch failed", res.status);
        setNotifications([]);
        return;
      }

      const data = await res.json().catch(() => null as any);

      const list = Array.isArray((data as any)?.notifications)
        ? (data as any).notifications
        : Array.isArray(data)
        ? data
        : [];

      setNotifications(list);
    } catch (e) {
      console.error("[groups/manage] notifications fetch error", e);
      setNotifications([]);
    } finally {
      setNotificationsLoading(false);
    }
  };

  const closeNotifications = () => {
    setNotificationsOpen(false);
  };

  if (!loading && !userId) {
    return (
      <div className="mx-auto w-full max-w-xl pb-[calc(72px+env(safe-area-inset-bottom))] px-4">
        <h1 className="px-1 pb-2 text-4xl font-extrabold tracking-tight">
          Manage groups
        </h1>
        <Card className="p-4">
          <p className="text-sm text-muted-foreground">
            You need to sign in to view and manage your groups.
          </p>
        </Card>
      </div>
    );
  }

  return (
    <>
      <div className="mx-auto w-full max-w-xl pb-[calc(72px+env(safe-area-inset-bottom))] px-4">
        <div className="pb-4">
          <h1 className="px-1 text-4xl font-extrabold tracking-tight">
            Manage groups
          </h1>
        </div>

        {/* Tabs */}
        <div className="flex items-center justify-between gap-3 pb-4">
          <div className="flex gap-2 overflow-x-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
            {tabs.map((tab) => (
              <Button
                key={tab}
                size="sm"
                variant={activeTab === tab ? "default" : "outline"}
                className={cn(
                  "rounded-full shrink-0",
                  activeTab === tab && "border border-primary"
                )}
                onClick={() => setActiveTab(tab)}
              >
                {tab === "Archive" ? <Archive className="h-4 w-4" /> : tab}
              </Button>
            ))}
          </div>
          <Link href="/app/activity/groups/create">
            <Button
              size="sm"
              className="rounded-full shrink-0"
              variant="secondary"
            >
              <Plus className="h-4 w-4" />
            </Button>
          </Link>
        </div>

        {error ? (
          <Card className="p-4 mb-3">
            <p className="text-sm text-destructive">{error}</p>
          </Card>
        ) : null}

        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div
                key={i}
                className="bg-card rounded-lg border p-3 flex items-center gap-3"
              >
                <Skeleton className="h-12 w-12 rounded-md shrink-0" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-2/3" />
                  <Skeleton className="h-3 w-1/2" />
                </div>
                <Skeleton className="h-8 w-8 rounded-full shrink-0" />
              </div>
            ))}
          </div>
        ) : (
          <div className="space-y-6">
            {!error && !hasYourGroups ? (
              <Empty className="bg-muted/30">
                <EmptyHeader>
                  <EmptyMedia variant="icon">
                    <Shield className="h-5 w-5" />
                  </EmptyMedia>
                  <EmptyTitle>No groups yet</EmptyTitle>
                  <EmptyDescription>
                    Create your first group and manage it here.
                  </EmptyDescription>
                </EmptyHeader>
                <EmptyContent>
                  <Button asChild variant="outline">
                    <Link href="/app/activity/groups/create">
                      Create a group
                    </Link>
                  </Button>
                </EmptyContent>
              </Empty>
            ) : null}

            {hasYourGroups ? (
              <div className="space-y-4">
                {filteredHostingGroups.length > 0 && (
                  <div className="space-y-2">
                    <h3 className="px-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      {activeTab === "Archive" ? "Hosted" : "Hosting"}
                    </h3>
                    <div className="space-y-3">
                      {filteredHostingGroups.map((g) => (
                        <Item key={g.id} className="bg-card">
                          <ItemMedia>
                            {g.coverUrl && g.coverUrl.trim() !== "" ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={g.coverUrl}
                                alt={`${g.title || "Group"} cover`}
                                className="h-12 w-12 rounded-md object-cover"
                                loading="lazy"
                              />
                            ) : (
                              <div className="h-12 w-12 rounded-md bg-muted grid place-items-center">
                                <Shield className="h-5 w-5 text-muted-foreground" />
                              </div>
                            )}
                          </ItemMedia>
                          <ItemContent>
                            <ItemTitle className="flex items-center gap-2">
                              <span className="truncate">
                                {g.title || "Untitled"}
                              </span>
                            </ItemTitle>

                            <div className="text-sm text-muted-foreground">
                              <div className="flex flex-col gap-1">
                                <div className="flex items-center gap-2">
                                  <CalendarClock className="h-4 w-4 text-muted-foreground" />
                                  <span>
                                    {fmtWhen(
                                      g.start_time as any,
                                      g.end_time as any,
                                      activeTab === "Archive"
                                    )}
                                  </span>
                                </div>
                              </div>
                            </div>

                            {g.attendeesPreview && g.attendeesPreview.length ? (
                              <div className="mt-2 flex justify-end">
                                <div className="flex -space-x-2">
                                  {g.attendeesPreview.map((a) => {
                                    const raw = a.avatar_url;
                                    const isUrl =
                                      typeof raw === "string" &&
                                      /^https?:\/\//i.test(raw);
                                    const src = isUrl
                                      ? raw
                                      : raw
                                      ? `/api/storage/public/${encodeURIComponent(
                                          raw
                                        )}`
                                      : null;
                                    const name = a.name || a.username || "User";
                                    const fallback = initialsFrom(name);

                                    return (
                                      <Avatar
                                        key={a.id}
                                        className="ring-2 ring-background h-6 w-6"
                                      >
                                        {src ? (
                                          <AvatarImage src={src} alt={name} />
                                        ) : null}
                                        <AvatarFallback className="text-[10px]">
                                          {fallback}
                                        </AvatarFallback>
                                      </Avatar>
                                    );
                                  })}
                                  {g.attendeesExtra > 0 ? (
                                    <Avatar className="ring-2 ring-background h-6 w-6">
                                      <AvatarFallback className="text-[10px]">
                                        +{g.attendeesExtra}
                                      </AvatarFallback>
                                    </Avatar>
                                  ) : null}
                                </div>
                              </div>
                            ) : null}
                          </ItemContent>
                          <ItemActions>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button
                                  size="icon"
                                  className="rounded-full h-8 w-8 p-0"
                                  variant="outline"
                                  aria-label="Open menu"
                                >
                                  <EllipsisVertical className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent
                                align="end"
                                sideOffset={8}
                                className="min-w-40"
                              >
                                {activeTab === "Archive" ? (
                                  <DropdownMenuItem asChild>
                                    <Link href={`/app/activity/groups/${g.id}`}>
                                      View
                                    </Link>
                                  </DropdownMenuItem>
                                ) : activeTab === "Drafts" ? (
                                  <>
                                    <DropdownMenuItem asChild>
                                      <Link
                                        href={`/app/activity/groups/${g.id}`}
                                      >
                                        Preview
                                      </Link>
                                    </DropdownMenuItem>
                                    <DropdownMenuItem asChild>
                                      <Link
                                        href={`/app/activity/groups/create?id=${g.id}&step=0`}
                                      >
                                        Edit
                                      </Link>
                                    </DropdownMenuItem>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem
                                      onClick={() => handlePublish(g.id)}
                                    >
                                      Publish
                                    </DropdownMenuItem>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem
                                      className="text-destructive focus:text-destructive"
                                      onClick={() => openDeleteDialog(g.id)}
                                    >
                                      Delete
                                    </DropdownMenuItem>
                                  </>
                                ) : (
                                  <>
                                    <DropdownMenuItem asChild>
                                      <Link
                                        href={`/app/activity/groups/${g.id}`}
                                      >
                                        View
                                      </Link>
                                    </DropdownMenuItem>
                                    <DropdownMenuItem asChild>
                                      <Link
                                        href={`/app/activity/groups/create?id=${g.id}&step=0`}
                                      >
                                        Edit
                                      </Link>
                                    </DropdownMenuItem>
                                    <DropdownMenuItem asChild>
                                      <Link
                                        href={`/app/activity/groups/${g.id}/requests`}
                                        className="flex items-center gap-2"
                                      >
                                        <span>Requests</span>
                                        {g.pendingRequests > 0 ? (
                                          <span className="ml-auto inline-flex min-w-[18px] items-center justify-center rounded-full bg-foreground px-1.5 py-0.5 text-[10px] font-semibold leading-none text-background">
                                            {g.pendingRequests}
                                          </span>
                                        ) : null}
                                      </Link>
                                    </DropdownMenuItem>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem
                                      onClick={() => handleUnpublish(g.id)}
                                    >
                                      Unpublish
                                    </DropdownMenuItem>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem
                                      asChild
                                      className="text-destructive focus:text-destructive"
                                    >
                                      <Link
                                        href={`/app/activity/groups/manage`}
                                      >
                                        Cancel
                                      </Link>
                                    </DropdownMenuItem>
                                  </>
                                )}
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </ItemActions>
                        </Item>
                      ))}
                    </div>
                  </div>
                )}

                {filteredCohostingGroups.length > 0 && (
                  <div className="space-y-2">
                    <h3 className="px-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      {activeTab === "Archive" ? "Co-hosted" : "Co-hosting"}
                    </h3>
                    <div className="space-y-3">
                      {filteredCohostingGroups.map((g) => (
                        <Item key={g.id} className="bg-card">
                          <ItemMedia>
                            {g.coverUrl && g.coverUrl.trim() !== "" ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={g.coverUrl}
                                alt={`${g.title || "Group"} cover`}
                                className="h-12 w-12 rounded-md object-cover"
                                loading="lazy"
                              />
                            ) : (
                              <div className="h-12 w-12 rounded-md bg-muted grid place-items-center">
                                <Shield className="h-5 w-5 text-muted-foreground" />
                              </div>
                            )}
                          </ItemMedia>
                          <ItemContent>
                            <ItemTitle className="flex items-center gap-2">
                              <span className="truncate">
                                {g.title || "Untitled"}
                              </span>
                            </ItemTitle>

                            <div className="text-sm text-muted-foreground">
                              <div className="flex flex-col gap-1">
                                <div className="flex items-center gap-2">
                                  <CalendarClock className="h-4 w-4 text-muted-foreground" />
                                  <span>
                                    {fmtWhen(
                                      g.start_time as any,
                                      g.end_time as any,
                                      activeTab === "Archive"
                                    )}
                                  </span>
                                </div>
                              </div>
                            </div>

                            {g.attendeesPreview && g.attendeesPreview.length ? (
                              <div className="mt-2 flex justify-end">
                                <div className="flex -space-x-2">
                                  {g.attendeesPreview.map((a) => {
                                    const raw = a.avatar_url;
                                    const isUrl =
                                      typeof raw === "string" &&
                                      /^https?:\/\//i.test(raw);
                                    const src = isUrl
                                      ? raw
                                      : raw
                                      ? `/api/storage/public/${encodeURIComponent(
                                          raw
                                        )}`
                                      : null;
                                    const name = a.name || a.username || "User";
                                    const fallback = initialsFrom(name);

                                    return (
                                      <Avatar
                                        key={a.id}
                                        className="ring-2 ring-background h-6 w-6"
                                      >
                                        {src ? (
                                          <AvatarImage src={src} alt={name} />
                                        ) : null}
                                        <AvatarFallback className="text-[10px]">
                                          {fallback}
                                        </AvatarFallback>
                                      </Avatar>
                                    );
                                  })}
                                  {g.attendeesExtra > 0 ? (
                                    <Avatar className="ring-2 ring-background h-6 w-6">
                                      <AvatarFallback className="text-[10px]">
                                        +{g.attendeesExtra}
                                      </AvatarFallback>
                                    </Avatar>
                                  ) : null}
                                </div>
                              </div>
                            ) : null}
                          </ItemContent>
                          <ItemActions>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button
                                  size="icon"
                                  className="rounded-full h-8 w-8 p-0"
                                  variant="outline"
                                  aria-label="Open menu"
                                >
                                  <EllipsisVertical className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent
                                align="end"
                                sideOffset={8}
                                className="min-w-40"
                              >
                                {activeTab === "Archive" ? (
                                  <DropdownMenuItem asChild>
                                    <Link href={`/app/activity/groups/${g.id}`}>
                                      View
                                    </Link>
                                  </DropdownMenuItem>
                                ) : activeTab === "Drafts" ? (
                                  <>
                                    <DropdownMenuItem asChild>
                                      <Link
                                        href={`/app/activity/groups/${g.id}`}
                                      >
                                        Preview
                                      </Link>
                                    </DropdownMenuItem>
                                    <DropdownMenuItem asChild>
                                      <Link
                                        href={`/app/activity/groups/create?id=${g.id}&step=0`}
                                      >
                                        Edit
                                      </Link>
                                    </DropdownMenuItem>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem
                                      onClick={() => handlePublish(g.id)}
                                    >
                                      Publish
                                    </DropdownMenuItem>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem
                                      className="text-destructive focus:text-destructive"
                                      onClick={() => openDeleteDialog(g.id)}
                                    >
                                      Delete
                                    </DropdownMenuItem>
                                  </>
                                ) : (
                                  <>
                                    <DropdownMenuItem asChild>
                                      <Link
                                        href={`/app/activity/groups/${g.id}`}
                                      >
                                        View
                                      </Link>
                                    </DropdownMenuItem>
                                    <DropdownMenuItem asChild>
                                      <Link
                                        href={`/app/activity/groups/create?id=${g.id}&step=0`}
                                      >
                                        Edit
                                      </Link>
                                    </DropdownMenuItem>
                                    <DropdownMenuItem asChild>
                                      <Link
                                        href={`/app/activity/groups/${g.id}/requests`}
                                        className="flex items-center gap-2"
                                      >
                                        <span>Requests</span>
                                        {g.pendingRequests > 0 ? (
                                          <span className="ml-auto inline-flex min-w-[18px] items-center justify-center rounded-full bg-foreground px-1.5 py-0.5 text-[10px] font-semibold leading-none text-background">
                                            {g.pendingRequests}
                                          </span>
                                        ) : null}
                                      </Link>
                                    </DropdownMenuItem>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem
                                      onClick={() => handleUnpublish(g.id)}
                                    >
                                      Unpublish
                                    </DropdownMenuItem>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem
                                      asChild
                                      className="text-destructive focus:text-destructive"
                                    >
                                      <Link
                                        href={`/app/activity/groups/manage`}
                                      >
                                        Cancel
                                      </Link>
                                    </DropdownMenuItem>
                                  </>
                                )}
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </ItemActions>
                        </Item>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : null}

            {hasAttending && (
              <div className="space-y-1">
                <p className="px-1 text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
                  {activeTab === "Archive" ? "Attended" : "Attending"}
                </p>
                <div className="space-y-3">
                  {filteredAttendingGroups.map((g) => (
                    <Item key={g.id} className="bg-card">
                      <ItemMedia>
                        {g.coverUrl && g.coverUrl.trim() !== "" ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={g.coverUrl}
                            alt={`${g.title || "Group"} cover`}
                            className="h-12 w-12 rounded-md object-cover"
                            loading="lazy"
                          />
                        ) : (
                          <div className="h-12 w-12 rounded-md bg-muted grid place-items-center">
                            <Shield className="h-5 w-5 text-muted-foreground" />
                          </div>
                        )}
                      </ItemMedia>
                      <ItemContent className="min-w-0">
                        <ItemTitle className="flex items-center gap-2 min-w-0">
                          <span className="truncate">
                            {g.title || "Untitled"}
                          </span>
                        </ItemTitle>

                        <div className="text-sm text-muted-foreground">
                          <div className="flex flex-col gap-1">
                            <div className="flex items-center gap-2">
                              <CalendarClock className="h-4 w-4 text-muted-foreground" />
                              <span>
                                {fmtWhen(
                                  g.start_time as any,
                                  g.end_time as any,
                                  activeTab === "Archive"
                                )}
                              </span>
                            </div>
                          </div>
                        </div>

                        {g.attendeesPreview && g.attendeesPreview.length ? (
                          <div className="mt-2 flex justify-end">
                            <div className="flex -space-x-2">
                              {g.attendeesPreview.map((a) => {
                                const raw = a.avatar_url;
                                const isUrl =
                                  typeof raw === "string" &&
                                  /^https?:\/\//i.test(raw);
                                const src = isUrl
                                  ? raw
                                  : raw
                                  ? `/api/storage/public/${encodeURIComponent(
                                      raw
                                    )}`
                                  : null;
                                const name = a.name || a.username || "User";
                                const fallback = initialsFrom(name);

                                return (
                                  <Avatar
                                    key={a.id}
                                    className="ring-2 ring-background h-6 w-6"
                                  >
                                    {src ? (
                                      <AvatarImage src={src} alt={name} />
                                    ) : null}
                                    <AvatarFallback className="text-[10px]">
                                      {fallback}
                                    </AvatarFallback>
                                  </Avatar>
                                );
                              })}
                              {g.attendeesExtra > 0 ? (
                                <Avatar className="ring-2 ring-background h-6 w-6">
                                  <AvatarFallback className="text-[10px]">
                                    +{g.attendeesExtra}
                                  </AvatarFallback>
                                </Avatar>
                              ) : null}
                            </div>
                          </div>
                        ) : null}
                      </ItemContent>
                      <ItemActions>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              size="icon"
                              className="rounded-full h-8 w-8 p-0"
                              variant="outline"
                              aria-label="Open menu"
                            >
                              <EllipsisVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent
                            align="end"
                            sideOffset={8}
                            className="min-w-40"
                          >
                            <DropdownMenuItem asChild>
                              <Link href={`/app/activity/groups/${g.id}`}>
                                View
                              </Link>
                            </DropdownMenuItem>
                            {activeTab === "Active" ? (
                              <DropdownMenuItem
                                onClick={() => openLeaveDrawer(g)}
                                className="text-destructive focus:text-destructive"
                              >
                                Leave group
                              </DropdownMenuItem>
                            ) : null}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </ItemActions>
                    </Item>
                  ))}
                </div>
              </div>
            )}

            {hasCancelled && (
              <div className="space-y-2">
                <h3 className="px-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Cancelled
                </h3>
                <div className="space-y-3">
                  {cancelledGroups.map((g) => (
                    <Item key={g.id} className="bg-card">
                      <ItemMedia>
                        {g.coverUrl && g.coverUrl.trim() !== "" ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={g.coverUrl}
                            alt={`${g.title || "Group"} cover`}
                            className="h-12 w-12 rounded-md object-cover"
                            loading="lazy"
                          />
                        ) : (
                          <div className="h-12 w-12 rounded-md bg-muted grid place-items-center">
                            <Shield className="h-5 w-5 text-muted-foreground" />
                          </div>
                        )}
                      </ItemMedia>
                      <ItemContent>
                        <ItemTitle className="flex items-center gap-2">
                          <span className="truncate">
                            {g.title || "Untitled"}
                          </span>
                        </ItemTitle>

                        <div className="text-sm text-muted-foreground">
                          <div className="flex flex-col gap-1">
                            <div className="flex items-center gap-2">
                              <CalendarClock className="h-4 w-4 text-muted-foreground" />
                            <span className="line-through">
                              {fmtWhen(
                                g.start_time as any,
                                g.end_time as any,
                                true
                                )}
                              </span>
                            </div>
                          </div>
                        </div>

                        {g.attendeesPreview && g.attendeesPreview.length ? (
                          <div className="mt-2 flex justify-end">
                            <div className="flex -space-x-2">
                              {g.attendeesPreview.map((a) => {
                                const raw = a.avatar_url;
                                const isUrl =
                                  typeof raw === "string" &&
                                  /^https?:\/\//i.test(raw);
                                const src = isUrl
                                  ? raw
                                  : raw
                                  ? `/api/storage/public/${encodeURIComponent(
                                      raw
                                    )}`
                                  : null;
                                const name = a.name || a.username || "User";
                                const fallback = initialsFrom(name);

                                return (
                                  <Avatar
                                    key={a.id}
                                    className="ring-2 ring-background h-6 w-6"
                                  >
                                    {src ? (
                                      <AvatarImage src={src} alt={name} />
                                    ) : null}
                                    <AvatarFallback className="text-[10px]">
                                      {fallback}
                                    </AvatarFallback>
                                  </Avatar>
                                );
                              })}
                              {g.attendeesExtra > 0 ? (
                                <Avatar className="ring-2 ring-background h-6 w-6">
                                  <AvatarFallback className="text-[10px]">
                                    +{g.attendeesExtra}
                                  </AvatarFallback>
                                </Avatar>
                              ) : null}
                            </div>
                          </div>
                        ) : null}
                      </ItemContent>
                      <ItemActions>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              size="icon"
                              className="rounded-full h-8 w-8 p-0"
                              variant="outline"
                              aria-label="Open menu"
                            >
                              <EllipsisVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent
                            align="end"
                            sideOffset={8}
                            className="min-w-40"
                          >
                            <DropdownMenuItem asChild>
                              <Link href={`/app/activity/groups/${g.id}`}>
                                View
                              </Link>
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </ItemActions>
                    </Item>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        <Sheet01
          open={notificationsOpen}
          onOpenChange={(open) => {
            if (!open) {
              closeNotifications();
            }
          }}
          title="Notifications"
          description="Latest activity and messages for your groups."
          content={
            <div className="space-y-3">
              {notificationsLoading ? (
                <div className="space-y-2">
                  <Skeleton className="h-4 w-1/3" />
                  <Skeleton className="h-4 w-2/3" />
                  <Skeleton className="h-4 w-1/2" />
                </div>
              ) : !notifications || notifications.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No notifications yet.
                </p>
              ) : (
                notifications.map((n: any) => {
                  const created =
                    typeof n.created_at === "string"
                      ? new Date(n.created_at)
                      : null;
                  const when = created
                    ? created.toLocaleString(undefined, {
                        day: "2-digit",
                        month: "short",
                        hour: "2-digit",
                        minute: "2-digit",
                      })
                    : "";

                  const type = String(n.type || "").toLowerCase();

                  const actor = n.actor_profile || n.profile || n.user || null;
                  const actorName =
                    actor?.profile_title || actor?.name || "Someone";

                  const group = n.group ||
                    n.group_summary ||
                    n.group_info || {
                      title:
                        n.group_title ||
                        n.payload?.group_title ||
                        n.payload?.group_name ||
                        null,
                    };

                  const groupTitleRaw = group?.title ?? null;
                  const groupTitle =
                    typeof groupTitleRaw === "string" &&
                    groupTitleRaw.trim().length > 0
                      ? groupTitleRaw.trim()
                      : "your group";
                  const groupTitleShort =
                    groupTitle.length > 40
                      ? groupTitle.slice(0, 37) + "..."
                      : groupTitle;

                  const metaSource =
                    n.actor_profile_meta ||
                    n.actor_meta ||
                    n.profile_meta ||
                    n.payload?.actor_meta ||
                    null;

                  const age = metaSource?.age ?? metaSource?.approx_age ?? null;
                  const sexuality =
                    metaSource?.sexuality_short_label ||
                    metaSource?.sexuality_label ||
                    metaSource?.sexuality ||
                    null;
                  const position =
                    metaSource?.position_short_label ||
                    metaSource?.position_label ||
                    metaSource?.position ||
                    null;

                  const metaParts: string[] = [];
                  if (typeof age === "number") metaParts.push(String(age));
                  if (typeof age === "string" && age.trim().length)
                    metaParts.push(age);
                  if (sexuality && String(sexuality).trim().length)
                    metaParts.push(String(sexuality).trim());
                  if (position && String(position).trim().length)
                    metaParts.push(String(position).trim());

                  const profileMeta =
                    metaParts.length > 0 ? metaParts.join(" · ") : null;

                  const payload = n.payload || {};
                  const messageField =
                    payload.message ||
                    payload.reason ||
                    n.message ||
                    n.summary ||
                    null;

                  let titleText: string;
                  let subtitleText: string | null = null;

                  switch (type) {
                    case "group_created":
                    case "created":
                      titleText = "Group created";
                      subtitleText = groupTitle;
                      break;

                    case "cohost_invite_accepted":
                    case "cohost_accepted":
                      titleText = `Co-host accepted invite · ${groupTitleShort}`;
                      subtitleText = actorName;
                      break;

                    case "join_request":
                    case "join-request":
                    case "request_to_join":
                      titleText = `${actorName} sent a request to join ${groupTitleShort}`;
                      subtitleText = profileMeta || messageField;
                      break;

                    case "group_updated":
                    case "updated":
                      {
                        const newStart =
                          payload.new_start_time ||
                          payload.start_time ||
                          payload.start ||
                          null;
                        const newEnd =
                          payload.new_end_time ||
                          payload.end_time ||
                          payload.end ||
                          null;
                        const whenText =
                          typeof newStart === "string" ||
                          typeof newEnd === "string"
                            ? fmtWhen(
                                (newStart as string | null) ?? null,
                                (newEnd as string | null) ?? null,
                                false
                              )
                            : null;

                        titleText = "Group updated";
                        subtitleText = whenText
                          ? `Time and date changed to ${whenText}`
                          : "Details have changed";
                      }
                      break;

                    case "group_cancelled":
                    case "cancelled":
                    case "canceled":
                      titleText = "Group cancelled";
                      subtitleText = `${actorName} cancelled ${groupTitleShort}`;
                      break;

                    case "invite_accepted":
                    case "join_accepted":
                    case "join-approved":
                    case "join_approved":
                      titleText = `${actorName} accepted an invite to join ${groupTitleShort}`;
                      subtitleText = profileMeta || null;
                      break;

                    case "member_left":
                    case "left":
                      titleText = `${actorName} left ${groupTitleShort}`;
                      subtitleText = profileMeta || null;
                      break;

                    default:
                      titleText = groupTitleShort;
                      subtitleText = messageField || profileMeta;
                      break;
                  }

                  const cardTitle = titleText;
                  const cardSubtitle = subtitleText;

                  const avatarName = actorName;
                  const avatarInitials = initialsFrom(avatarName);
                  const avatarUrl =
                    actor?.avatar_url || metaSource?.avatar_url || null;

                  return (
                    <div
                      key={n.id ?? when + Math.random().toString(36)}
                      className="flex items-start gap-3 rounded-lg border bg-card px-3 py-2"
                    >
                      <Avatar className="h-8 w-8">
                        {avatarUrl ? (
                          <AvatarImage src={avatarUrl} alt={avatarName} />
                        ) : null}
                        <AvatarFallback className="text-xs">
                          {avatarInitials}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <div className="text-sm font-medium truncate">
                            {cardTitle}
                          </div>
                          {when ? (
                            <div className="text-[11px] text-muted-foreground shrink-0">
                              {when}
                            </div>
                          ) : null}
                        </div>
                        {cardSubtitle ? (
                          <div className="mt-0.5 text-xs text-muted-foreground truncate">
                            {cardSubtitle}
                          </div>
                        ) : null}
                        {messageField &&
                        messageField !== cardSubtitle &&
                        type !== "join-request" &&
                        type !== "join_request" ? (
                          <p className="mt-1 text-xs text-muted-foreground whitespace-pre-wrap">
                            {messageField}
                          </p>
                        ) : null}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          }
          footer={
            <Button className="w-full" onClick={closeNotifications}>
              Done
            </Button>
          }
        />
      </div>
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete group?</DialogTitle>
          </DialogHeader>
          <p>
            Are you sure you want to delete this group? This action cannot be
            undone.
          </p>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => handleDelete(pendingDeleteId ?? "")}
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Drawer
        open={leaveDrawerOpen}
        onOpenChange={(open) => {
          setLeaveDrawerOpen(open);
          if (!open) {
            setLeaveTarget(null);
            setLeaveMessage("");
          }
        }}
      >
        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle>Leave group</DrawerTitle>
            <DrawerDescription>
              Send a message to the host and co-hosts.
            </DrawerDescription>
          </DrawerHeader>
          <div className="px-4">
            <div className="rounded-lg bg-card/60 shadow-none p-3">
              <Textarea
                value={leaveMessage}
                onChange={(e) => setLeaveMessage(e.target.value)}
                placeholder="Write a short message…"
                rows={4}
              />
            </div>
          </div>
          <DrawerFooter className="px-4 pb-4">
            <Button
              variant="destructive"
              onClick={handleLeaveGroup}
              disabled={leaving}
            >
              {leaving ? "Leaving…" : "Leave group"}
            </Button>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>
    </>
  );
}
