"use client";

import * as React from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";

import { Button } from "@/components/ui/button";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
  DrawerFooter,
  DrawerClose,
} from "@/components/ui/drawer";
import {
  Empty,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
  EmptyDescription,
  EmptyContent,
} from "@/components/ui/empty";
import {
  Item,
  ItemMedia,
  ItemContent,
  ItemTitle,
  ItemDescription,
} from "@/components/ui/item";
import { CheckCircle2, UserX2, Clock, CalendarClock } from "lucide-react";

interface Profile {
  id: string;
  profile_title: string | null;
  name: string | null;
  avatar_url: string | null;
  date_of_birth: string | null;
  position_label: string | null;
  sexuality_label: string | null;
}

interface RequestRow {
  user_id: string;
  status: string | null;
  message: string | null;
  created_at: string | null;
  profile: Profile | null;
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

function formatTime(iso: string | null) {
  if (!iso) return "";
  try {
    const d = new Date(iso);
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  } catch {
    return "";
  }
}

function resolveAvatarUrl(path?: string | null): string | undefined {
  if (!path) return undefined;
  const s = String(path);
  if (s.startsWith("http://") || s.startsWith("https://")) return s;
  return `/api/photos/avatars?path=${encodeURIComponent(s)}`;
}

function calculateAge(dateOfBirth: string | null): number | null {
  if (!dateOfBirth) return null;
  try {
    const dob = new Date(dateOfBirth);
    const now = new Date();
    let age = now.getFullYear() - dob.getFullYear();
    const monthDiff = now.getMonth() - dob.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < dob.getDate())) {
      age--;
    }
    return age >= 0 ? age : null;
  } catch {
    return null;
  }
}

function formatRequestTime(iso: string | null): string {
  if (!iso) return "";
  try {
    const d = new Date(iso);
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const requestDate = new Date(d.getFullYear(), d.getMonth(), d.getDate());

    if (requestDate.getTime() === today.getTime()) {
      // Today - show time
      const timeStr = d
        .toLocaleTimeString([], {
          hour: "numeric",
          minute: "2-digit",
          hour12: true,
        })
        .toLowerCase();
      return `today at ${timeStr}`;
    } else if (requestDate.getTime() === yesterday.getTime()) {
      // Yesterday
      return "yesterday";
    } else {
      // Other days - show weekday name
      const weekday = d.toLocaleDateString([], { weekday: "long" });
      return `on ${weekday}`;
    }
  } catch {
    return "";
  }
}

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
    day: "numeric",
    month: "short",
  });
  const st = s
    .toLocaleTimeString(undefined, {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    })
    .replace(":00", "")
    .toLowerCase();

  if (!e) return `${d}, ${st} onwards`;
  const et = e
    .toLocaleTimeString(undefined, {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    })
    .replace(":00", "")
    .toLowerCase();
  if (sameDay) return `${d}, ${st} - ${et}`;
  const d2 = e.toLocaleDateString(undefined, {
    day: "2-digit",
    month: "short",
  });
  return `${d}, ${st} - ${d2} ${et}`;
}

