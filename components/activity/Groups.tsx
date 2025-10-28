"use client";

import * as React from "react";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { MoreHorizontal, ChevronRight } from "lucide-react";
import Link from "next/link";

export default function Groups() {
  return (
    <>
      {/* Your groups section */}
      <section className="mt-4">
        <h2 className="text-lg font-semibold px-1 mb-3">Your groups</h2>
        <div className="flex gap-3 overflow-x-auto -mx-4 px-4 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
          {[
            { name: "Weekend Hikers", fallback: "WH" },
            { name: "Coffee Crew", fallback: "CC" },
            { name: "Gym Buddies", fallback: "GB" },
            { name: "After Hours", fallback: "AH" },
            { name: "Sunday Funday", fallback: "SF" },
          ].map((group) => (
            <Link
              key={group.name}
              href="/app/activity/group"
              className="flex flex-col items-start gap-2"
            >
              <div className="relative w-36 aspect-4/3 rounded-xl bg-muted flex items-center justify-center text-sm font-medium text-muted-foreground shrink-0">
                {group.fallback}

                {/* Date badge */}
                <div className="absolute -top-2 -right-2 bg-card text-card-foreground rounded-full h-10 w-10 flex flex-col items-center justify-center shadow-md">
                  <span className="text-xs font-bold leading-tight">28</span>
                  <span className="text-[10px] font-light tracking-tight">
                    OCT
                  </span>
                </div>

                {/* Status dot and label */}
                <div className="absolute bottom-2 left-2 flex items-center gap-1">
                  <span
                    className={`block h-2.5 w-2.5 rounded-full ${
                      group.name === "Weekend Hikers"
                        ? "bg-red-500"
                        : "bg-blue-500"
                    }`}
                  />
                  <span className="text-[10px] font-medium text-foreground opacity-80">
                    {group.name === "Weekend Hikers" ? "Hosting" : "Attending"}
                  </span>
                </div>
              </div>
              <p className="text-xs text-muted-foreground w-28 truncate">
                {group.name}
              </p>
            </Link>
          ))}
        </div>
      </section>

      {/* Upcoming section */}
      <section className="mt-8">
        {/* Dark summary card */}
        <div className="relative rounded-2xl bg-foreground/90 text-background p-4 shadow-[0_20px_40px_-15px_rgba(0,0,0,0.35)]">
          <div className="flex items-start justify-between">
            <div>
              <h3 className="text-2xl font-semibold">Upcoming</h3>
              <p className="text-sm/6 opacity-70">In the next 2 weeks</p>
            </div>
            <button
              className="opacity-60 hover:opacity-100"
              aria-label="More options"
            >
              <MoreHorizontal className="h-5 w-5" />
            </button>
          </div>
          {/* Calendar dots row */}
          <div className="mt-6 flex gap-2 flex-wrap">
            {[8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21].map((d) => (
              <div
                key={d}
                className={`flex h-8 w-8 items-center justify-center rounded-full bg-background/10 text-background/80 ${
                  d === 12 ? "ring-2 ring-background/80" : ""
                }`}
              >
                <span className="text-xs font-medium">{d}</span>
              </div>
            ))}
          </div>
        </div>

        {/* List below with soft cards */}
        <div className="mt-4 space-y-3">
          {[
            {
              month: "Apr",
              day: "14",
              title: "Queer Hikers Meetup",
              subtitle: "Outdoor Social",
              lock: true,
              color: "bg-emerald-200",
            },
            {
              month: "Apr",
              day: "18",
              title: "Sunday Brunch Boys",
              subtitle: "Community Hangout",
              lock: false,
              color: "bg-amber-200",
            },
            {
              month: "Apr",
              day: "25",
              title: "Drag Trivia Sunday",
              subtitle: "Evening Fun",
              lock: true,
              color: "bg-pink-200",
            },
          ].map((e) => (
            <div
              key={`${e.month}-${e.day}-${e.title}`}
              className="rounded-2xl bg-card text-card-foreground border shadow-sm"
            >
              <div className="flex items-center gap-3 px-3 py-3">
                {/* Date gutter */}
                <div className="w-14 text-center">
                  <div className="text-xs text-muted-foreground leading-none">
                    {e.month}
                  </div>
                  <div className="text-xl font-semibold leading-tight">
                    {e.day}
                  </div>
                </div>
                {/* Thumb */}
                <div className={`h-10 w-10 ${e.color} rounded-lg shrink-0`} />
                {/* Content */}
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold">{e.title}</p>
                  {e.subtitle ? (
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {e.subtitle}
                    </p>
                  ) : null}
                </div>
                {/* Trailing icon */}
                {e.lock ? (
                  <div className="h-5 w-5 rounded-full bg-green-200 flex items-center justify-center">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="3"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="h-3.5 w-3.5 text-green-700"
                    >
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  </div>
                ) : (
                  <ChevronRight className="h-5 w-5 text-muted-foreground" />
                )}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Nearby groups */}
      <section className="mt-8">
        <h2 className="text-lg font-semibold px-1 mb-3">Nearby groups</h2>
        <div className="space-y-3">
          {[
            {
              name: "East End Runners",
              distance: "0.4 km away",
              category: "outdoor",
            },
            {
              name: "Shoreditch Coffee Crew",
              distance: "0.9 km away",
              category: "social",
            },
            {
              name: "Vauxhall Night Owls",
              distance: "1.2 km away",
              category: "nightlife",
            },
            {
              name: "Pride Film Club",
              distance: "1.8 km away",
              category: "arts",
            },
          ].map((g, idx) => {
            const categoryColors: Record<string, string> = {
              outdoor: "bg-emerald-200",
              social: "bg-amber-200",
              nightlife: "bg-pink-200",
              arts: "bg-sky-200",
            };
            const colorClass = categoryColors[g.category] ?? "bg-muted";
            const distNum = g.distance.split(" ")[0];
            return (
              <Link
                key={g.name}
                href="/app/activity/group"
                className="rounded-xl border bg-card text-card-foreground px-3 py-3 flex items-center gap-3"
              >
                {/* Left circular distance badge */}
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted shrink-0">
                  <div className="text-center leading-tight">
                    <div className="text-sm font-semibold">{distNum}</div>
                    <div className="text-[10px] text-muted-foreground">km</div>
                  </div>
                </div>

                {/* Square thumb with category color */}
                <div
                  className={`${colorClass} h-10 w-10 rounded-lg shrink-0`}
                />

                {/* Content: name + overlapping avatars */}
                <div className="min-w-0 flex-1">
                  <p className="font-medium truncate">{g.name}</p>
                  <div className="mt-1 flex items-center">
                    <div className="flex -space-x-2">
                      {[0, 1, 2, 3, 4, 5].map((i) => (
                        <Avatar key={i} className="h-6 w-6 ring-2 ring-card">
                          <AvatarImage
                            src={undefined as unknown as string}
                            alt=""
                          />
                          <AvatarFallback className="text-[10px]">
                            {"AB"[0]}
                            {(i + idx) % 10}
                          </AvatarFallback>
                        </Avatar>
                      ))}
                    </div>
                    <span className="ml-2 text-[11px] text-muted-foreground">
                      +12
                    </span>
                  </div>
                </div>

                {/* Right green tick (same as Upcoming) */}
                <div className="h-5 w-5 rounded-full bg-green-200 flex items-center justify-center">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="3"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="h-3.5 w-3.5 text-green-700"
                  >
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                </div>
              </Link>
            );
          })}
        </div>
      </section>
    </>
  );
}
