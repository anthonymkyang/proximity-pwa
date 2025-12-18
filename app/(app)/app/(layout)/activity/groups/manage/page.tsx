"use client";

import * as React from "react";
import Link from "next/link";
import { createClient } from "@/utils/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Item,
  ItemActions,
  ItemContent,
  ItemMedia,
  ItemTitle,
} from "@/components/ui/item";
import { Card } from "@/components/ui/card";
import {
  CalendarClock,
  Shield,
  EllipsisVertical,
  Plus,
  Edit,
  Eye,
  X,
  Send,
  BellRing,
} from "lucide-react";
import { toast } from "sonner";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
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
function fmtWhen(start?: string | null, end?: string | null) {
  if (!start) return "TBC";
  const s = new Date(start);
  const e = end ? new Date(end) : null;

  const sameDay = e
    ? s.getFullYear() === e.getFullYear() &&
      s.getMonth() === e.getMonth() &&
      s.getDate() === e.getDate()
    : true;

  const d = s.toLocaleDateString(undefined, {
    day: "2-digit",
    month: "short",
  });
  const st = s
    .toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })
    .replace(":00", "");

  if (!e) return `${d}, ${st} onwards`;
  const et = e
    .toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })
    .replace(":00", "");
  if (sameDay) return `${d}, ${st} to ${et}`;
  const d2 = e.toLocaleDateString(undefined, {
    day: "2-digit",
    month: "short",
  });
  return `${d}, ${st} - ${d2} ${et}`;
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