export default function GroupRequestsPage() {
  const params = useParams();
  const router = useRouter();

  const rawId = (params as any)?.id;
  const groupId: string | null = Array.isArray(rawId)
    ? typeof rawId[0] === "string"
      ? rawId[0]
      : null
    : typeof rawId === "string"
    ? rawId
    : null;

  const supabase = React.useMemo(() => createClient(), []);

  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [groupTitle, setGroupTitle] = React.useState<string>("Group requests");
  const [groupStartTime, setGroupStartTime] = React.useState<string | null>(
    null
  );
  const [groupEndTime, setGroupEndTime] = React.useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = React.useState<string | null>(null);
  const [canModerate, setCanModerate] = React.useState(false);
  const [rows, setRows] = React.useState<RequestRow[]>([]);
  const [busyUserId, setBusyUserId] = React.useState<string | null>(null);
  const [activeTab, setActiveTab] = React.useState<
    "Requests" | "Approved" | "Declined"
  >("Requests");
  const [drawerOpen, setDrawerOpen] = React.useState(false);
  const [selectedRequest, setSelectedRequest] =
    React.useState<RequestRow | null>(null);

  React.useEffect(() => {
    let cancelled = false;

    async function load() {
      if (!groupId) {
        setError("Missing group id");
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const { data: auth } = await supabase.auth.getUser();
        const uid = auth?.user?.id ?? null;
        if (!cancelled) setCurrentUserId(uid);

        const { data: group, error: gErr } = await supabase
          .from("groups")
          .select("id, title, host_id, cohost_ids, start_time, end_time")
          .eq("id", groupId)
          .maybeSingle();

        if (gErr) throw gErr;
        if (!group) {
          if (!cancelled) {
            setError("Group not found");
          }
          return;
        }

        if (!cancelled && group?.title) {
          setGroupTitle(group.title as string);
          setGroupStartTime((group as any).start_time ?? null);
          setGroupEndTime((group as any).end_time ?? null);
        }

        const hostId: string | null = (group as any)?.host_id ?? null;
        const cohostIds: string[] = Array.isArray((group as any)?.cohost_ids)
          ? ((group as any).cohost_ids as string[])
          : [];

        const isHostOrCohost =
          !!uid && (uid === hostId || cohostIds.includes(uid as string));
        if (!cancelled) setCanModerate(isHostOrCohost);

        if (!isHostOrCohost) {
          if (!cancelled) setRows([]);
          return;
        }

        const { data: attendeeRows, error: attErr } = await supabase
          .from("group_attendees")
          .select("user_id, status, message, created_at")
          .eq("group_id", groupId)
          .in("status", ["pending", "accepted", "approved", "declined"])
          .order("created_at", { ascending: true });

        if (attErr) throw attErr;

        if (!cancelled) {
          const allRequests = (attendeeRows || []) as {
            user_id: string;
            status: string | null;
            message: string | null;
            created_at: string | null;
          }[];

          const userIds = Array.from(
            new Set(allRequests.map((r) => r.user_id).filter(Boolean))
          );

          let profileMap = new Map<string, Profile>();

          if (userIds.length) {
            const { data: profilesData, error: profErr } = await supabase
              .from("profiles")
              .select(
                "id, profile_title, name, avatar_url, date_of_birth, positions(label), sexualities(label)"
              )
              .in("id", userIds);

            if (profErr) throw profErr;

            profileMap = new Map(
              (profilesData || []).map((p: any) => [
                p.id as string,
                {
                  id: p.id,
                  profile_title: p.profile_title,
                  name: p.name,
                  avatar_url: p.avatar_url,
                  date_of_birth: p.date_of_birth,
                  position_label: p.positions?.label || null,
                  sexuality_label: p.sexualities?.label || null,
                } as Profile,
              ])
            );
          }

          const withProfiles: RequestRow[] = allRequests.map((r) => ({
            ...r,
            profile: profileMap.get(r.user_id) ?? null,
          }));

          setRows(withProfiles);
        }
      } catch (e: any) {
        if (!cancelled) {
          setError(e?.message || "Failed to load requests");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [groupId, supabase]);

  async function handleDecision(userId: string, action: "accept" | "decline") {
    if (!groupId || !currentUserId) return;
    setBusyUserId(userId);
    try {
      if (action === "accept") {
        const { error } = await supabase
          .from("group_attendees")
          .update({ status: "accepted", decided_by: currentUserId })
          .eq("group_id", groupId)
          .eq("user_id", userId);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("group_attendees")
          .update({ status: "declined", decided_by: currentUserId })
          .eq("group_id", groupId)
          .eq("user_id", userId);

        if (error) throw error;
      }
      // Update local state to reflect new status and move between tabs
      setRows((prev) =>
        prev.map((r) =>
          r.user_id === userId
            ? {
                ...r,
                status: action === "accept" ? "accepted" : "declined",
              }
            : r
        )
      );
    } catch (e) {
      console.error("handleDecision error", e);
    } finally {
      setBusyUserId((prev) => (prev === userId ? null : prev));
    }
  }
  const pendingRows = rows.filter((r) => (r.status || "") === "pending");
  const approvedRows = rows.filter((r) =>
    ["accepted", "approved"].includes((r.status || "").toLowerCase())
  );
  const declinedRows = rows.filter((r) => (r.status || "") === "declined");

  const pendingCount = pendingRows.length;
  const approvedCount = approvedRows.length;
  const declinedCount = declinedRows.length;

  return (
    <div className="mx-auto w-full max-w-xl px-4 pb-[calc(80px+env(safe-area-inset-bottom))]">
      <div className="pb-3">
        <h1 className="text-4xl font-extrabold tracking-tight">
          Invite requests
        </h1>
        <div className="mt-1.5 flex items-center gap-2 flex-wrap">
          <Badge variant="secondary" className="text-xs">
            {groupTitle}
          </Badge>
          <Badge
            variant="secondary"
            className="text-xs flex items-center gap-1.5"
          >
            <CalendarClock className="h-3.5 w-3.5" />
            <span>{fmtWhen(groupStartTime, groupEndTime)}</span>
          </Badge>
        </div>
      </div>

      {error ? (
        <div className="mt-3 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </div>
      ) : null}

      {!loading && !canModerate ? (
        <div className="mt-6 rounded-xl border bg-card px-4 py-4 text-sm text-muted-foreground">
          You do not have permission to manage requests for this group.
        </div>
      ) : null}

      {canModerate ? (
        <section className="mt-4 space-y-3">
          {/* Tabs copied from Manage page style */}
          <div className="flex items-start justify-between pb-2 -mx-4">
            <div className="flex gap-2 overflow-x-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden flex-1">
              <div className="pl-2.5"></div>
              {["Requests", "Approved", "Declined"].map((t) => (
                <Button
                  key={t}
                  size="sm"
                  variant={activeTab === t ? "default" : "outline"}
                  className="rounded-full flex items-center gap-2"
                  onClick={() =>
                    setActiveTab(t as "Requests" | "Approved" | "Declined")
                  }
                >
                  <span>{t}</span>
                  <Badge
                    variant={activeTab === t ? "default" : "secondary"}
                    className={
                      "text-[11px] " +
                      (activeTab === t
                        ? "bg-primary/15 text-primary-foreground border-primary/30"
                        : "")
                    }
                  >
                    {t === "Requests"
                      ? pendingCount
                      : t === "Approved"
                      ? approvedCount
                      : declinedCount}
                  </Badge>
                </Button>
              ))}
              <div className="pr-2.5"></div>
            </div>
          </div>
          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <div
                  key={i}
                  className="rounded-xl border bg-card px-3 py-3 flex items-start gap-3"
                >
                  <Skeleton className="h-10 w-10 rounded-full" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-1/2" />
                    <Skeleton className="h-3 w-3/4" />
                    <Skeleton className="h-3 w-2/3" />
                  </div>
                  <div className="flex flex-col gap-2">
                    <Skeleton className="h-8 w-16 rounded-full" />
                    <Skeleton className="h-8 w-16 rounded-full" />
                  </div>
                </div>
              ))}
            </div>
          ) : (
              activeTab === "Requests"
                ? pendingCount === 0
                : activeTab === "Approved"
                ? approvedCount === 0
                : declinedCount === 0
            ) ? (
            <Empty className="bg-muted/20">
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <Clock className="h-5 w-5" />
                </EmptyMedia>
                {activeTab === "Requests" ? (
                  <>
                    <EmptyTitle>No pending requests</EmptyTitle>
                    <EmptyDescription>
                      When someone requests to join this group, their request
                      will appear here.
                    </EmptyDescription>
                  </>
                ) : activeTab === "Approved" ? (
                  <>
                    <EmptyTitle>No approved requests</EmptyTitle>
                    <EmptyDescription>
                      Approved requests will be listed here once accepted.
                    </EmptyDescription>
                  </>
                ) : (
                  <>
                    <EmptyTitle>No declined requests</EmptyTitle>
                    <EmptyDescription>
                      Declined requests will be listed here for reference.
                    </EmptyDescription>
                  </>
                )}
              </EmptyHeader>
              <EmptyContent />
            </Empty>
          ) : (
            <>
              <div className="mb-2 flex items-center justify-between">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">
                  {activeTab === "Requests"
                    ? "Pending requests"
                    : activeTab === "Approved"
                    ? "Approved requests"
                    : "Declined requests"}
                </p>
                <Badge variant="secondary" className="text-[11px]">
                  {(activeTab === "Requests"
                    ? pendingCount
                    : activeTab === "Approved"
                    ? approvedCount
                    : declinedCount) || 0}{" "}
                  {(
                    activeTab === "Requests"
                      ? pendingCount === 1
                      : activeTab === "Approved"
                      ? approvedCount === 1
                      : declinedCount === 1
                  )
                    ? "person"
                    : "people"}
                </Badge>
              </div>

              <div className="space-y-3">
                {(activeTab === "Requests"
                  ? pendingRows
                  : activeTab === "Approved"
                  ? approvedRows
                  : declinedRows
                ).map((row) => {
                  const name =
                    row.profile?.profile_title || row.profile?.name || "Guest";
                  const avatarSrc = row.profile?.avatar_url ?? null;
                  const created = formatTime(row.created_at);

                  return (
                    <Item
                      key={row.user_id}
                      className="items-start cursor-pointer bg-secondary/60"
                      onClick={() => {
                        setSelectedRequest(row);
                        setDrawerOpen(true);
                      }}
                    >
                      <ItemMedia>
                        <Avatar className="h-10 w-10">
                          {avatarSrc ? (
                            <AvatarImage
                              src={resolveAvatarUrl(avatarSrc)}
                              alt={name}
                            />
                          ) : null}
                          <AvatarFallback className="text-xs">
                            {initials(name)}
                          </AvatarFallback>
                        </Avatar>
                      </ItemMedia>
                      <ItemContent>
                        <ItemTitle>{name}</ItemTitle>
                        <ItemDescription className="text-xs text-muted-foreground mt-1">
                          {[
                            calculateAge(row.profile?.date_of_birth || null) &&
                              `${calculateAge(
                                row.profile?.date_of_birth || null
                              )}y`,
                            row.profile?.position_label,
                            row.profile?.sexuality_label,
                          ]
                            .filter(Boolean)
                            .join(" · ") || "No stats for this profile."}
                        </ItemDescription>
                      </ItemContent>
                    </Item>
                  );
                })}
              </div>
            </>
          )}
        </section>
      ) : null}

      {/* Request Details Drawer */}
      <Drawer open={drawerOpen} onOpenChange={setDrawerOpen}>
        <DrawerContent>
          <DrawerHeader className="text-left">
            <DrawerTitle>Invite request</DrawerTitle>
          </DrawerHeader>
          <div className="px-4 pb-4">
            <div className="flex items-start gap-3 mb-4">
              <Avatar className="h-12 w-12">
                {selectedRequest?.profile?.avatar_url ? (
                  <AvatarImage
                    src={resolveAvatarUrl(selectedRequest.profile.avatar_url)}
                    alt={
                      selectedRequest.profile.profile_title ||
                      selectedRequest.profile.name ||
                      "Guest"
                    }
                  />
                ) : null}
                <AvatarFallback>
                  {initials(
                    selectedRequest?.profile?.profile_title ||
                      selectedRequest?.profile?.name
                  )}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <Link
                  href={`/app/profile/${selectedRequest?.user_id}`}
                  className="text-base font-semibold underline-offset-2 hover:underline"
                  onClick={(e) => e.stopPropagation()}
                >
                  {selectedRequest?.profile?.profile_title ||
                    selectedRequest?.profile?.name ||
                    "Guest"}
                </Link>
                <p className="text-sm text-muted-foreground mt-0.5">
                  Requested{" "}
                  {formatRequestTime(selectedRequest?.created_at ?? null)}
                </p>
              </div>
            </div>

            {selectedRequest?.message ? (
              <div className="rounded-lg bg-muted/50 p-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
                  Message
                </p>
                <p className="text-sm whitespace-pre-wrap">
                  {selectedRequest.message}
                </p>
              </div>
            ) : (
              <div className="rounded-lg bg-muted/50 p-3">
                <p className="text-sm text-muted-foreground italic">
                  No message provided.
                </p>
              </div>
            )}
          </div>
          {activeTab === "Requests" && selectedRequest && (
            <DrawerFooter className="flex-row gap-2">
              <Button
                variant="destructive"
                className="flex-1"
                disabled={busyUserId === selectedRequest.user_id}
                onClick={async () => {
                  await handleDecision(selectedRequest.user_id, "decline");
                  setDrawerOpen(false);
                }}
              >
                {busyUserId === selectedRequest.user_id
                  ? "Declining…"
                  : "Decline"}
              </Button>
              <Button
                className="flex-1"
                disabled={busyUserId === selectedRequest.user_id}
                onClick={async () => {
                  await handleDecision(selectedRequest.user_id, "accept");
                  setDrawerOpen(false);
                }}
              >
                {busyUserId === selectedRequest.user_id
                  ? "Accepting…"
                  : "Accept"}
              </Button>
            </DrawerFooter>
          )}
          {activeTab === "Declined" && selectedRequest && (
            <DrawerFooter>
              <Button
                disabled={busyUserId === selectedRequest.user_id}
                onClick={async () => {
                  await handleDecision(selectedRequest.user_id, "accept");
                  setDrawerOpen(false);
                }}
              >
                {busyUserId === selectedRequest.user_id
                  ? "Changing…"
                  : "Change to approved"}
              </Button>
            </DrawerFooter>
          )}
          {activeTab === "Approved" && selectedRequest && (
            <DrawerFooter>
              <Button
                variant="destructive"
                disabled={busyUserId === selectedRequest.user_id}
                onClick={async () => {
                  await handleDecision(selectedRequest.user_id, "decline");
                  setDrawerOpen(false);
                }}
              >
                {busyUserId === selectedRequest.user_id
                  ? "Removing…"
                  : "Remove from group"}
              </Button>
            </DrawerFooter>
          )}
        </DrawerContent>
      </Drawer>
    </div>
  );
}
