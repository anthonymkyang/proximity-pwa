"use client";

import * as React from "react";
import Link from "next/link";
import Image from "next/image";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import {
  Users,
  UserPlus,
  CalendarClock,
  MapPin,
  Loader2,
  CheckCircle2,
  ChevronRight,
  MoreVertical,
} from "lucide-react";
import {
  Item,
  ItemMedia,
  ItemContent,
  ItemTitle,
  ItemDescription,
} from "@/components/ui/item";
import BackButton from "@/components/ui/back-button";
import TopBar from "@/components/nav/TopBar";
import { Skeleton } from "@/components/ui/skeleton";
import Avatar04 from "@/components/shadcn-studio/avatar/avatar-04";
import Avatar15 from "@/components/shadcn-studio/avatar/avatar-15";
import Button32 from "@/components/shadcn-studio/button/button-32";

// ---- Types (adjust to your schema) ----
interface Profile {
  id: string;
  profile_title: string | null;
  name: string | null;
  avatar_url: string | null;
  sexuality_id?: string | null;
  position_id?: string | null;
}

interface HostRow {
  user_id: string;
  role: "host" | "cohost" | string;
  profile: Profile | null;
}

interface AttendeeRow {
  user_id: string;
  status?: string | null; // e.g. approved/pending
  profile: Profile | null;
}

interface GroupRow {
  id: string;
  title: string | null;
  category_id: string | null;
  /** Resolved category name, populated client-side after fetch */
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
  updated_at?: string | null;
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
    return d.toLocaleDateString(undefined, {
      weekday: "long",
      day: "2-digit",
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
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  } catch {
    return null;
  }
}

function resolveAvatarUrl(raw?: string | null): string | null {
  if (!raw) return null;
  const val = String(raw);
  // If DB already stores a full external URL, use it as-is.
  if (val.startsWith("http://") || val.startsWith("https://")) return val;

  // Otherwise treat it as a storage path inside the private "avatars" bucket
  let path = val.replace(/^\/+/, "");
  // If someone stored "avatars/..." keep only the path after the bucket name
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

// Normalize array-ish values from Supabase (handles JSON, Postgres array literal, or plain string)
function normalizeStringArray(input: unknown): string[] | null {
  if (Array.isArray(input)) {
    return (input as unknown[])
      .map((x) => String(x))
      .filter((s) => s.length > 0);
  }
  if (typeof input === "string") {
    const s = input.trim();
    // Try JSON array string first
    if (
      (s.startsWith("[") && s.endsWith("]")) ||
      (s.startsWith('"[') && s.endsWith(']"'))
    ) {
      try {
        const parsed = JSON.parse(s);
        if (Array.isArray(parsed)) {
          return parsed.map((x: any) => String(x)).filter((v) => v.length > 0);
        }
      } catch {
        // fall through to pg array parsing
      }
    }
    // Try Postgres array literal e.g. "{Poppers,Lube}" or "{\"Poppers\",\"Lube\"}"
    if (s.startsWith("{") && s.endsWith("}")) {
      const inner = s.slice(1, -1);
      if (!inner) return [];
      // Split on commas not inside quotes
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
    // Fallback: single string treated as single item
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
  const title = group?.title || "Group";
  const defaultRequest = React.useMemo(
    () => `Hi, I'm interested in "${title}". I'd like to request an invite.`,
    [title]
  );
  const [requestMsg, setRequestMsg] = React.useState<string>(defaultRequest);

  const supabase = React.useMemo(() => createClient(), []);
  const router = useRouter();

  React.useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setCurrentUserId(data?.user?.id ?? null);
    });
  }, [supabase]);

