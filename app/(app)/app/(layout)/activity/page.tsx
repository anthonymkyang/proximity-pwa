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
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import Avatar14 from "@/components/shadcn-studio/avatar/avatar-14";
import { GroupScrolling } from "@/components/activity/groups/listing/GroupScrolling";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty";

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
        const myGroupsList = data.groups || [];
        const listings = data.listings || [];

        // Add any live listings that aren't already in myGroups
        const myGroupIds = new Set(myGroupsList.map((g: any) => g.id));
        const liveListings = listings
          .filter((g: any) => g.live === true && !myGroupIds.has(g.id))
          .map((g: any) => ({
            ...g,
            title: g.name || g.title,
            nextDate: g.start_time,
            membershipStatus: "attending" as const,
          }));

        const allGroups = [...myGroupsList, ...liveListings];

        // Sort: live groups first, then by start time (earliest first)
        allGroups.sort((a, b) => {
          const aLive = (a as any).live === true;
          const bLive = (b as any).live === true;
          if (aLive && !bLive) return -1;
          if (!aLive && bLive) return 1;

          const aTime = new Date(a.nextDate || a.start_time || 0).getTime();
          const bTime = new Date(b.nextDate || b.start_time || 0).getTime();
          return aTime - bTime;
        });

        setMyGroups(allGroups);
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

  // Filter for upcoming groups (includes live/in-progress groups)
  const upcomingGroups = React.useMemo(
    () =>
      myGroups?.filter(
        (g) =>
          (g as any).live === true ||
          (isFuture(g.nextDate) && !isCurrentlyHappening(g.nextDate))
      ) || [],
    [myGroups]
  );

  return (
    <>
      <h1 className="px-5 pb-3 text-4xl font-extrabold tracking-tight">
        Activity
      </h1>

      <div className="grid grid-cols-4 gap-3 px-4">
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
        <div className="mt-3 grid grid-cols-2 gap-3 px-4">
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

      <div className="mt-10 pb-8"></div>
    </>
  );
}
