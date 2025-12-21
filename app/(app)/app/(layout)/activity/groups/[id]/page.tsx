"use client";

import * as React from "react";
import Link from "next/link";
import Image from "next/image";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
  DrawerFooter,
  DrawerClose,
} from "@/components/ui/drawer";
import { Textarea } from "@/components/ui/textarea";
import {
  CalendarClock,
  MapPin,
  CheckCircle2,
  UserPlus,
  Archive,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { GroupDetailMap } from "@/components/activity/groups/GroupDetailMap";
import BackButton from "@/components/ui/back-button";
import { useSmartCrop } from "@/hooks/useSmartCrop";
import { ImageCarousel } from "@/components/images/ImageCarousel";

interface Profile {
  id: string;
  profile_title: string | null;
  name: string | null;
  avatar_url: string | null;
}

interface HostRow {
  user_id: string;
  role: "host" | "cohost" | string;
  profile: Profile | null;
}

interface AttendeeRow {
  user_id: string;
  status?: string | null;
  profile: Profile | null;
}

interface GroupRow {
  id: string;
  title: string | null;
  category_id: string | null;
  category?: string | null;
  description: string | null;
  cover_image_url: string | null;
  start_time: string | null;
  end_time: string | null;
  location_text: string | null;
  postcode: string | null;
  location_lat?: number | null;
  location_lng?: number | null;
  is_public?: boolean | null;
  attendee_count?: number | null;
  status?: string | null;
  host_id: string | null;
  cohost_ids?: string[] | null;
  provided_items?: string[] | null;
  house_rules?: string[] | null;
}

function initials(s: string | null | undefined) {
  if (!s) return "?";
  return (
    s
      .toString()
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((w) => w[0]?.toUpperCase() || "")
      .join("") || "?"
  );
}

function fmtDay(iso: string | null) {
  if (!iso) return null;
  try {
    const d = new Date(iso);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const eventDate = new Date(d);
    eventDate.setHours(0, 0, 0, 0);

    const diffTime = eventDate.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return "Today";
    if (diffDays === 1) return "Tomorrow";
    if (diffDays > 1 && diffDays < 7) {
      return d.toLocaleDateString(undefined, { weekday: "long" });
    }

    return d.toLocaleDateString(undefined, {
      weekday: "short",
      day: "numeric",
      month: "short",
    });
  } catch {
    return iso;
  }
}

function fmtTime(iso: string | null) {
  if (!iso) return null;
  try {
    const d = new Date(iso);
    let h = d.getHours();
    const m = d.getMinutes();
    const ampm = h >= 12 ? "pm" : "am";
    h = h % 12;
    if (h === 0) h = 12;
    if (m === 0) return `${h}${ampm}`;
    return `${h}:${String(m).padStart(2, "0")}${ampm}`;
  } catch {
    return null;
  }
}

function resolveAvatarUrl(raw?: string | null): string | null {
  if (!raw) return null;
  const val = String(raw);
  if (val.startsWith("http://") || val.startsWith("https://")) return val;

  let path = val.replace(/^\/+/, "");
  if (path.toLowerCase().startsWith("avatars/")) {
    path = path.slice("avatars/".length);
  }

  const origin =
    typeof window !== "undefined" && window.location?.origin
      ? window.location.origin
      : "";
  const base = origin ? `${origin}` : "";
  return `${base}/api/photos/avatars?path=${encodeURIComponent(path)}`;
}

function normalizeStringArray(input: unknown): string[] | null {
  if (Array.isArray(input)) {
    return (input as unknown[])
      .map((x) => String(x))
      .filter((s) => s.length > 0);
  }
  if (typeof input === "string") {
    const s = input.trim();
    if (
      (s.startsWith("[") && s.endsWith("]")) ||
      (s.startsWith('"[') && s.endsWith(']"'))
    ) {
      try {
        const parsed = JSON.parse(s);
        if (Array.isArray(parsed)) {
          return parsed.map((x: any) => String(x)).filter((v) => v.length > 0);
        }
      } catch {}
    }
    if (s.startsWith("{") && s.endsWith("}")) {
      const inner = s.slice(1, -1);
      if (!inner) return [];
      const parts: string[] = [];
      let cur = "";
      let inQuotes = false;
      for (let i = 0; i < inner.length; i++) {
        const ch = inner[i];
        if (ch === '"') {
          inQuotes = !inQuotes;
          continue;
        }
        if (ch === "," && !inQuotes) {
          parts.push(cur);
          cur = "";
          continue;
        }
        cur += ch;
      }
      parts.push(cur);
      return parts
        .map((p) => p.replace(/\\"/g, '"').trim())
        .filter((p) => p.length > 0);
    }
    return s.length ? [s] : [];
  }
  return null;
}

export default function GroupPage() {
  const params = useParams() as { id?: string };
  const groupId: string | null = params.id ?? null;

  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [group, setGroup] = React.useState<GroupRow | null>(null);
  const [coverUrl, setCoverUrl] = React.useState<string | null>(null);
  const [hosts, setHosts] = React.useState<HostRow[]>([]);
  const [attendees, setAttendees] = React.useState<AttendeeRow[]>([]);
  const [currentUserId, setCurrentUserId] = React.useState<string | null>(null);
  const [accepted, setAccepted] = React.useState(false);

  const [requesting, setRequesting] = React.useState(false);
  const [requested, setRequested] = React.useState(false);
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => setMounted(true), []);
  const [requestOpen, setRequestOpen] = React.useState(false);
  const [carouselOpen, setCarouselOpen] = React.useState(false);
  const [carouselIndex, setCarouselIndex] = React.useState(0);
  const title = group?.title || "Group";
  const defaultRequest = React.useMemo(() => {
    const start = fmtTime(group?.start_time ?? null);
    const dateLabel = group?.start_time
      ? new Date(group.start_time).toLocaleDateString(undefined, {
          weekday: "short",
          month: "short",
          day: "numeric",
        })
      : "[date]";
    const timeLabel = start ? start : "[time]";
    return `Hi! Please can I join your group on ${dateLabel}, starting at ${timeLabel}?`;
  }, [group?.start_time]);

  const initialRequestRef = React.useRef(defaultRequest);
  const [requestMsg, setRequestMsg] = React.useState<string>(defaultRequest);
  React.useEffect(() => {
    const prev = initialRequestRef.current;
    const shouldUpdate = requestMsg.trim() === "" || requestMsg === prev;
    if (shouldUpdate) {
      setRequestMsg(defaultRequest);
      initialRequestRef.current = defaultRequest;
    }
  }, [defaultRequest, requestMsg]);
  const [leaveOpen, setLeaveOpen] = React.useState(false);
  const [leaveMsg, setLeaveMsg] = React.useState<string>("");
  const [leaving, setLeaving] = React.useState(false);
  const [cancelOpen, setCancelOpen] = React.useState(false);
  const [cancelMsg, setCancelMsg] = React.useState<string>(
    "I am sorry, but I have had to cancel this group."
  );
  const [cancelling, setCancelling] = React.useState(false);

  const supabase = React.useMemo(() => createClient(), []);
  const router = useRouter();

  React.useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setCurrentUserId(data?.user?.id ?? null);
    });
  }, [supabase]);

  async function resolveCoverUrl(raw: string | null): Promise<string | null> {
    if (!raw || typeof raw !== "string") return null;
    const val = String(raw);
    if (/^https?:\/\//i.test(val)) return val;

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
      : `/api/groups/storage?bucket=group-media&path=${encodeURIComponent(
          path
        )}`;
  }

  React.useEffect(() => {
    let cancelled = false;
    const load = async () => {
      if (!groupId) {
        setError("Missing group id");
        setLoading(false);
        return;
      }
      setLoading(true);
      setError(null);
      try {
        const { data: g } = await supabase
          .from("groups")
          .select(
            [
              "id",
              "title",
              "category_id",
              "description",
              "cover_image_url",
              "start_time",
              "end_time",
              "location_text",
              "postcode",
              "location_lat",
              "location_lng",
              "is_public",
              "attendee_count",
              "status",
              "host_id",
              "cohost_ids",
              "provided_items",
              "house_rules",
            ].join(",")
          )
          .eq("id", groupId as string)
          .maybeSingle();

        const providedNorm =
          normalizeStringArray((g as any)?.provided_items) ?? [];
        const rulesNorm = normalizeStringArray((g as any)?.house_rules) ?? [];

        if (!cancelled) {
          let categoryName: string | null = null;
          if ((g as any)?.category_id) {
            const { data: cat } = await supabase
              .from("group_categories")
              .select("name")
              .eq("id", (g as any).category_id)
              .maybeSingle();
            categoryName = cat?.name ?? null;
          }
          setGroup(
            g
              ? ({
                  ...(g as any),
                  category: categoryName,
                  provided_items: providedNorm,
                  house_rules: rulesNorm,
                } as any)
              : (null as any)
          );
          if (g) {
            const url = await resolveCoverUrl(
              (g as any)?.cover_image_url ?? null
            );
            setCoverUrl(url);
          } else {
            setCoverUrl(null);
          }
        }

        if (!cancelled) {
          const grow = g as any;
          const hostId: string | null = grow?.host_id ?? null;
          const cohostIds: string[] = Array.isArray(grow?.cohost_ids)
            ? (grow.cohost_ids as string[])
            : [];

          const hostProfile = hostId
            ? await supabase
                .from("profiles")
                .select("id, profile_title, name, avatar_url")
                .eq("id", hostId)
                .maybeSingle()
            : { data: null };

          let cohostProfiles: any[] = [];
          if (cohostIds.length) {
            const { data: cps } = await supabase
              .from("profiles")
              .select("id, profile_title, name, avatar_url")
              .in("id", cohostIds);
            cohostProfiles = cps || [];
          }

          const nextHosts: HostRow[] = [];
          if (hostProfile?.data) {
            nextHosts.push({
              user_id: hostId as string,
              role: "host",
              profile: hostProfile.data as any,
            });
          }
          for (const p of cohostProfiles) {
            nextHosts.push({
              user_id: p.id,
              role: "cohost",
              profile: p as any,
            });
          }
          setHosts(nextHosts);
        }

        const { data: attendeeRows, error: attendeesErr } = await supabase
          .from("group_attendees")
          .select(
            `
            user_id,
            status,
            profile:profiles!group_attendees_user_id_fkey(
              id,
              profile_title,
              name,
              avatar_url
            )
          `
          )
          .eq("group_id", groupId as string)
          .in("status", ["approved", "accepted"])
          .order("created_at", { ascending: false })
          .limit(50);

        if (attendeesErr) {
          console.error("[group page] attendees query error", attendeesErr);
        }

        if (!cancelled && attendeeRows) {
          setAttendees(attendeeRows as any);
          if (currentUserId) {
            const mine = (attendeeRows as any[]).find(
              (r) => r.user_id === currentUserId
            );
            const st = String(mine?.status || "").toLowerCase();
            setAccepted(st === "approved" || st === "accepted");
            setRequested(
              st === "approved" || st === "accepted" || st === "pending"
            );
          }
        }
      } catch (e: any) {
        if (!cancelled) setError(e?.message || "Failed to load group");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [groupId, supabase, currentUserId]);

  const handleRequest = async () => {
    if (!groupId || requesting || requested) return;
    try {
      setRequesting(true);

      const res = await fetch(`/api/groups/${groupId}/attendees/request`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: requestMsg }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        const msg = (data as any)?.error || "Failed to send request";
        console.error("requestToJoinGroup error", msg);
        setError(msg);
        return;
      }

      const data = await res.json().catch(() => null);
      const status =
        typeof (data as any)?.status === "string"
          ? ((data as any).status as string).toLowerCase()
          : null;

      setRequested(true);
      if (status === "accepted" || status === "approved") {
        setAccepted(true);
      }
    } catch (e: any) {
      console.error("requestToJoinGroup exception", e);
      setError(e?.message || "Failed to send request");
    } finally {
      setRequesting(false);
    }
  };

  const handleLeaveGroup = async () => {
    if (!groupId || !currentUserId || leaving) return;
    try {
      setLeaving(true);

      const res = await fetch(`/api/groups/${groupId}/attendees/leave`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: leaveMsg || null }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        const msg = (data as any)?.error || "Failed to leave group";
        console.error("leaveGroup error", msg);
        setError(msg);
        return;
      }

      setAttendees((prev) =>
        prev.filter((row) => row.user_id !== currentUserId)
      );
      // If the user was a co-host, drop them from the host list locally so UI updates
      setHosts((prev) => prev.filter((h) => h.user_id !== currentUserId));
      setAccepted(false);
      setRequested(false);
      setLeaveOpen(false);
      setLeaveMsg("");
    } catch (e: any) {
      console.error("leaveGroup exception", e);
      setError(e?.message || "Failed to leave group");
    } finally {
      setLeaving(false);
    }
  };

  const handleCancelGroup = async () => {
    if (!groupId || cancelling) return;
    try {
      setCancelling(true);
      const { error: updateErr } = await supabase
        .from("groups")
        .update({ status: "cancelled" })
        .eq("id", groupId as string);

      if (updateErr) {
        console.error("[group page] cancel update error", updateErr);
        setError("Failed to cancel group");
        return;
      }

      setGroup((prev) => (prev ? { ...prev, status: "cancelled" } : prev));
      setCancelOpen(false);
    } catch (e: any) {
      console.error("[group page] cancel exception", e);
      setError(e?.message || "Failed to cancel group");
    } finally {
      setCancelling(false);
    }
  };

  const host =
    hosts.find((h) => String(h.role).toLowerCase() === "host") || hosts[0];
  const cohosts = hosts.filter((h) => String(h.role).toLowerCase() !== "host");

  const isHost = host?.user_id && currentUserId === host.user_id;
  const isCohost =
    !isHost && currentUserId
      ? cohosts.some((h) => h.user_id === currentUserId)
      : false;

  const attendeesPreview = attendees.slice(0, 8);
  const attendeesExtra = Math.max(
    0,
    attendees.length - attendeesPreview.length
  );

  const day = fmtDay(group?.start_time ?? null);
  const startTime = fmtTime(group?.start_time ?? null);
  const endTime = fmtTime(group?.end_time ?? null);

  const isArchived = React.useMemo(() => {
    const now = new Date();
    const endIso =
      typeof group?.end_time === "string" && group?.end_time
        ? (group!.end_time as string)
        : null;
    if (endIso) {
      const end = new Date(endIso as string);
      return end.getTime() <= now.getTime();
    }
    const startIso =
      typeof group?.start_time === "string" && group?.start_time
        ? (group!.start_time as string)
        : null;
    if (startIso) {
      const s = new Date(startIso as string);
      const nextMidnight = new Date(
        s.getFullYear(),
        s.getMonth(),
        s.getDate() + 1,
        0,
        0,
        0,
        0
      );
      return nextMidnight.getTime() <= now.getTime();
    }
    return false;
  }, [group?.start_time, group?.end_time]);

  const isCancelled = String(group?.status || "").toLowerCase() === "cancelled";

  // Use smart crop to find the best position for the cover image
  const { objectPosition } = useSmartCrop(coverUrl, 1, 1);

  return (
    <div className="pb-[calc(72px+env(safe-area-inset-bottom))]">
      <Drawer open={requestOpen} onOpenChange={setRequestOpen}>
        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle>Request an invite</DrawerTitle>
            <DrawerDescription>Send a message to the host</DrawerDescription>
          </DrawerHeader>
          <div className="px-4">
            <div className="rounded-lg bg-card/60 shadow-none p-3">
              <Textarea
                value={requestMsg}
                onChange={(e) => setRequestMsg(e.target.value)}
                placeholder="Write a short message…"
                rows={4}
              />
            </div>
          </div>
          <DrawerFooter className="px-4 pb-4">
            <Button
              onClick={async () => {
                await handleRequest();
                setRequestOpen(false);
              }}
              disabled={requesting || requested}
            >
              {requesting ? "Sending…" : "Send request"}
            </Button>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>

      <Drawer open={cancelOpen} onOpenChange={setCancelOpen}>
        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle>Cancel group</DrawerTitle>
          </DrawerHeader>
          <div className="px-4">
            <div className="rounded-lg bg-card/60 shadow-none p-3">
              <Label
                htmlFor="cancel-message"
                className="text-xs font-semibold tracking-wider text-muted-foreground uppercase mb-2 block"
              >
                Message to attendees
              </Label>
              <Textarea
                id="cancel-message"
                value={cancelMsg}
                onChange={(e) => setCancelMsg(e.target.value)}
                rows={4}
              />
            </div>
          </div>
          <DrawerFooter className="px-4 pb-4">
            <Button
              type="button"
              variant="destructive"
              onClick={handleCancelGroup}
              disabled={cancelling || isCancelled}
            >
              {cancelling ? "Cancelling…" : "Cancel group"}
            </Button>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>

      <Dialog open={leaveOpen} onOpenChange={(o) => setLeaveOpen(o)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Leave this group?</DialogTitle>
            <DialogDescription>
              You can leave a short message for the hosts. They will see it in
              their notifications.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <Textarea
              value={leaveMsg}
              onChange={(e) => setLeaveMsg(e.target.value)}
              placeholder="Optional message to the hosts…"
              rows={4}
            />
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setLeaveOpen(false)}
              disabled={leaving}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={handleLeaveGroup}
              disabled={leaving}
            >
              {leaving ? "Leaving…" : "Leave group"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {error && (
        <div className="mb-4 rounded-lg border border-destructive/30 bg-destructive/10 text-destructive px-4 py-3 text-sm mx-4">
          {error}
        </div>
      )}

      {/* Cover Image with Title */}
      {loading ? (
        <div className="relative w-full aspect-square bg-muted">
          <Skeleton className="w-full h-full" />
          <div className="absolute top-4 left-4">
            <Skeleton className="h-9 w-9 rounded-full" />
          </div>
          <div className="absolute bottom-0 left-0 right-0 p-4 pb-5">
            <Skeleton className="h-9 w-2/3 mb-2" />
            <Skeleton className="h-5 w-24" />
          </div>
        </div>
      ) : coverUrl ? (
        <div
          className="relative w-full aspect-square bg-muted overflow-hidden cursor-pointer"
          onClick={() => {
            setCarouselIndex(0);
            setCarouselOpen(true);
          }}
        >
          <Image
            key={coverUrl}
            src={coverUrl}
            alt={title}
            fill
            sizes="100vw"
            className="object-cover object-center"
            style={{ objectPosition: objectPosition || "center 40%" }}
            unoptimized
            priority
          />
          {/* Gradient overlay */}
          <div className="absolute inset-0 bg-linear-to-t from-background from-0% via-background/50 via-30% to-transparent to-60%" />

          {/* Back Button */}
          <div
            className="absolute top-4 left-4 z-10"
            onClick={(e) => e.stopPropagation()}
          >
            <BackButton />
          </div>

          {/* Title & Category */}
          <div className="absolute bottom-0 left-0 right-0 p-4 pb-5">
            <div className="text-2xl font-semibold leading-tight mb-2 text-white drop-shadow-md">
              {title}
            </div>
            <div className="flex items-center gap-2">
              {group?.category && (
                <Badge className="text-xs font-medium bg-primary text-primary-foreground">
                  {group.category}
                </Badge>
              )}
              {isArchived && (
                <Badge
                  variant="secondary"
                  className="text-xs font-medium flex items-center gap-1"
                >
                  <Archive className="h-3 w-3" />
                  Archived
                </Badge>
              )}
            </div>
          </div>
        </div>
      ) : (
        <div className="px-4 pt-4 pb-3">
          <div className="text-2xl font-semibold leading-tight mb-2">
            {title}
          </div>
          <div className="flex items-center gap-2">
            {group?.category && (
              <Badge className="text-xs font-medium bg-primary text-primary-foreground">
                {group.category}
              </Badge>
            )}
            {isArchived && (
              <Badge
                variant="secondary"
                className="text-xs font-medium flex items-center gap-1"
              >
                <Archive className="h-3 w-3" />
                Archived
              </Badge>
            )}
          </div>
        </div>
      )}

      <div className="px-4">
        {/* Date & Time Card */}
        {mounted && (
          <div className="bg-card/50 rounded-lg p-4 mb-3.5 mt-4 shadow-none">
            {loading ? (
              <Skeleton className="h-5 w-48" />
            ) : (
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 text-sm min-w-0">
                  <CalendarClock className="h-4 w-4 text-muted-foreground shrink-0" />
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span
                      className={`font-medium ${
                        isCancelled ? "line-through opacity-70" : ""
                      }`}
                    >
                      {day || "Date TBD"}
                    </span>
                    {startTime && (
                      <>
                        <span className="text-muted-foreground">·</span>
                        <span
                          className={`text-muted-foreground ${
                            isCancelled ? "line-through opacity-70" : ""
                          }`}
                        >
                          {startTime}
                          {endTime ? <> - {endTime}</> : null}
                        </span>
                      </>
                    )}
                  </div>
                </div>
                {!isArchived &&
                  (!isHost && !isCohost ? (
                    isCancelled ? (
                      <Badge
                        variant="destructive"
                        className="text-xs whitespace-nowrap shrink-0 h-8 grid place-items-center px-2"
                      >
                        Cancelled
                      </Badge>
                    ) : (
                      <Button
                        variant={requested ? "secondary" : "outline"}
                        size="sm"
                        className="shrink-0 text-xs h-8"
                        onClick={() => setRequestOpen(true)}
                        disabled={requested}
                      >
                        {requested ? "Requested invite" : "Ask to join"}
                      </Button>
                    )
                  ) : isHost ? (
                    <Button
                      variant="destructive"
                      size="sm"
                      className="shrink-0 text-xs h-8"
                      disabled={cancelling || isCancelled}
                      onClick={() => setCancelOpen(true)}
                    >
                      Cancel event
                    </Button>
                  ) : (
                    <Button
                      variant="outline"
                      size="sm"
                      className="shrink-0 text-xs h-8"
                      onClick={async () => {
                        await handleLeaveGroup();
                      }}
                      disabled={leaving}
                    >
                      {leaving ? "Leaving…" : "Leave group"}
                    </Button>
                  ))}
              </div>
            )}
          </div>
        )}

        {/* Description Card */}
        {loading ? (
          <div className="bg-card/50 rounded-lg p-4 mb-6 shadow-none">
            <div className="text-xs font-semibold tracking-wider text-muted-foreground uppercase mb-3">
              About
            </div>
            <div className="space-y-2">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-11/12" />
              <Skeleton className="h-4 w-10/12" />
            </div>
          </div>
        ) : group?.description ? (
          <div className="bg-card/50 rounded-lg p-4 mb-3.5 shadow-none">
            <h2 className="text-xs font-semibold tracking-wider text-muted-foreground uppercase mb-3">
              About
            </h2>
            <p className="text-base leading-relaxed text-foreground whitespace-pre-wrap">
              {group.description}
            </p>
          </div>
        ) : null}

        {/* Host and Co-hosts Cards - Responsive Layout */}
        <div
          className={`grid gap-3 mb-3.5 ${
            !loading && cohosts.length > 0 ? "grid-cols-2" : "grid-cols-1"
          }`}
        >
          {/* Host Card */}
          <div className="bg-card/50 rounded-lg p-4 shadow-none">
            {loading ? (
              <div className="space-y-3">
                <Skeleton className="h-3 w-16 mb-2" />
                <div className="flex items-center gap-3">
                  <Skeleton className="h-10 w-10 rounded-full" />
                  <div className="space-y-2 flex-1">
                    <Skeleton className="h-4 w-24" />
                  </div>
                </div>
              </div>
            ) : (
              <div>
                <h2 className="text-xs font-medium tracking-wider text-muted-foreground uppercase mb-3">
                  Host
                </h2>
                <Link
                  href={host?.user_id ? `/app/profile/${host.user_id}` : "#"}
                  className="flex items-center gap-3"
                >
                  <Avatar className="h-10 w-10 ring-2 ring-background">
                    {host?.profile?.avatar_url && (
                      <AvatarImage
                        src={resolveAvatarUrl(host.profile.avatar_url) || ""}
                        alt={
                          host.profile.profile_title ||
                          host.profile.name ||
                          "Host"
                        }
                      />
                    )}
                    <AvatarFallback className="text-sm font-semibold">
                      {initials(
                        host?.profile?.profile_title || host?.profile?.name
                      )}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0">
                    <p className="font-medium text-sm leading-tight truncate">
                      {host?.profile?.profile_title ||
                        host?.profile?.name ||
                        "Host"}
                    </p>
                  </div>
                </Link>
              </div>
            )}
          </div>

          {/* Co-hosts Card */}
          {!loading && cohosts.length > 0 && (
            <div className="bg-card/50 rounded-lg p-4 shadow-none">
              <h2 className="text-xs font-medium tracking-wider text-muted-foreground uppercase mb-3">
                {cohosts.length === 1 ? "Co-host" : "Co-hosts"}
              </h2>
              <div className="flex -space-x-2">
                {cohosts.slice(0, 5).map((h) => (
                  <Link
                    key={h.user_id}
                    href={h.user_id ? `/app/profile/${h.user_id}` : "#"}
                  >
                    <Avatar className="h-10 w-10 ring-2 ring-background">
                      {h.profile?.avatar_url && (
                        <AvatarImage
                          src={resolveAvatarUrl(h.profile.avatar_url) || ""}
                          alt={
                            h.profile.profile_title ||
                            h.profile.name ||
                            "Co-host"
                          }
                        />
                      )}
                      <AvatarFallback className="text-sm font-semibold">
                        {initials(h.profile?.profile_title || h.profile?.name)}
                      </AvatarFallback>
                    </Avatar>
                  </Link>
                ))}
                {cohosts.length > 5 && (
                  <Avatar className="h-10 w-10 ring-2 ring-background">
                    <AvatarFallback className="text-sm">
                      +{cohosts.length - 5}
                    </AvatarFallback>
                  </Avatar>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Attendees Card */}
        {!loading && (
          <div className="bg-card/50 rounded-lg p-4 mb-3.5 shadow-none">
            <div className="flex items-center gap-2 mb-3">
              <h2 className="text-xs font-medium tracking-wider text-muted-foreground uppercase">
                Attendees
              </h2>
              {attendees.length > 0 && (
                <Badge variant="secondary" className="text-xs px-2 py-0.5">
                  {attendees.length}
                </Badge>
              )}
            </div>
            {attendeesPreview.length > 0 ? (
              <div className="flex -space-x-2">
                {attendeesPreview.map((row) => (
                  <Link key={row.user_id} href={`/app/profile/${row.user_id}`}>
                    <Avatar className="h-8 w-8 ring-2 ring-background">
                      {row.profile?.avatar_url && (
                        <AvatarImage
                          src={resolveAvatarUrl(row.profile.avatar_url) || ""}
                          alt={
                            row.profile.profile_title ||
                            row.profile.name ||
                            "Attendee"
                          }
                        />
                      )}
                      <AvatarFallback className="text-xs font-semibold">
                        {initials(
                          row.profile?.profile_title || row.profile?.name
                        )}
                      </AvatarFallback>
                    </Avatar>
                  </Link>
                ))}
                {attendeesExtra > 0 && (
                  <Avatar className="h-8 w-8 ring-2 ring-background">
                    <AvatarFallback className="text-xs">
                      +{attendeesExtra}
                    </AvatarFallback>
                  </Avatar>
                )}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No attendees yet</p>
            )}
          </div>
        )}

        {/* Provided Items */}
        {Array.isArray(group?.provided_items) &&
          group.provided_items.length > 0 && (
            <div className="bg-card/50 rounded-lg p-4 mb-3.5 shadow-none">
              <h2 className="text-xs font-medium tracking-wider text-muted-foreground uppercase mb-3">
                Provided
              </h2>
              <div className="flex flex-wrap gap-2">
                {group.provided_items.map((item) => (
                  <Badge key={item} variant="secondary" className="text-sm">
                    {item}
                  </Badge>
                ))}
              </div>
            </div>
          )}

        {/* House Rules */}
        {Array.isArray(group?.house_rules) && group.house_rules.length > 0 && (
          <div className="bg-card/50 rounded-lg p-4 mb-3.5 shadow-none">
            <h2 className="text-xs font-medium tracking-wider text-muted-foreground uppercase mb-3">
              House Rules
            </h2>
            <ul className="space-y-2">
              {group.house_rules.map((rule) => (
                <li key={rule} className="flex items-start gap-2 text-base">
                  <CheckCircle2 className="h-5 w-5 text-primary mt-0.5 shrink-0" />
                  <span>{rule}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Map */}
        {loading ? (
          <Skeleton className="w-full h-64 rounded-xl mb-6" />
        ) : group &&
          typeof group.location_lat === "number" &&
          typeof group.location_lng === "number" ? (
          <div className="mb-6">
            <GroupDetailMap
              lat={group.location_lat}
              lng={group.location_lng}
              name={title}
            />
            {(group.location_text || group.postcode) && (
              <div className="flex items-start gap-2 mt-3">
                <MapPin className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                <p className="text-sm text-muted-foreground">
                  {group.location_text}
                  {group.location_text && group.postcode && ", "}
                  {group.postcode}
                </p>
              </div>
            )}
          </div>
        ) : null}
      </div>

      {/* Image Carousel */}
      {coverUrl && (
        <ImageCarousel
          open={carouselOpen}
          photos={[coverUrl]}
          index={carouselIndex}
          onClose={() => setCarouselOpen(false)}
          onPrev={() => setCarouselIndex(0)}
          onNext={() => setCarouselIndex(0)}
        />
      )}
    </div>
  );
}
