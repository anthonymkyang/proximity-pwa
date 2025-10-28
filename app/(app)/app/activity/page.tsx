"use client";

import * as React from "react";

import TopBar from "@/components/nav/TopBar";
import { Button } from "@/components/ui/button";
import { MoreHorizontal, Bell, Lock, ChevronRight } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export default function ActivityPage() {
  const [activeTab, setActiveTab] = React.useState<
    "Groups" | "Calendar" | "Timeline" | "Events"
  >("Groups");

  return (
    <div className="mx-auto w-full max-w-xl px-4 pb-[calc(72px+env(safe-area-inset-bottom))]">
      <TopBar
        leftContent={
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" aria-label="Menu">
                <MoreHorizontal className="h-5 w-5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="start"
              sideOffset={8}
              className="min-w-56"
            >
              <DropdownMenuItem>Manage groups</DropdownMenuItem>
              <DropdownMenuItem>Manage calendar</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        }
        rightContent={
          <Button
            variant="default"
            size="icon"
            className="relative rounded-full"
            aria-label="Notifications"
          >
            <Bell className="h-5 w-5" />
            <span className="absolute bottom-0 right-0 block h-2.5 w-2.5 rounded-full bg-red-500" />
          </Button>
        }
      >
        <h1 className="px-1 pb-2 text-4xl font-extrabold tracking-tight">
          Activity
        </h1>

        {/* Filter chips */}
        <div className="flex gap-2 overflow-x-auto pb-3 -mx-4 px-4 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
          {["Groups", "Calendar", "Timeline", "Events"].map((label) => (
            <Button
              key={label}
              size="sm"
              variant={activeTab === label ? "default" : "outline"}
              className="rounded-full whitespace-nowrap"
              onClick={() => setActiveTab(label as typeof activeTab)}
            >
              {label}
            </Button>
          ))}
        </div>
      </TopBar>
      {activeTab === "Groups" && (
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
                <div
                  key={group.name}
                  className="flex flex-col items-start gap-2"
                >
                  <div className="relative w-36 aspect-4/3 rounded-xl bg-muted flex items-center justify-center text-sm font-medium text-muted-foreground shrink-0">
                    {group.fallback}

                    {/* Date badge */}
                    <div className="absolute -top-2 -right-2 bg-card text-card-foreground rounded-full h-10 w-10 flex flex-col items-center justify-center shadow-md">
                      <span className="text-xs font-bold leading-tight">
                        28
                      </span>
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
                        {group.name === "Weekend Hikers"
                          ? "Hosting"
                          : "Attending"}
                      </span>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground w-28 truncate">
                    {group.name}
                  </p>
                </div>
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
                {[8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21].map(
                  (d) => (
                    <div
                      key={d}
                      className={`flex h-8 w-8 items-center justify-center rounded-full bg-background/10 text-background/80 ${
                        d === 12 ? "ring-2 ring-background/80" : ""
                      }`}
                    >
                      <span className="text-xs font-medium">{d}</span>
                    </div>
                  )
                )}
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
                    <div
                      className={`h-10 w-10 ${e.color} rounded-lg shrink-0`}
                    />
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
        </>
      )}

      {activeTab === "Calendar" && (
        <section className="mt-4">
          <h2 className="sr-only">Calendar</h2>
          {/* Simple vertically scrolling month list */}
          <div className="flex flex-col gap-3">
            {["April 2026", "May 2026", "June 2026"].map((m) => (
              <div
                key={m}
                className="rounded-xl border bg-card text-card-foreground"
              >
                <div className="px-4 py-3 text-sm font-medium">{m}</div>
                <div className="grid grid-cols-7 gap-1 px-3 pb-3">
                  {[...Array(35)].map((_, i) => (
                    <div
                      key={i}
                      className="aspect-square rounded-md text-xs text-muted-foreground/80 flex items-center justify-center bg-muted/40"
                    >
                      {((i + 3) % 30) + 1}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {activeTab === "Timeline" && (
        <section className="mt-4">
          <h2 className="sr-only">Timeline</h2>
          <div className="relative">
            <div className="absolute left-6 top-0 bottom-0 w-px bg-border" />
            <ul className="space-y-4">
              {[
                {
                  when: "Today 18:00",
                  title: "Queer Hikers – route planning",
                  type: "planned",
                },
                {
                  when: "Yesterday",
                  title: "Sunday Brunch Boys – Soho meetup",
                  type: "past",
                },
                {
                  when: "Last Fri",
                  title: "Drag Trivia – Heat #2",
                  type: "past",
                },
                {
                  when: "Next Wed",
                  title: "Pool Party Crew – guest list",
                  type: "planned",
                },
              ].map((item, idx) => (
                <li key={idx} className="flex gap-3">
                  <div className="relative z-10 mt-1 ml-4 h-3 w-3 rounded-full bg-primary ring-2 ring-background" />
                  <div className="rounded-xl border bg-card text-card-foreground p-3 flex-1">
                    <div className="text-xs text-muted-foreground">
                      {item.when}
                    </div>
                    <div className="mt-1 font-medium">{item.title}</div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      {item.type === "past" ? "Completed" : "Scheduled"}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}

      {activeTab === "Events" && (
        <section className="mt-4">
          <h2 className="sr-only">Commercial events</h2>
          <div className="space-y-3">
            {[
              {
                name: "Bear Bash @ Hoist",
                date: "Fri 21:00",
                tag: "Nightlife",
              },
              { name: "House of Pride", date: "Sat 23:00", tag: "Club" },
              { name: "Kiki Pop Party", date: "Sun 20:00", tag: "Pop" },
            ].map((ev) => (
              <div
                key={ev.name}
                className="rounded-xl border bg-card text-card-foreground p-3 flex items-center gap-3"
              >
                <div className="h-10 w-10 rounded-lg bg-muted shrink-0" />
                <div className="min-w-0 flex-1">
                  <div className="font-medium truncate">{ev.name}</div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    {ev.date} • {ev.tag}
                  </div>
                </div>
                <ChevronRight className="h-5 w-5 text-muted-foreground" />
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
