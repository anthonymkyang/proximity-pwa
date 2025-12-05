"use client";

import Link from "next/link";
import {
  Users,
  Calendar,
  Clock3,
  MapPin,
  ShoppingBag,
  ChevronRight,
} from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import Avatar14 from "@/components/shadcn-studio/avatar/avatar-14";

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
    title: "Places",
    href: "/app/activity/events",
    icon: MapPin,
  },
  {
    title: "Shop",
    href: "/app/shop",
    icon: ShoppingBag,
  },
  {
    title: "Marketplace",
    href: "/app/activity/marketplace",
    icon: ShoppingBag,
  },
];

const upcomingGroups = [
  { id: "g1", name: "Downtown Drinks", when: "Today · 7:30 PM" },
  { id: "g2", name: "Sunday Brunch Crew", when: "Sun · 11:00 AM" },
  { id: "g3", name: "Sunset Walk", when: "Mon · 6:00 PM" },
];

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
            {upcomingGroups.map((g) => (
              <div
                key={g.id}
                className="min-w-[60vw] max-w-[520px] rounded-xl sm:min-w-[380px]"
              >
                <div className="relative mb-3 aspect-[14/9] w-full overflow-hidden rounded-xl bg-card/60">
                  <div className="absolute left-3 bottom-3">
                    <Avatar className="size-12 border-2 border-background shadow">
                      <AvatarFallback className="text-[12px] font-semibold">
                        HG
                      </AvatarFallback>
                    </Avatar>
                  </div>
                </div>
                <div className="relative px-1">
                  <div className="text-sm font-semibold text-foreground pr-14">
                    {g.name}
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground pr-14">
                    {g.when}
                  </div>
                  <Avatar14
                    className="absolute right-1 top-1/2 -translate-y-1/2"
                    avatars={[
                      { fallback: "HG" },
                      { fallback: "AM" },
                      { fallback: "LR" },
                      { fallback: "XY" },
                    ]}
                  />
                </div>
              </div>
            ))}
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
            <div className="absolute inset-0 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 opacity-90" />
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
