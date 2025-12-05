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
  Item,
  ItemMedia,
  ItemContent,
  ItemTitle,
  ItemDescription,
} from "@/components/ui/item";
import { CheckCircle2, UserX2, Clock } from "lucide-react";

interface Profile {
  id: string;
  profile_title: string | null;
  name: string | null;
  avatar_url: string | null;
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
  const [currentUserId, setCurrentUserId] = React.useState<string | null>(null);
  const [canModerate, setCanModerate] = React.useState(false);
  const [rows, setRows] = React.useState<RequestRow[]>([]);
  const [busyUserId, setBusyUserId] = React.useState<string | null>(null);

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
          .select("id, title, host_id, cohost_ids")
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
        }

        const hostId: string | null = (group as any)?.host_id ?? null;
        const cohostIds: string[] = Array.isArray((group as any)?.cohost_ids)
          ? ((group as any).cohost_ids as string[])
          : [];

        const isHostOrCohost =
          !!uid && (uid === hostId || cohostIds.includes(uid));
        if (!cancelled) setCanModerate(isHostOrCohost);

        if (!isHostOrCohost) {
          if (!cancelled) setRows([]);
          return;
        }

        const { data: attendeeRows, error: attErr } = await supabase
          .from("group_attendees")
          .select("user_id, status, message, created_at")
          .eq("group_id", groupId)
          .eq("status", "pending")
          .order("created_at", { ascending: true });

        if (attErr) throw attErr;

        if (!cancelled) {
          const pending = (attendeeRows || []) as {
            user_id: string;
            status: string | null;
            message: string | null;
            created_at: string | null;
          }[];

          const userIds = Array.from(
            new Set(pending.map((r) => r.user_id).filter(Boolean))
          );

          let profileMap = new Map<string, Profile>();

          if (userIds.length) {
            const { data: profilesData, error: profErr } = await supabase
              .from("profiles")
              .select("id, profile_title, name, avatar_url")
              .in("id", userIds);

            if (profErr) throw profErr;

            profileMap = new Map(
              (profilesData || []).map((p: any) => [
                p.id as string,
                p as Profile,
              ])
            );
          }

          const withProfiles: RequestRow[] = pending.map((r) => ({
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
          .delete()
          .eq("group_id", groupId)
          .eq("user_id", userId);

        if (error) throw error;
      }

      setRows((prev) => prev.filter((r) => r.user_id !== userId));
    } catch (e) {
      console.error("handleDecision error", e);
    } finally {
      setBusyUserId((prev) => (prev === userId ? null : prev));
    }
  }

  const pendingCount = rows.length;

  return (
    <div className="mx-auto w-full max-w-xl px-5 pb-[calc(80px+env(safe-area-inset-bottom))]">
      <div className="pb-3">
        <h1 className="text-xl font-semibold tracking-tight">Requests</h1>
        <p className="mt-0.5 text-xs text-muted-foreground">{groupTitle}</p>
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
          ) : pendingCount === 0 ? (
            <div className="mt-6 rounded-xl border bg-card px-4 py-6 text-center text-sm text-muted-foreground">
              <p className="font-medium mb-1">No pending requests</p>
              <p>
                When someone requests to join this group, their request will
                appear here.
              </p>
            </div>
          ) : (
            <>
              <div className="mb-2 flex items-center justify-between">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">
                  Pending requests
                </p>
                <Badge variant="secondary" className="text-[11px]">
                  {pendingCount} {pendingCount === 1 ? "person" : "people"}
                </Badge>
              </div>

              <div className="space-y-3">
                {rows.map((row) => {
                  const name =
                    row.profile?.profile_title || row.profile?.name || "Guest";
                  const avatarSrc = row.profile?.avatar_url ?? null;
                  const created = formatTime(row.created_at);

                  return (
                    <Item
                      key={row.user_id}
                      variant="outline"
                      className="items-start"
                    >
                      <ItemMedia>
                        <Avatar className="h-10 w-10">
                          {avatarSrc ? (
                            <AvatarImage src={avatarSrc} alt={name} />
                          ) : null}
                          <AvatarFallback className="text-xs">
                            {initials(name)}
                          </AvatarFallback>
                        </Avatar>
                      </ItemMedia>
                      <ItemContent>
                        <ItemTitle className="flex items-center gap-2">
                          <Link
                            href={`/app/profile/${row.user_id}`}
                            className="underline-offset-2 hover:underline"
                          >
                            {name}
                          </Link>
                          {created ? (
                            <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                              <Clock className="h-3 w-3" />
                              {created}
                            </span>
                          ) : null}
                        </ItemTitle>
                        {row.message ? (
                          <ItemDescription className="text-xs text-muted-foreground mt-1 whitespace-pre-wrap">
                            {row.message}
                          </ItemDescription>
                        ) : (
                          <ItemDescription className="text-xs text-muted-foreground mt-1">
                            No message provided.
                          </ItemDescription>
                        )}
                      </ItemContent>
                      <div className="flex flex-col gap-2 pl-3">
                        <Button
                          size="sm"
                          className="h-8 px-3 rounded-full flex items-center gap-1"
                          disabled={busyUserId === row.user_id}
                          onClick={() => handleDecision(row.user_id, "accept")}
                        >
                          {busyUserId === row.user_id ? (
                            "Saving…"
                          ) : (
                            <>
                              <CheckCircle2 className="h-4 w-4" />
                              <span>Accept</span>
                            </>
                          )}
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-8 px-3 rounded-full flex items-center gap-1 text-destructive border-destructive/40"
                          disabled={busyUserId === row.user_id}
                          onClick={() => handleDecision(row.user_id, "decline")}
                        >
                          <UserX2 className="h-4 w-4" />
                          <span>Decline</span>
                        </Button>
                      </div>
                    </Item>
                  );
                })}
              </div>
            </>
          )}
        </section>
      ) : null}
    </div>
  );
}
