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

type RawNotification = {
  id: string;
  group_id: string;
  actor_id: string;
  type: string | null;
  message: string | null;
  payload: Record<string, any> | null;
  created_at: string;
};

type NotificationItem = RawNotification & {
  actorName: string;
  actorAvatar: string | null;
  groupTitle: string | null;
  titleText: string;
  subtitleText: string | null;
  createdLabel: string;
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
  return d.toLocaleString(undefined, {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
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
  groupTitle: string,
  message?: string | null,
  payload?: Record<string, any> | null
) {
  const t = String(type || "").toLowerCase();
  const groupShort =
    groupTitle.length > 40 ? `${groupTitle.slice(0, 37)}...` : groupTitle;
  const messageText =
    (payload && (payload.message || payload.reason)) || message || null;

  switch (t) {
    case "group_created":
    case "created":
      return {
        title: "Group created",
        subtitle: groupShort,
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
      return {
        title: `${actorName} accepted an invite to join ${groupShort}`,
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

  React.useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        setLoading(true);
        const res = await fetch("/api/user/notifications/groups", {
          method: "GET",
        });
        if (!res.ok) {
          throw new Error("Failed to load notifications");
        }
        const data = await res.json();
        const hosting = data?.hosting ?? {};
        const cohosting = data?.cohosting ?? {};
        const flat: RawNotification[] = [
          ...Object.values(hosting).flat(),
          ...Object.values(cohosting).flat(),
        ] as RawNotification[];

        if (flat.length === 0) {
          if (active) {
            setItems([]);
            setError(null);
          }
          return;
        }

        const groupIds = Array.from(new Set(flat.map((n) => n.group_id)));
        const actorIds = Array.from(new Set(flat.map((n) => n.actor_id)));

        const supabase = createClient();
        const [{ data: groups }, { data: profiles }] = await Promise.all([
          supabase
            .from("groups")
            .select("id, title")
            .in("id", groupIds),
          supabase
            .from("profiles")
            .select("id, profile_title, name, avatar_url")
            .in("id", actorIds),
        ]);

        const groupMap = new Map(
          (groups ?? []).map((g) => [String(g.id), g])
        );
        const profileMap = new Map(
          (profiles ?? []).map((p) => [String(p.id), p])
        );

        const mapped = flat
          .map((n) => {
            const actor = profileMap.get(String(n.actor_id));
            const group = groupMap.get(String(n.group_id));
            const actorName =
              actor?.profile_title || actor?.name || "Someone";
            const groupTitle = group?.title || "your group";
            const copy = buildNotificationCopy(
              n.type,
              actorName,
              groupTitle,
              n.message,
              n.payload
            );
            return {
              ...n,
              actorName,
              actorAvatar: actor?.avatar_url || null,
              groupTitle,
              titleText: copy.title,
              subtitleText: copy.subtitle || null,
              createdLabel: formatTimestamp(n.created_at),
            } as NotificationItem;
          })
          .sort(
            (a, b) =>
              new Date(b.created_at).getTime() -
              new Date(a.created_at).getTime()
          );

        if (active) {
          setItems(mapped);
          setError(null);
        }
      } catch (err: any) {
        if (active) {
          setError(err?.message ?? "Failed to load notifications");
          setItems([]);
        }
      } finally {
        if (active) setLoading(false);
      }
    };

    load();
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
      <TopBar leftContent={<BackButton />} className="px-4" />
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

                  return (
                    <div
                      key={n.id}
                      className="flex items-start gap-3 rounded-lg border bg-card px-3 py-2"
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
                          <div className="text-sm font-medium truncate">
                            {n.titleText}
                          </div>
                          <div className="text-[11px] text-muted-foreground shrink-0">
                            {n.createdLabel}
                          </div>
                        </div>
                        {n.subtitleText ? (
                          <div className="mt-0.5 text-xs text-muted-foreground truncate">
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