export default function ManageGroupsPage() {
  const supabase = React.useMemo(() => createClient(), []);
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

  const [notificationsOpen, setNotificationsOpen] = React.useState(false);
  const [notifications, setNotifications] = React.useState<any[] | null>(null);
  const [notificationsLoading, setNotificationsLoading] = React.useState(false);

  const hasYourGroups = hostingGroups.length > 0 || cohostingGroups.length > 0;
  const hasAttending = attendingGroups.length > 0;

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
          };
        };

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

        const hostingEnriched: ExtendedGroup[] = await Promise.all(
          (hostRows ?? []).map((g: GroupRow) => enrichGroup(g))
        );

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
      <div className="mx-auto w-full max-w-xl pb-[calc(72px+env(safe-area-inset-bottom))]">
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
    <div className="mx-auto w-full max-w-xl pb-[calc(72px+env(safe-area-inset-bottom))]">
      <div className="flex items-center justify-between gap-3">
        <h1 className="px-1 pb-1 text-4xl font-extrabold tracking-tight">
          Manage groups
        </h1>
        {/* Actions moved to TopBar; placeholder removed */}
      </div>
      <div className="mt-2 px-1 pb-1">
        <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
          Your groups
        </p>
      </div>

      {error ? (
        <Card className="p-4 mb-3">
          <p className="text-sm text-destructive">{error}</p>
        </Card>
      ) : null}

      {loading ? (
        <div className="space-y-6 mt-2">
          {["Hosting", "Co-hosting", "Attending"].map((label) => (
            <div key={label} className="space-y-3">
              <Skeleton className="h-3 w-24 rounded-full" />
              <div className="space-y-3">
                {Array.from({ length: 3 }).map((_, i) => (
                  <Card
                    key={`${label}-${i}`}
                    className="p-3 flex items-center gap-3"
                  >
                    <Skeleton className="h-12 w-12 rounded-md" />
                    <div className="flex-1 space-y-2">
                      <Skeleton className="h-4 w-2/3" />
                      <Skeleton className="h-3 w-1/2" />
                    </div>
                    <Skeleton className="h-8 w-8 rounded-full" />
                  </Card>
                ))}
              </div>
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
                  <Link href="/app/activity/groups/create">Create a group</Link>
                </Button>
              </EmptyContent>
            </Empty>
          ) : null}

          {hasYourGroups ? (
            <div className="space-y-4">
              {hostingGroups.length > 0 && (
                <div className="space-y-2">
                  <h3 className="px-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Hosting
                  </h3>
                  <div className="space-y-3">
                    {hostingGroups.map((g) => (
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
                                    g.end_time as any
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
                                <Link
                                  href={`/app/activity/groups/create?id=${g.id}&step=0`}
                                  className="flex items-center gap-2"
                                >
                                  <Edit className="h-4 w-4" />
                                  Edit
                                </Link>
                              </DropdownMenuItem>
                              {g.status !== "active" ? (
                                <DropdownMenuItem
                                  onClick={() => handlePublish(g.id)}
                                  className="flex items-center gap-2"
                                >
                                  <Send className="h-4 w-4" />
                                  Publish
                                </DropdownMenuItem>
                              ) : (
                                <DropdownMenuItem
                                  onClick={() => handleUnpublish(g.id)}
                                  className="flex items-center gap-2"
                                >
                                  <Send className="h-4 w-4" />
                                  Unpublish
                                </DropdownMenuItem>
                              )}
                              <DropdownMenuItem asChild>
                                <Link
                                  href={`/app/activity/group/${g.id}`}
                                  className="flex items-center gap-2"
                                >
                                  <Eye className="h-4 w-4" />
                                  View
                                </Link>
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                asChild
                                className="text-destructive focus:text-destructive"
                              >
                                <Link
                                  href={`/app/activity/groups/manage`}
                                  className="flex items-center gap-2"
                                >
                                  <X className="h-4 w-4" />
                                  Cancel
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

              {cohostingGroups.length > 0 && (
                <div className="space-y-2">
                  <h3 className="px-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Co-hosting
                  </h3>
                  <div className="space-y-3">
                    {cohostingGroups.map((g) => (
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
                                    g.end_time as any
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
                                <Link
                                  href={`/app/activity/groups/create?id=${g.id}&step=0`}
                                  className="flex items-center gap-2"
                                >
                                  <Edit className="h-4 w-4" />
                                  Edit
                                </Link>
                              </DropdownMenuItem>
                              {g.status !== "active" ? (
                                <DropdownMenuItem
                                  onClick={() => handlePublish(g.id)}
                                  className="flex items-center gap-2"
                                >
                                  <Send className="h-4 w-4" />
                                  Publish
                                </DropdownMenuItem>
                              ) : (
                                <DropdownMenuItem
                                  onClick={() => handleUnpublish(g.id)}
                                  className="flex items-center gap-2"
                                >
                                  <Send className="h-4 w-4" />
                                  Unpublish
                                </DropdownMenuItem>
                              )}
                              <DropdownMenuItem asChild>
                                <Link
                                  href={`/app/activity/group/${g.id}`}
                                  className="flex items-center gap-2"
                                >
                                  <Eye className="h-4 w-4" />
                                  View
                                </Link>
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                asChild
                                className="text-destructive focus:text-destructive"
                              >
                                <Link
                                  href={`/app/activity/groups/manage`}
                                  className="flex items-center gap-2"
                                >
                                  <X className="h-4 w-4" />
                                  Cancel
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
          ) : null}

          <div className="space-y-2">
            <p className="px-1 text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
              Attending
            </p>
            {hasAttending ? (
              <div className="space-y-3">
                {attendingGroups.map((g) => (
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
                              {fmtWhen(g.start_time as any, g.end_time as any)}
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
                            <Link
                              href={`/app/activity/group/${g.id}`}
                              className="flex items-center gap-2"
                            >
                              <Eye className="h-4 w-4" />
                              View
                            </Link>
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={openNotifications}
                            className="flex items-center gap-2"
                          >
                            <BellRing className="h-4 w-4" />
                            Notifications
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </ItemActions>
                  </Item>
                ))}
              </div>
            ) : (
              <Empty className="bg-muted/20">
                <EmptyHeader>
                  <EmptyMedia variant="icon">
                    <CalendarClock className="h-5 w-5" />
                  </EmptyMedia>
                  <EmptyTitle>No upcoming attendance</EmptyTitle>
                  <EmptyDescription>
                    When you join a group, it will appear here.
                  </EmptyDescription>
                </EmptyHeader>
                <EmptyContent>
                  <Button asChild variant="outline">
                    <Link href="/app/activity/groups">Browse groups</Link>
                  </Button>
                </EmptyContent>
              </Empty>
            )}
          </div>
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
                              (newEnd as string | null) ?? null
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
  );
}
