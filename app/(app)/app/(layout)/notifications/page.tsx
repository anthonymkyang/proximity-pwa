"use client";

import * as React from "react";
import TopBar from "@/components/nav/TopBar";
import BackButton from "@/components/ui/back-button";
import { createClient } from "@/utils/supabase/client";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Bell } from "lucide-react";
import { AnimatedEmoji } from "@/components/emoji/AnimatedEmoji";

type RawNotification = {
  id: string;
  recipient_id: string;
  actor_id: string | null;
  type: string | null;
  entity_type: string | null;
  entity_id: string | null;
  title: string | null;
  body: string | null;
  data: Record<string, any> | null;
  read_at: string | null;
  created_at: string;
};

type NotificationItem = RawNotification & {
  actorName: string;
  actorAvatar: string | null;
  groupTitle: string | null;
  titleText: string;
  subtitleText: string | null;
  createdLabel: string;
  reactionType?: string | null;
};

function initialsFrom(text?: string | null): string {
  if (!text) return "U";
  const parts = String(text).trim().split(/\s+/);
  const first = parts[0]?.[0] ?? "";
  const last = parts.length > 1 ? parts[parts.length - 1][0] ?? "" : "";
  return (first + last || first || "U").toUpperCase().slice(0, 2);
}

function resolveAvatarUrl(path?: string | null): string | null {
  if (!path) return null;
  const s = String(path);
  if (s.startsWith("http://") || s.startsWith("https://")) return s;
  return `/api/photos/avatars?path=${encodeURIComponent(s)}`;
}

function formatTimestamp(value: string) {
  const d = new Date(value);
  if (isNaN(d.getTime())) return "";
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  if (diffMs < 30 * 1000) return "Just now";
  if (diffMs < 60 * 60 * 1000) {
    const mins = Math.max(1, Math.round(diffMs / (60 * 1000)));
    return `${mins} mins ago`;
  }
  if (diffMs < 24 * 60 * 60 * 1000) {
    const hours = Math.max(1, Math.round(diffMs / (60 * 60 * 1000)));
    return `${hours} hours ago`;
  }
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const dateOnly = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const diffDays =
    (today.getTime() - dateOnly.getTime()) / (1000 * 60 * 60 * 24);
  if (diffDays === 1) return "Yesterday";
  if (diffDays <= 7) {
    return `On ${d.toLocaleDateString(undefined, { weekday: "long" })}`;
  }
  return d.toLocaleDateString(undefined, { day: "2-digit", month: "short" });
}

function getDayBucket(value: string) {
  const d = new Date(value);
  if (isNaN(d.getTime())) return "Earlier";
  const today = new Date();
  const dateOnly = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const todayOnly = new Date(
    today.getFullYear(),
    today.getMonth(),
    today.getDate()
  );
  const diffDays =
    (todayOnly.getTime() - dateOnly.getTime()) / (1000 * 60 * 60 * 24);
  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  return "Earlier";
}

function buildNotificationCopy(
  type: string | null,
  actorName: string,
  groupTitle?: string | null,
  message?: string | null,
  payload?: Record<string, any> | null
) {
  const t = String(type || "").toLowerCase();
  const safeGroupTitle = groupTitle || "a group";
  const groupShort =
    safeGroupTitle.length > 40
      ? `${safeGroupTitle.slice(0, 37)}...`
      : safeGroupTitle;
  const messageText =
    (payload && (payload.message || payload.reason)) || message || null;
  switch (t) {
    case "group_created":
    case "group-created":
    case "created":
      return {
        title: `${actorName} created a group, ${groupShort}`,
        subtitle: null,
      };
    case "cohost_invite_accepted":
    case "cohost_accepted":
      return {
        title: `Co-host accepted invite · ${groupShort}`,
        subtitle: actorName,
      };
    case "join_request":
    case "join-request":
    case "request_to_join":
      return {
        title: `${actorName} requested to join ${groupShort}`,
        subtitle: messageText,
      };
    case "group_updated":
    case "updated":
      return {
        title: "Group updated",
        subtitle: messageText,
      };
    case "group_cancelled":
    case "cancelled":
    case "canceled":
      return {
        title: "Group cancelled",
        subtitle: `${actorName} cancelled ${groupShort}`,
      };
    case "invite_accepted":
    case "join_accepted":
    case "join-approved":
    case "join_approved":
    case "group_join_approved":
    case "approved_to_attend":
      return {
        title: `You were approved to attend ${groupShort}`,
        subtitle: null,
      };
    case "profile_avatar_changed":
    case "display_pic_changed":
    case "avatar_changed":
      return {
        title: `${actorName} changed their display pic`,
        subtitle: null,
      };
    case "profile_reaction":
    case "profile-reacted":
      return {
        title: "Reacted to your profile.",
        subtitle: null,
      };
    case "member_left":
    case "left":
      return {
        title: `${actorName} left ${groupShort}`,
        subtitle: null,
      };
    default:
      return {
        title: groupShort,
        subtitle: messageText,
      };
  }
}