  // Helper to resolve cover URL using the same-origin proxy (no version param)
  async function resolveCoverUrl(raw: string | null): Promise<string | null> {
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
        // 1) Group details
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
              "updated_at",
            ].join(",")
          )
          .eq("id", groupId as string)
          .maybeSingle();

        // Normalize array-like fields (can arrive as text[], json[], or stringified)
        const providedNorm =
          normalizeStringArray((g as any)?.provided_items) ?? [];
        const rulesNorm = normalizeStringArray((g as any)?.house_rules) ?? [];

        if (!cancelled) {
          // Optional: load category name
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

        // 2) Hosts: derive from groups.host_id and groups.cohost_ids
        if (!cancelled) {
          const grow = g as any;
          const hostId: string | null = grow?.host_id ?? null;
          const cohostIds: string[] = Array.isArray(grow?.cohost_ids)
            ? (grow.cohost_ids as string[])
            : [];

          const hostProfile = hostId
            ? await supabase
                .from("profiles")
                .select(
                  "id, profile_title, name, avatar_url, sexuality_id, position_id"
                )
                .eq("id", hostId)
                .maybeSingle()
            : { data: null };

          let cohostProfiles: any[] = [];
          if (cohostIds.length) {
            const { data: cps } = await supabase
              .from("profiles")
              .select(
                "id, profile_title, name, avatar_url, sexuality_id, position_id"
              )
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

        // 3) Attendees (approved first, limit 50 for now)
        const { data: attendeeRows } = await supabase
          .from("group_attendees")
          .select(
            `user_id, status, profile:profiles(id, profile_title, name, avatar_url, sexuality_id, position_id)`
          )
          .eq("group_id", groupId as string)
          .order("status", { ascending: true })
          .limit(50);
        if (!cancelled && attendeeRows) {
          setAttendees(attendeeRows as any);
          // Reflect current user's participation state from DB
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
    if (!groupId || !currentUserId) return;
    try {
      await supabase
        .from("group_attendees")
        .delete()
        .eq("group_id", groupId as string)
        .eq("user_id", currentUserId);
      setAccepted(false);
      setRequested(false);
    } catch {
      // ignore for now
    }
  };

  const handleCancelGroup = async () => {
    if (!groupId) return;
    try {
      await supabase
        .from("groups")
        .update({ status: "cancelled" })
        .eq("id", groupId as string);
      setGroup((g) => (g ? ({ ...g, status: "cancelled" } as any) : g));
    } catch {
      // ignore for now
    }
  };

  const host =
    hosts.find((h) => String(h.role).toLowerCase() === "host") || hosts[0];
  const cohosts = hosts.filter((h) => String(h.role).toLowerCase() !== "host");
  const isHost = currentUserId ? host?.user_id === currentUserId : false;
  const isCohost = currentUserId
    ? cohosts.some((h) => h.user_id === currentUserId)
    : false;
  const isAccepted = accepted;
  const showMenu = isHost || isCohost || isAccepted;

  const attendeesPreview = attendees.slice(0, 6);
  const attendeesExtra = Math.max(
    0,
    attendees.length - attendeesPreview.length
  );

  // category is now injected as group.category if present
  const day = fmtDay(group?.start_time ?? null);
  const startTime = fmtTime(group?.start_time ?? null);
  const endTime = fmtTime(group?.end_time ?? null);

  return (
    <>
      <div className="mx-auto w-full max-w-xl px-5 pb-[calc(133px+env(safe-area-inset-bottom))]">
        <TopBar
          leftContent={<BackButton />}
          rightContent={
            showMenu ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button32 label="More options">
                    <MoreVertical className="h-5 w-5" />
                  </Button32>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  align="end"
                  sideOffset={8}
                  className="min-w-48 z-50"
                >
                  {(isHost || isCohost) && (
                    <>
                      <DropdownMenuItem asChild>
                        <Link
                          href={`/app/activity/groups/create?id=${groupId}`}
                        >
                          Edit group
                        </Link>
                      </DropdownMenuItem>
                      <DropdownMenuItem asChild>
                        <Link href={`/app/activity/group/${groupId}/attendees`}>
                          Manage attendees
                        </Link>
                      </DropdownMenuItem>
                      <DropdownMenuItem asChild>
                        <Link href={`/app/activity/group/${groupId}/requests`}>
                          View requests
                        </Link>
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                    </>
                  )}

                  {(isAccepted || isCohost) && (
                    <DropdownMenuItem onClick={handleLeaveGroup}>
                      Leave group
                    </DropdownMenuItem>
                  )}

                  {isHost && (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        className="text-destructive focus:text-destructive"
                        onClick={handleCancelGroup}
                      >
                        Cancel
                      </DropdownMenuItem>
                    </>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <Button32
                label="Request"
                variant="primary"
                disabled={requested || requesting}
                onClick={() => setRequestOpen(true)}
              >
                <UserPlus className="h-5 w-5" />
              </Button32>
            )
          }
        />
        <Dialog open={requestOpen} onOpenChange={(o) => setRequestOpen(o)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Request an invite</DialogTitle>
              <DialogDescription>
                Tell the host why you want to join.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3">
              <Textarea
                value={requestMsg}
                onChange={(e) => setRequestMsg(e.target.value)}
                placeholder="Write a short message…"
                rows={4}
              />
            </div>
            <DialogFooter>
              <Button
                onClick={async () => {
                  await handleRequest();
                  setRequestOpen(false);
                }}
                disabled={requesting || requested}
              >
                {requesting ? "Sending…" : "Send request"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        {error ? (
          <div className="mb-3 rounded-md border border-destructive/30 bg-destructive/10 text-destructive px-3 py-2 text-sm">
            {error}
          </div>
        ) : null}
        {/* Title */}
        <header className="pt-2 pb-3">
          {loading ? (
            <>
              <Skeleton className="h-8 w-2/3" />
              <Skeleton className="h-5 w-24 mt-2" />
              <Skeleton className="h-4 w-full mt-2" />
            </>
          ) : (
            <>
              <h1 className="text-3xl font-extrabold tracking-tight">
                {title}
              </h1>
              {group?.category ? (
                <Badge className="bg-primary mt-2 mb-4 text-sm font-medium">
                  {group.category}
                </Badge>
              ) : null}
              {mounted ? (
                <Item variant="muted">
                  <ItemMedia variant="icon">
                    <CalendarClock className="h-4 w-4 text-primary" />
                  </ItemMedia>
                  <ItemContent>
                    <ItemTitle>{day ? day : "Date TBD"}</ItemTitle>
                    <ItemDescription className="text-muted-foreground">
                      {startTime ? (
                        <>
                          {startTime}
                          {endTime ? <> to {endTime}</> : <> onwards</>}
                        </>
                      ) : (
                        <>Time TBD</>
                      )}
                    </ItemDescription>
                  </ItemContent>
                </Item>
              ) : null}
            </>
          )}
        </header>

        {/* Group image */}
        {loading ? (
          <Skeleton className="w-full aspect-video rounded-xl" />
        ) : (
          <div className="w-full aspect-video rounded-xl bg-muted flex items-center justify-center text-sm text-muted-foreground overflow-hidden">
            {coverUrl ? (
              <div className="relative w-full h-full">
                <Image
                  key={coverUrl || "cover"}
                  src={coverUrl || ""}
                  alt="Group cover"
                  fill
                  sizes="(max-width: 768px) 100vw, 960px"
                  className="object-cover"
                  unoptimized
                  priority={false}
                />
                {/* Vignette overlay */}
                <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(0,0,0,0)_0%,rgba(0,0,0,0.35)_60%,rgba(0,0,0,0.7)_100%)]" />
              </div>
            ) : (
              <span>Image placeholder</span>
            )}
          </div>
        )}

        {/* People: Hosts & Attendees */}
        <section className="mt-4">
          <div className="rounded-xl bg-card text-card-foreground p-4">
            {loading ? (
              <>
                <div className="grid grid-cols-2 gap-8 md:gap-8 mb-8">
                  <div>
                    <h2 className="text-xs font-bold tracking-wider text-muted-foreground uppercase mb-2">
                      Host
                    </h2>
                    <div className="flex items-center gap-3">
                      <Skeleton className="h-10 w-10 rounded-full" />
                      <div className="space-y-2 w-40">
                        <Skeleton className="h-4 w-3/4" />
                        <Skeleton className="h-3 w-1/2" />
                      </div>
                    </div>
                  </div>
                  <div>
                    <h2 className="text-xs font-bold tracking-wider text-muted-foreground uppercase mb-2">
                      Co-hosts
                    </h2>
                    <div className="flex items-center gap-3">
                      <div className="flex -space-x-2">
                        <Skeleton className="h-8 w-8 rounded-full ring-2 ring-card" />
                        <Skeleton className="h-8 w-8 rounded-full ring-2 ring-card" />
                        <Skeleton className="h-8 w-8 rounded-full ring-2 ring-card" />
                      </div>
                    </div>
                  </div>
                </div>
                <h2 className="text-xs font-semibold tracking-wider text-muted-foreground uppercase mb-2">
                  Attendees
                </h2>
                <div className="flex items-center gap-2">
                  <div className="flex -space-x-2">
                    {Array.from({ length: 6 }).map((_, i) => (
                      <Skeleton
                        key={i}
                        className="h-8 w-8 rounded-full ring-2 ring-card"
                      />
                    ))}
                  </div>
                  <Skeleton className="h-4 w-8" />
                </div>
              </>
            ) : (
              <>
                {/* Host & Co-hosts */}
                <div
                  className={`grid ${
                    cohosts.length ? "grid-cols-2" : "grid-cols-1"
                  } gap-8 md:gap-8 mb-8`}
                >
                  {/* Host column */}
                  <div className="col-span-1 rounded-lg">
                    <h2 className="text-xs font-bold tracking-wider text-muted-foreground uppercase mb-2">
                      Host
                    </h2>
                    <Link
                      href={
                        host?.user_id ? `/app/profile/${host.user_id}` : "#"
                      }
                      className="flex items-center gap-3"
                      aria-label={
                        (host?.profile?.profile_title ||
                          host?.profile?.name ||
                          "Host") + " profile"
                      }
                    >
                      <Avatar04
                        src={resolveAvatarUrl(host?.profile?.avatar_url) || ""}
                        name={
                          host?.profile?.profile_title ||
                          host?.profile?.name ||
                          "Host"
                        }
                        fallback={initials(
                          host?.profile?.profile_title || host?.profile?.name
                        )}
                      />
                      <div className="min-w-0">
                        <p className="font-medium leading-tight truncate underline-offset-2 hover:underline">
                          {host?.profile?.profile_title ||
                            host?.profile?.name ||
                            "Host"}
                        </p>
                        <p className="text-[11px] text-muted-foreground">
                          Host
                        </p>
                      </div>
                    </Link>
                  </div>

                  {/* Co-hosts column, only when present */}
                  {cohosts.length ? (
                    <div className="col-span-1 rounded-lg">
                      <h2 className="text-xs font-bold tracking-wider text-muted-foreground uppercase mb-2">
                        Co-hosts
                      </h2>
                      <div className="flex items-center gap-3">
                        <div className="flex -space-x-2">
                          {cohosts.slice(0, 3).map((h, i) => {
                            const displayName =
                              h.profile?.profile_title ||
                              h.profile?.name ||
                              "Co-host";
                            return (
                              <Link
                                key={h.user_id + i}
                                href={
                                  h.user_id ? `/app/profile/${h.user_id}` : "#"
                                }
                                aria-label={`${displayName} profile`}
                                className="inline-block"
                              >
                                <Avatar15
                                  avatars={[
                                    {
                                      src:
                                        resolveAvatarUrl(
                                          h.profile?.avatar_url
                                        ) || "",
                                      name: displayName,
                                      fallback: initials(displayName),
                                    },
                                  ]}
                                />
                              </Link>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  ) : null}
                </div>
                {/* Attendees */}
                <h2 className="text-xs font-semibold tracking-wider text-muted-foreground uppercase mb-2">
                  Attendees
                </h2>
                <div className="">
                  {attendeesPreview.length > 0 ? (
                    <div className="flex items-center gap-2">
                      <div className="flex -space-x-2">
                        {attendeesPreview.map((row) => (
                          <Avatar
                            key={row.user_id}
                            className="h-8 w-8 ring-2 ring-card"
                          >
                            <AvatarImage
                              src={
                                resolveAvatarUrl(row.profile?.avatar_url) || ""
                              }
                              alt=""
                            />
                            <AvatarFallback className="text-[10px]">
                              {initials(
                                row.profile?.profile_title || row.profile?.name
                              )}
                            </AvatarFallback>
                          </Avatar>
                        ))}
                      </div>
                      {attendeesExtra > 0 ? (
                        <span className="text-sm text-muted-foreground">
                          +{attendeesExtra}
                        </span>
                      ) : null}
                    </div>
                  ) : (
                    <p className="text-muted-foreground">No attendees yet.</p>
                  )}
                </div>
              </>
            )}
          </div>
        </section>

        {/* Where */}
        <section className="mt-4">
          <div className="rounded-xl bg-card text-card-foreground p-4">
            <h2 className="text-xs font-semibold tracking-wider text-muted-foreground uppercase mb-3">
              Location
            </h2>
            <div className="flex items-start gap-3">
              <MapPin className="h-5 w-5 text-primary mt-0.5" />
              <div className="min-w-0 flex-1">
                <div className="rounded-lg bg-muted overflow-hidden">
                  {loading ? (
                    <Skeleton className="w-full h-64" />
                  ) : (
                    <div className="relative w-full h-64 flex items-center justify-center text-sm bg-muted">
                      <div className="text-center space-y-2">
                        <div className="inline-flex items-center gap-2 rounded-md border bg-background px-2 py-1 text-xs">
                          <MapPin className="h-4 w-4 text-primary" />
                          <span>
                            {typeof group?.location_lat === "number" &&
                            typeof group?.location_lng === "number"
                              ? `${Number(group.location_lat).toFixed(
                                  5
                                )}, ${Number(group.location_lng).toFixed(5)}`
                              : "No coordinates"}
                          </span>
                        </div>
                        <div className="text-xs text-muted-foreground">
                          Map preview coming soon
                        </div>
                      </div>
                    </div>
                  )}
                </div>
                {loading ? (
                  <div className="mt-2 space-y-2">
                    <Skeleton className="h-4 w-1/2" />
                    <Skeleton className="h-4 w-1/3" />
                  </div>
                ) : group?.location_text || group?.postcode ? (
                  <p className="text-sm text-muted-foreground mt-2">
                    {group?.location_text ? (
                      <span>{group.location_text}</span>
                    ) : null}
                    {group?.location_text && group?.postcode ? (
                      <span>, </span>
                    ) : null}
                    {group?.postcode ? <span>{group.postcode}</span> : null}
                  </p>
                ) : null}
              </div>
            </div>
          </div>
        </section>
        {loading ? (
          <section className="mt-4">
            <div className="rounded-xl bg-card text-card-foreground p-4 space-y-3">
              <Skeleton className="h-4 w-24" />
              <div className="flex flex-wrap gap-2">
                {Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} className="h-6 w-20 rounded-full" />
                ))}
              </div>
            </div>
          </section>
        ) : null}

        {/* Provided + House rules (combined card) */}
        {(Array.isArray(group?.provided_items) &&
          group!.provided_items!.length > 0) ||
        (Array.isArray(group?.house_rules) &&
          group!.house_rules!.length > 0) ? (
          <section className="mt-4">
            <div className="rounded-xl bg-card text-card-foreground p-4">
              {Array.isArray(group?.provided_items) &&
              group!.provided_items!.length > 0 ? (
                <>
                  <h2 className="text-xs font-semibold tracking-wider text-muted-foreground uppercase mb-2">
                    Provided
                  </h2>
                  <div className="mb-3">
                    <ul className="flex flex-wrap gap-2">
                      {group!.provided_items!.map((t) => (
                        <li
                          key={t}
                          className="px-2.5 py-1 rounded-full bg-muted text-foreground/90"
                        >
                          {t}
                        </li>
                      ))}
                    </ul>
                  </div>
                </>
              ) : null}

              {Array.isArray(group?.house_rules) &&
              group!.house_rules!.length > 0 ? (
                <>
                  {/* light vertical spacing when both sections render */}
                  {Array.isArray(group?.provided_items) &&
                  group!.provided_items!.length > 0 ? (
                    <div className="h-3" />
                  ) : null}
                  <h2 className="text-xs font-semibold tracking-wider text-muted-foreground uppercase mb-2">
                    House rules
                  </h2>
                  <div className="">
                    <ul className="space-y-2">
                      {group!.house_rules!.map((rule) => (
                        <li key={rule} className="flex items-center gap-2">
                          <span className="inline-flex h-5 w-5 items-center justify-center rounded-md bg-primary">
                            <CheckCircle2 className="h-3 w-3 text-primary-foreground" />
                          </span>
                          <span>{rule}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </>
              ) : null}
            </div>
          </section>
        ) : null}

        {/* About / Description */}
        {loading ? (
          <section className="mt-4">
            <div className="rounded-xl bg-card text-card-foreground p-4 space-y-2">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-11/12" />
              <Skeleton className="h-4 w-10/12" />
            </div>
          </section>
        ) : group?.description ? (
          <section className="mt-4">
            <div className="rounded-xl bg-card text-card-foreground p-4">
              <h2 className="text-xs font-semibold tracking-wider text-muted-foreground uppercase mb-2">
                Description
              </h2>
              <div className="">
                <p className="text leading-6 whitespace-pre-wrap">
                  {group.description}
                </p>
              </div>
            </div>
          </section>
        ) : null}

        {/* Sticky request to join */}
        <div className="fixed bottom-[72px] left-0 right-0 z-20 px-4 pb-[env(safe-area-inset-bottom)]">
          <div className="mx-auto w-full max-w-xl flex justify-center">
            {loading ? (
              <Skeleton className="h-10 w-60 rounded-full" />
            ) : (
              <Button
                size="lg"
                className="rounded-full"
                onClick={handleRequest}
                disabled={requesting || requested}
              >
                {requested ? (
                  <span className="inline-flex items-center gap-2">
                    <CheckCircle2 className="h-5 w-5" /> Request sent
                  </span>
                ) : requesting ? (
                  "Sending…"
                ) : (
                  <span className="inline-flex items-center gap-2">
                    <UserPlus className="h-5 w-5" /> Request to join
                  </span>
                )}
              </Button>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
