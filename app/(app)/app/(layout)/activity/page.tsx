"use client";

import * as React from "react";
import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Users,
  Calendar,
  Clock3,
  CalendarDays,
  ShoppingBag,
  MessageSquare,
  ChevronRight,
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import Avatar14 from "@/components/shadcn-studio/avatar/avatar-14";
import { Badge } from "@/components/ui/badge";

const sections = [
  {
    title: "Groups",
    href: "/app/activity/groups",
    icon: Users,
  },
  {
    title: "Calendar",
    href: "/app/activity/calendar",
    icon: Calendar,
  },
  {
    title: "Timeline",
    href: "/app/activity/timeline",
    icon: Clock3,
  },
  {
    title: "Events",
    href: "/app/activity/events",
    icon: CalendarDays,
  },
  {
    title: "Marketplace",
    href: "/app/marketplace",
    icon: ShoppingBag,
  },
  {
    title: "Channels",
    href: "/app/channels",
    icon: MessageSquare,
  },
];

const CATEGORY_BADGE_COLORS: Record<string, string> = {
  social: "bg-sky-200 text-sky-900",
  sports: "bg-emerald-200 text-emerald-900",
  food: "bg-amber-200 text-amber-900",
  arts: "bg-violet-200 text-violet-900",
  gaming: "bg-fuchsia-200 text-fuchsia-900",
  learning: "bg-indigo-200 text-indigo-900",
};

function getCategoryBadgeClass(categoryName?: string): string {
  if (!categoryName) return "";
  const normalized = categoryName.toLowerCase().trim();
  return CATEGORY_BADGE_COLORS[normalized] || "bg-gray-200 text-gray-900";
}