export default function NotificationsPage() {
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [items, setItems] = React.useState<NotificationItem[]>([]);

  const loadNotifications = React.useCallback(async () => {
    try {
      setLoading(true);
      const supabase = createClient();
      const { data: rows, error } = await supabase
        .from("notifications")
        .select(
          "id, recipient_id, actor_id, type, entity_type, entity_id, title, body, data, read_at, created_at"
        )
        .order("created_at", { ascending: false });

      if (error) {
        throw new Error(error.message || "Failed to load notifications");
      }

      const list = (rows ?? []) as RawNotification[];

      if (list.length === 0) {
        setItems([]);
        setError(null);
        return;
      }

      const groupIds = Array.from(
        new Set(
          list
            .map((n) => {
              if (n.entity_type === "group" && n.entity_id) {
                return String(n.entity_id);
              }
              if (n.data?.group_id) return String(n.data.group_id);
              return null;
            })
            .filter(Boolean) as string[]
        )
      );
      const actorIds = Array.from(
        new Set(list.map((n) => n.actor_id).filter(Boolean) as string[])
      );

      const [{ data: groups }, { data: profiles }] = await Promise.all([
        groupIds.length
          ? supabase.from("groups").select("id, title").in("id", groupIds)
          : Promise.resolve({ data: [] }),
        actorIds.length
          ? supabase
              .from("profiles")
              .select("id, profile_title, name, avatar_url")
              .in("id", actorIds)
          : Promise.resolve({ data: [] }),
      ]);

      const groupMap = new Map((groups ?? []).map((g) => [String(g.id), g]));
      const profileMap = new Map(
        (profiles ?? []).map((p) => [String(p.id), p])
      );

        const mapped = list
          .map((n) => {
            const actor = n.actor_id
              ? profileMap.get(String(n.actor_id))
              : null;
          const groupKey =
            n.entity_type === "group" && n.entity_id
              ? String(n.entity_id)
              : n.data?.group_id
              ? String(n.data.group_id)
              : null;
          const group = groupKey ? groupMap.get(groupKey) : null;
          const actorName = actor?.profile_title || actor?.name || "Someone";
          const groupTitle =
            group?.title ||
            n.data?.group_title ||
            n.data?.group?.title ||
            null;
            const rawTitle = n.title?.trim() || null;
            const rawBody = n.body?.trim() || null;
            const reactionType =
              n.type?.toLowerCase() === "profile_reaction" ||
              n.type?.toLowerCase() === "profile-reacted"
                ? String(
                    n.data?.reaction || n.data?.reaction_type || ""
                  ).toLowerCase() || null
                : null;
            const copy = buildNotificationCopy(
              n.type,
              actorName,
              groupTitle,
              rawBody,
              n.data
            );
            return {
              ...n,
              actorName,
              actorAvatar: actor?.avatar_url || null,
              groupTitle,
              titleText: rawTitle || copy.title,
              subtitleText: rawBody || copy.subtitle || null,
              createdLabel: formatTimestamp(n.created_at),
              reactionType,
            } as NotificationItem;
          })
        .sort(
          (a, b) =>
            new Date(b.created_at).getTime() -
            new Date(a.created_at).getTime()
        );

      setItems(mapped);
      setError(null);
    } catch (err: any) {
      setError(err?.message ?? "Failed to load notifications");
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    let active = true;
    const load = async () => {
      if (!active) return;
      await loadNotifications();
    };
    load();
    return () => {
      active = false;
    };
  }, [loadNotifications]);

  React.useEffect(() => {
    let mounted = true;
    const supabase = createClient();
    let channel: ReturnType<typeof supabase.channel> | null = null;

    const subscribe = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!mounted || !user) return;
      channel = supabase
        .channel(`notifications:${user.id}`)
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "notifications",
            filter: `recipient_id=eq.${user.id}`,
          },
          () => {
            void loadNotifications();
          }
        )
        .subscribe();
    };

    void subscribe();

    return () => {
      mounted = false;
      if (channel) {
        supabase.removeChannel(channel);
      }
    };
  }, [loadNotifications]);

  React.useEffect(() => {
    const supabase = createClient();
    let active = true;
    const markRead = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!active || !user) return;
      await supabase
        .from("notifications")
        .update({ read_at: new Date().toISOString() })
        .eq("recipient_id", user.id)
        .is("read_at", null);
    };
    void markRead();
    return () => {
      active = false;
    };
  }, []);

  const grouped = React.useMemo(() => {
    const buckets: Record<string, NotificationItem[]> = {
      Today: [],
      Yesterday: [],
      Earlier: [],
    };
    items.forEach((n) => {
      const key = getDayBucket(n.created_at);
      if (!buckets[key]) buckets[key] = [];
      buckets[key].push(n);
    });
    return buckets;
  }, [items]);

  return (
    <div className="pb-[calc(72px+env(safe-area-inset-bottom))]">
      <TopBar
        leftContent={<BackButton />}
        showNotificationsButton={false}
        className="px-4"
      />
      <h1 className="px-5 pb-3 text-4xl font-extrabold tracking-tight">
        Notifications
      </h1>

      <div className="space-y-5 px-4">
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="flex items-start gap-3 rounded-lg border bg-card px-3 py-2">
                <Skeleton className="h-8 w-8 rounded-full" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-2/3" />
                  <Skeleton className="h-3 w-1/2" />
                </div>
              </div>
            ))}
          </div>
        ) : error ? (
          <div className="text-sm text-destructive">{error}</div>
        ) : items.length === 0 ? (
          <Empty>
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <Bell className="h-6 w-6" />
              </EmptyMedia>
              <EmptyTitle>No notifications yet</EmptyTitle>
              <EmptyDescription>
                Activity updates will show up here as they happen.
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          Object.entries(grouped).map(([label, list]) =>
            list.length ? (
              <div key={label} className="space-y-3">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground px-1">
                  {label}
                </h3>
                {list.map((n) => {
                  const avatarInitials = initialsFrom(n.actorName);
                  const avatarUrl = resolveAvatarUrl(n.actorAvatar);
                  const reactionMeta =
                    n.reactionType === "heart"
                      ? { src: "/emoji/red-heart.json", emoji: "❤️" }
                      : n.reactionType === "fire"
                      ? { src: "/emoji/fire.json", emoji: "🔥" }
                      : n.reactionType === "imp"
                      ? {
                          src: "/emoji/imp-smile.json",
                          emoji: "😈",
                          restFrameFraction: 0.5,
                        }
                      : n.reactionType === "peeking"
                      ? { src: "/emoji/peeking.json", emoji: "👀" }
                      : null;

                  return (
                    <div
                      key={n.id}
                      className="flex items-center gap-3 rounded-lg bg-card px-3 py-2"
                    >
                      <Avatar className="h-8 w-8">
                        {avatarUrl ? (
                          <AvatarImage src={avatarUrl} alt={n.actorName} />
                        ) : null}
                        <AvatarFallback className="text-xs">
                          {avatarInitials}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <div className="text-sm font-medium inline-flex items-center gap-2">
                            <span>{n.groupTitle || n.titleText}</span>
                            {reactionMeta ? (
                              <AnimatedEmoji
                                src={reactionMeta.src}
                                fallback={reactionMeta.emoji}
                                size={18}
                                restFrameFraction={
                                  reactionMeta.restFrameFraction ?? 0.5
                                }
                                playOnce
                                className="pointer-events-none"
                                disableAnimation
                              />
                            ) : null}
                          </div>
                          <div className="text-[11px] text-muted-foreground shrink-0">
                            {n.createdLabel}
                          </div>
                        </div>
                        {n.subtitleText ? (
                          <div className="mt-0.5 text-xs text-muted-foreground">
                            {n.subtitleText}
                          </div>
                        ) : null}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : null
          )
        )}
      </div>
    </div>
  );
}
