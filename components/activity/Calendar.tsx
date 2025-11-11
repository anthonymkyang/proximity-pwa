"use client";
import { MessageCircle, Users, Calendar as CalendarIcon } from "lucide-react";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { createClient } from "@/utils/supabase/client";

import * as React from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

// Simple date utils (Mon-first weeks)
const MS_PER_DAY = 86_400_000;
const addDays = (d: Date, n: number) =>
  new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
const startOfDay = (d: Date) =>
  new Date(d.getFullYear(), d.getMonth(), d.getDate());
const isSameDay = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() &&
  a.getMonth() === b.getMonth() &&
  a.getDate() === b.getDate();
const isSameMonth = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth();

// Monday (1) as start of week
function startOfWeek(date: Date) {
  const d = new Date(date);
  const day = (d.getDay() + 6) % 7; // 0..6 where 0 = Monday
  return addDays(startOfDay(d), -day);
}
function endOfWeek(date: Date) {
  return addDays(startOfWeek(date), 6);
}
function startOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}
function endOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0);
}

// Normalize a date to YYYY-MM-DD for set membership
function ymd(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export default function Calendar() {
  const today = startOfDay(new Date());
  const rangeStart = today; // start from today
  const rangeEnd = addDays(
    new Date(today.getFullYear(), today.getMonth(), today.getDate()),
    92
  ); // ~3 months ahead

  const [selected, setSelected] = React.useState<Date | null>(today);
  const [sheetOpen, setSheetOpen] = React.useState(false);

  // Days that have a group the user is involved in
  const [highlightDays, setHighlightDays] = React.useState<Set<string>>(
    new Set()
  );

  // Load involvement days between rangeStart and rangeEnd
  React.useEffect(() => {
    let mounted = true;
    const supa = createClient();

    async function load() {
      try {
        const { data: auth } = await supa.auth.getUser();
        const uid = auth?.user?.id || null;
        if (!uid) {
          if (mounted) setHighlightDays(new Set());
          return;
        }
        const fromIso = new Date(rangeStart).toISOString();
        const toIso = new Date(rangeEnd).toISOString();

        // Host
        const hostQ = supa
          .from("groups")
          .select("start_time")
          .eq("host_id", uid)
          .in("status", ["active", "in_progress"]) // live groups
          .gte("start_time", fromIso)
          .lte("start_time", toIso);

        // Co-host (array contains user id)
        const cohostQ = supa
          .from("groups")
          .select("start_time")
          .contains("cohost_ids", [uid])
          .in("status", ["active", "in_progress"]) // live groups
          .gte("start_time", fromIso)
          .lte("start_time", toIso);

        // Attendee (accepted), join groups to filter by status + time
        const attendeeQ = supa
          .from("group_attendees")
          .select("groups:groups!inner(start_time,status)")
          .eq("user_id", uid)
          .eq("status", "accepted")
          .in("groups.status", ["active", "in_progress"]) // live groups
          .gte("groups.start_time", fromIso)
          .lte("groups.start_time", toIso);

        const [hostRes, cohostRes, attRes] = await Promise.all([
          hostQ,
          cohostQ,
          attendeeQ,
        ]);

        const set = new Set<string>();
        (hostRes.data || []).forEach((r: any) => {
          if (r?.start_time) set.add(ymd(new Date(r.start_time)));
        });
        (cohostRes.data || []).forEach((r: any) => {
          if (r?.start_time) set.add(ymd(new Date(r.start_time)));
        });
        (attRes.data || []).forEach((r: any) => {
          const t = r?.groups?.start_time;
          if (t) set.add(ymd(new Date(t)));
        });

        if (mounted) setHighlightDays(set);
      } catch (e) {
        if (mounted) setHighlightDays(new Set());
        // eslint-disable-next-line no-console
        console.warn("[Calendar] failed to load highlight days", e);
      }
    }

    load();
    return () => {
      mounted = false;
    };
  }, [rangeStart, rangeEnd]);

  const selectedTitle = React.useMemo(() => {
    const d = selected ?? today;
    const day = d.getDate();
    const suffix =
      day % 10 === 1 && day !== 11
        ? "st"
        : day % 10 === 2 && day !== 12
        ? "nd"
        : day % 10 === 3 && day !== 13
        ? "rd"
        : "th";
    const month = d.toLocaleDateString(undefined, { month: "long" });
    return `${day}${suffix} ${month}`;
  }, [selected, today]);

  const selectedWeekday = React.useMemo(() => {
    const d = selected ?? today;
    return d.toLocaleDateString(undefined, { weekday: "long" });
  }, [selected, today]);

  // Build a list of months intersecting the range
  const months: { key: string; monthDate: Date }[] = React.useMemo(() => {
    const list: { key: string; monthDate: Date }[] = [];
    const firstMonth = new Date(
      rangeStart.getFullYear(),
      rangeStart.getMonth(),
      1
    );
    const lastMonth = new Date(rangeEnd.getFullYear(), rangeEnd.getMonth(), 1);
    for (
      let m = new Date(firstMonth.getFullYear(), firstMonth.getMonth(), 1);
      m <= lastMonth;
      m = new Date(m.getFullYear(), m.getMonth() + 1, 1)
    ) {
      list.push({ key: `${m.getFullYear()}-${m.getMonth()}`, monthDate: m });
    }
    return list;
  }, [rangeStart, rangeEnd]);

  return (
    <>
      <div
        className={`transition-transform duration-300 ${
          sheetOpen ? "-translate-x-[90vw]" : ""
        }`}
      >
        <section className="mt-4">
          <h2 className="sr-only">Calendar</h2>
          <div className="flex flex-col gap-3">
            {months.map(({ key, monthDate }) => {
              const monthStart = startOfMonth(monthDate);
              const monthEnd = endOfMonth(monthDate);
              const gridStart = isSameMonth(monthDate, today)
                ? startOfWeek(today)
                : startOfWeek(monthStart);
              const gridEnd = endOfWeek(monthEnd);

              const days: Date[] = [];
              for (
                let d = new Date(gridStart);
                d <= gridEnd;
                d = addDays(d, 1)
              ) {
                days.push(new Date(d));
              }

              const monthLabel = monthDate.toLocaleDateString(undefined, {
                month: "long",
              });

              return (
                <div key={key} className="">
                  {/* Month heading (no year) */}
                  <div className="px-2 py-2 text-lg font-bold tracking-tight">
                    {monthLabel}
                  </div>

                  {/* Weekday headers */}
                  <div className="grid grid-cols-7 gap-1 px-2 pb-2 text-[10px] text-muted-foreground">
                    {WEEKDAYS.map((wd) => (
                      <div
                        key={wd}
                        className="flex items-center justify-center py-1"
                      >
                        {wd}
                      </div>
                    ))}
                  </div>

                  {/* Days grid */}
                  <div className="grid grid-cols-7 gap-1 px-2 pb-3">
                    {days.map((date) => {
                      const outsideMonth = !isSameMonth(date, monthDate);
                      const beforeRange = date < rangeStart;
                      const afterRange = date > rangeEnd;
                      const disabled = beforeRange || afterRange;
                      const isToday = isSameDay(date, today);
                      const isSelected = selected && isSameDay(date, selected);
                      const highlight =
                        !disabled &&
                        !outsideMonth &&
                        highlightDays.has(ymd(date));

                      return (
                        <button
                          key={date.toISOString()}
                          type="button"
                          disabled={disabled}
                          aria-label={date.toDateString()}
                          onClick={() => {
                            if (!disabled) {
                              setSelected(date);
                              setSheetOpen(true);
                            }
                          }}
                          className={[
                            "aspect-square rounded-full text-xs flex items-center justify-center transition",
                            outsideMonth
                              ? "invisible pointer-events-none"
                              : "text-foreground/90",
                            disabled
                              ? "opacity-40 cursor-not-allowed"
                              : "hover:bg-muted/60",
                            highlight && !isSelected && !isToday
                              ? "bg-primary/20"
                              : "",
                            isSelected
                              ? "ring-2 ring-primary bg-primary/10"
                              : "",
                            isToday && !isSelected
                              ? "border border-primary/40"
                              : "",
                            beforeRange ? "invisible pointer-events-none" : "",
                          ].join(" ")}
                        >
                          {date.getDate()}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      </div>

      {/* Day details sheet */}
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent
          side="right"
          className="h-full w-[90%] overflow-y-auto border-l bg-card text-card-foreground shadow-xl px-4 pb-6"
        >
          <SheetHeader>
            <SheetTitle>{selectedTitle}</SheetTitle>
          </SheetHeader>

          <ul className="space-y-0">
            <h3 className="text-xs font-semibold uppercase text-muted-foreground tracking-wide mb-1 px-1">
              {selectedWeekday}
            </h3>
            {[
              {
                icon: MessageCircle,
                title: "Chat: Coffee Crew plans",
                subtitle: "Sort tomorrow’s meetup?",
                time: "10:00",
              },
              {
                icon: CalendarIcon,
                title: "Event: Queer Hikers route scout",
                subtitle: "Meet at Parliament Hill",
                time: "14:00",
              },
              {
                icon: Users,
                title: "Group: After Hours",
                subtitle: "Poll closes tonight",
                time: "20:30",
              },
            ].map((n, i) => (
              <li key={`sched-${i}`} className={`py-2 px-4 -mx-4 rounded-lg`}>
                <div className="flex items-start gap-3">
                  <div className="relative mt-0.5 h-10 w-10 rounded-full bg-muted flex items-center justify-center">
                    <n.icon className="h-5 w-5 text-muted-foreground" />
                    <div className="absolute -bottom-1 -right-1 h-5 w-5 ring-2 ring-card">
                      <Avatar className="h-5 w-5">
                        <AvatarImage src="" alt="avatar" />
                        <AvatarFallback className="text-[8px] uppercase">
                          {String.fromCharCode(65 + ((i * 3) % 26))}
                          {String.fromCharCode(65 + ((i * 7) % 26))}
                        </AvatarFallback>
                      </Avatar>
                    </div>
                  </div>
                  <div className="min-w-0 flex-1 pt-1">
                    <p className="text-sm font-medium truncate">{n.title}</p>
                    <p className="text-xs text-muted-foreground truncate mt-0.5">
                      {n.subtitle}
                    </p>
                  </div>
                  <div className="text-[10px] text-muted-foreground shrink-0">
                    {n.time}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </SheetContent>
      </Sheet>
    </>
  );
}