function formatDateShort(dateStr: string): string {
  const date = new Date(dateStr);
  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  if (date.toDateString() === today.toDateString()) return "Today";
  if (date.toDateString() === tomorrow.toDateString()) return "Tomorrow";

  return date.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

function formatTime(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

const latestOffers = [
  {
    id: "o1",
    title: "Kvrt",
    reward: "11% Reward",
    label: "FLASH",
  },
  {
    id: "o2",
    title: "Radley",
    reward: "12% Reward",
    label: "FLASH",
  },
  {
    id: "o3",
    title: "Speedo",
    reward: "10% Reward",
    label: "FLASH",
  },
];

const earnPoints = [
  { id: "p1", name: "Kvrt", badge: "Unlock" },
  { id: "p2", name: "Prowler", badge: null },
  { id: "p3", name: "MisterB", badge: "New" },
  { id: "p4", name: "Booking", badge: "Flash" },
  { id: "p5", name: "Bolt", badge: null },
  { id: "p6", name: "Regulation", badge: null },
];

export default function ActivityPage() {
  const firstRow = sections.slice(0, 4);
  const secondRow = sections.slice(4);

  const [myGroups, setMyGroups] = useState<any[] | null>(null);
  const [avatarStacks, setAvatarStacks] = useState<
    Record<
      string,
      {
        avatars: { src?: string; name?: string; fallback?: string }[];
        extra: number;
      }
    >
  >({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadGroups() {
      try {
        const response = await fetch("/api/groups/activity");
        if (!response.ok) throw new Error("Failed to load groups");

        const data = await response.json();
        setMyGroups(data.groups || []);
        setAvatarStacks(data.attendeeAvatars || {});
      } catch (error) {
        console.error("Error fetching groups:", error);
        setMyGroups([]);
      } finally {
        setLoading(false);
      }
    }

    loadGroups();
  }, []);

  // Helper functions from groups page
  function isFuture(dateStr?: string | null): boolean {
    if (!dateStr) return false;
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return false;
    return d.getTime() > new Date().getTime();
  }

  function isCurrentlyHappening(dateStr?: string | null): boolean {
    if (!dateStr) return false;
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return false;
    const now = new Date().getTime();
    const fourHoursInMs = 4 * 60 * 60 * 1000;
    const eventTime = d.getTime();
    return eventTime <= now + fourHoursInMs && eventTime > now - fourHoursInMs;
  }

  // Filter for upcoming groups (same as groups page)
  const upcomingGroups = React.useMemo(
    () =>
      myGroups?.filter(
        (g) => isFuture(g.nextDate) && g.lifecycleStatus !== "in_progress"
      ) || [],
    [myGroups]
  );

  return (
    <>
      <h1 className="px-1 pb-3 text-4xl font-extrabold tracking-tight">
        Activity
      </h1>

      <div className="grid grid-cols-4 gap-3">
        {firstRow.map((section) => (
          <Link
            key={section.href}
            href={section.href}
            className="block rounded-2xl bg-card/60 p-4 shadow-sm transition hover:bg-card"
          >
            <div className="flex h-full flex-col items-center justify-center gap-2 text-center">
              <section.icon className="h-6 w-6 text-muted-foreground" />
              <div className="text-sm font-semibold text-foreground">
                {section.title}
              </div>
            </div>
          </Link>
        ))}
      </div>

      {secondRow.length > 0 && (
        <div className="mt-3 grid grid-cols-2 gap-3">
          {secondRow.map((section) => (
            <Link
              key={section.href}
              href={section.href}
              className="block rounded-2xl bg-card/60 p-4 shadow-sm transition hover:bg-card"
            >
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <section.icon className="h-6 w-6 text-muted-foreground" />
                  <div className="text-base font-semibold text-foreground">
                    {section.title}
                  </div>
                </div>
                <ChevronRight className="h-5 w-5 text-muted-foreground" />
              </div>
            </Link>
          ))}
        </div>
      )}

      <div className="mt-10 space-y-14 pb-8">
        <section className="space-y-3">
          <p className="px-1 text-xs font-semibold tracking-wider text-muted-foreground uppercase mb-3">
            Upcoming groups
          </p>
          <div className="-mx-4 flex gap-3 overflow-x-auto px-4 pb-2 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]{display:none;}">
            {loading ? (
              <div className="flex gap-3">
                {[1, 2, 3].map((i) => (
                  <div
                    key={i}
                    className="min-w-[60vw] max-w-[520px] rounded-xl sm:min-w-[380px] space-y-2"
                  >
                    <div className="aspect-14/9 w-full rounded-xl bg-muted animate-pulse" />
                    <div className="h-4 bg-muted rounded animate-pulse" />
                    <div className="h-3 bg-muted rounded w-2/3 animate-pulse" />
                  </div>
                ))}
              </div>
            ) : upcomingGroups.length > 0 ? (
              upcomingGroups.map((g) => {
                const groupName = g.title || g.name || "Unnamed Group";
                const dateStr = g.nextDate;
                const coverUrl = g.cover_image_url
                  ? g.cover_image_url.startsWith("http")
                    ? g.cover_image_url
                    : `/api/groups/storage?path=${encodeURIComponent(
                        g.cover_image_url.replace(/^\//, "")
                      )}`
                  : null;

                return (
                  <div
                    key={g.id}
                    className="min-w-[60vw] max-w-[520px] rounded-xl sm:min-w-[380px] cursor-pointer hover:opacity-80 transition"
                  >
                    <div className="relative mb-3 aspect-14/9 w-full overflow-hidden rounded-xl bg-card/60">
                      {coverUrl && (
                        <img
                          src={coverUrl}
                          alt={groupName}
                          className="h-full w-full object-cover"
                          onError={(e) => {
                            (
                              e.currentTarget as HTMLImageElement
                            ).style.display = "none";
                          }}
                        />
                      )}
                      <div className="absolute left-3 bottom-3">
                        <Avatar className="size-12 border-2 border-background shadow-lg drop-shadow-lg">
                          {g.hostProfile?.avatar_url && (
                            <AvatarImage
                              src={
                                g.hostProfile.avatar_url.startsWith("http")
                                  ? g.hostProfile.avatar_url
                                  : `/api/photos/avatars?path=${encodeURIComponent(
                                      g.hostProfile.avatar_url
                                    )}`
                              }
                              alt={g.hostProfile.name || groupName}
                            />
                          )}
                          <AvatarFallback className="text-[12px] font-semibold">
                            {(g.hostProfile?.name || groupName)
                              ?.slice(0, 2)
                              .toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                      </div>
                    </div>
                    <div className="relative px-1">
                      <div className="text-sm font-semibold text-foreground pr-14 truncate">
                        {groupName}
                      </div>
                      {g.categoryName && (
                        <div className="mt-0.5 pr-14">
                          <Badge
                            className={`px-2 py-0.5 text-[10px] rounded-full ${getCategoryBadgeClass(
                              g.categoryName
                            )}`}
                          >
                            {g.categoryName}
                          </Badge>
                        </div>
                      )}
                      {dateStr && (
                        <div className="mt-1 text-xs text-muted-foreground pr-14">
                          {formatDateShort(dateStr)} · {formatTime(dateStr)}
                        </div>
                      )}
                      {avatarStacks &&
                      avatarStacks[g.id] &&
                      avatarStacks[g.id].avatars.length > 0 ? (
                        <div className="absolute right-1 top-1/2 -translate-y-1/2 flex -space-x-2">
                          {avatarStacks[g.id].avatars.map((a, idx) => (
                            <Avatar
                              key={`${g.id}-av-${idx}`}
                              className="h-7 w-7 ring-2 ring-background"
                            >
                              {a.src ? (
                                <img
                                  src={a.src}
                                  alt={a.name || "User"}
                                  className="h-full w-full object-cover rounded-full"
                                />
                              ) : null}
                              {!a.src ? (
                                <AvatarFallback className="text-[10px]">
                                  {a.fallback || ""}
                                </AvatarFallback>
                              ) : null}
                            </Avatar>
                          ))}
                          {avatarStacks[g.id].extra > 0 && (
                            <Avatar className="h-7 w-7 ring-2 ring-background">
                              <AvatarFallback className="text-[10px]">
                                +{avatarStacks[g.id].extra}
                              </AvatarFallback>
                            </Avatar>
                          )}
                        </div>
                      ) : null}
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="w-full py-8 text-center text-sm text-muted-foreground">
                No upcoming groups
              </div>
            )}
          </div>
        </section>

        <section className="space-y-3">
          <p className="px-1 text-xs font-semibold tracking-wider text-muted-foreground uppercase mb-3">
            Latest offers
          </p>
          <div className="-mx-4 flex gap-3 overflow-x-auto px-4 pb-2 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]{display:none;}">
            {latestOffers.map((o) => (
              <div
                key={o.id}
                className="relative min-w-[200px] overflow-hidden rounded-xl"
              >
                <div className="relative aspect-square w-full rounded-xl bg-card/60">
                  <div className="absolute left-3 bottom-3">
                    <Avatar className="size-12 border-2 border-background shadow">
                      <AvatarFallback className="text-[12px] font-semibold">
                        {o.title.slice(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                  </div>
                </div>
                <div className="py-3">
                  <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                    {o.title}
                  </div>
                  <div className="text-xs text-foreground/80">{o.reward}</div>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="space-y-3">
          <p className="px-1 text-xs font-semibold tracking-wider text-muted-foreground uppercase mb-3">
            Earn points
          </p>
          <div className="-mx-4 flex gap-3 overflow-x-auto px-4 py-2 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]{display:none;}">
            {earnPoints.map((p) => (
              <div key={p.id} className="flex flex-col items-center gap-1">
                <div className="relative">
                  <Avatar
                    className={`size-16 border-2 border-background bg-card shadow ring-2 ring-offset-2 ring-offset-background ${
                      p.badge === "New"
                        ? "ring-sky-400"
                        : p.badge === "Flash"
                        ? "ring-amber-300"
                        : "ring-primary"
                    }`}
                  >
                    <AvatarFallback className="text-[14px] font-semibold">
                      {p.name.slice(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  {p.badge ? (
                    <div
                      className={`absolute left-1/2 top-full -translate-x-1/2 -translate-y-3 rounded-full px-2 py-0.5 text-[10px] font-semibold shadow ${
                        p.badge === "New"
                          ? "bg-sky-500 text-white"
                          : p.badge === "Flash"
                          ? "bg-amber-400 text-black"
                          : "bg-primary text-primary-foreground"
                      }`}
                    >
                      {p.badge}
                    </div>
                  ) : null}
                </div>
                <div className="pt-2 text-xs font-semibold text-foreground max-w-[72px] truncate text-center">
                  {p.name}
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="space-y-3">
          <p className="px-1 text-xs font-semibold tracking-wider text-muted-foreground uppercase mb-3">
            Find places near you
          </p>
          <div className="relative h-48 w-full overflow-hidden rounded-2xl bg-card/70 shadow-sm">
            <div className="absolute inset-0 bg-linear-to-br from-slate-900 via-slate-800 to-slate-900 opacity-90" />
            <div className="absolute inset-0">
              <div className="absolute left-6 top-8 h-3 w-3 rounded-full bg-primary shadow-md" />
              <div className="absolute left-1/2 top-16 h-3 w-3 rounded-full bg-primary shadow-md" />
              <div className="absolute right-10 top-24 h-3 w-3 rounded-full bg-primary shadow-md" />
              <div className="absolute left-16 bottom-10 h-3 w-3 rounded-full bg-primary shadow-md" />
              <div className="absolute right-1/3 bottom-6 h-3 w-3 rounded-full bg-primary shadow-md" />
              <svg
                className="absolute inset-0 h-full w-full text-slate-700"
                viewBox="0 0 400 200"
                preserveAspectRatio="none"
              >
                <path
                  d="M10 120 L80 90 L140 130 L220 100 L300 140 L380 110"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="4"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <path
                  d="M40 60 L120 80 L200 60 L260 90 L340 70"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeDasharray="10 8"
                />
              </svg>
            </div>
            <div className="absolute right-4 bottom-4 rounded-full bg-primary px-3 py-1 text-xs font-semibold text-primary-foreground shadow">
              View map
            </div>
          </div>
        </section>
      </div>
    </>
  );
}
