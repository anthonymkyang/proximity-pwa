"use client";
import { MessageCircle, Users, Calendar as CalendarIcon } from "lucide-react";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { createClient } from "@/utils/supabase/client";

import * as React from "react";
import Sheet01 from "../shadcn-studio/sheet/sheet-01";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";

// Simple date utils (Mon-first weeks)
const MS_PER_DAY = 86_400_000;
const addDays = (d: Date, n: number) =>
  new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
const startOfDay = (d: Date) =>
  new Date(d.getFullYear(), d.getMonth(), d.getDate());

function utcStartOfDay(d: Date) {
  return new Date(
    Date.UTC(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0)
  );
}
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

function dayRangeISO(d: Date) {
  // Use UTC day bounds to avoid local timezone shifting rows out of the day.
  const startUTC = utcStartOfDay(d);
  const endExclusiveUTC = new Date(startUTC.getTime() + 24 * 60 * 60 * 1000);
  return { from: startUTC.toISOString(), to: endExclusiveUTC.toISOString() };
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

  type DayEvent = {
    id: string;
    title: string;
    time: string | null; // start_time ISO
    end: string | null; // end_time ISO
    role: "hosting" | "co-hosting" | "attending";
    cover: string | null; // cover_image_url
  };

  // Cache all events in range so the sheet can render without re-querying
  const [allEvents, setAllEvents] = React.useState<DayEvent[] | null>(null);

  // Memoized derived list of events for the selected day
  const dayEvents = React.useMemo(() => {
    if (!allEvents) return null;
    const d = selected ?? today;
    const items = allEvents.filter((ev) => {
      if (!ev.time) return false;
      const t = new Date(ev.time);
      return isSameDay(t, d);
    });
    items.sort((a, b) => {
      const ta = a.time ? Date.parse(a.time) : Number.POSITIVE_INFINITY;
      const tb = b.time ? Date.parse(b.time) : Number.POSITIVE_INFINITY;
      return ta - tb;
    });
    return items;
  }, [allEvents, selected, today]);

  // Optional developer logging for diagnosis
  React.useEffect(() => {
    if (!sheetOpen) return;
    // eslint-disable-next-line no-console
    console.log(
      "[Calendar] dayEvents for",
      selected?.toDateString(),
      dayEvents
    );
  }, [sheetOpen, selected, dayEvents]);

  // Load involvement days between rangeStart and rangeEnd
  React.useEffect(() => {
    let mounted = true;
    const supa = createClient();

    async function load() {
      try {
        const { data: auth } = await supa.auth.getUser();
        const uid = auth?.user?.id || null;
        if (!uid) {
          if (mounted) {
            setHighlightDays(new Set());
            setAllEvents([]);
          }
          return;
        }
        const fromIso = utcStartOfDay(rangeStart).toISOString();
        const toIso = utcStartOfDay(addDays(rangeEnd, 1)).toISOString(); // exclusive end

        // Fetch full details once for the range
        const hostQ = supa
          .from("groups")
          .select("id, title, start_time, end_time, cover_image_url")
          .eq("host_id", uid)
          .in("status", ["active", "in_progress"])
          .gte("start_time", fromIso)
          .lt("start_time", toIso);

        const cohostQ = supa
          .from("groups")
          .select("id, title, start_time, end_time, cover_image_url")
          .contains("cohost_ids", [uid])
          .in("status", ["active", "in_progress"])
          .gte("start_time", fromIso)
          .lt("start_time", toIso);

        const attendeeQ = supa
          .from("group_attendees")
          .select(
            "groups:groups!inner(id,title,start_time,end_time,status,cover_image_url)"
          )
          .eq("user_id", uid)
          .eq("status", "accepted")
          .in("groups.status", ["active", "in_progress"])
          .gte("groups.start_time", fromIso)
          .lt("groups.start_time", toIso);

        const [hostRes, cohostRes, attRes] = await Promise.all([
          hostQ,
          cohostQ,
          attendeeQ,
        ]);

        const byId = new Map<string, DayEvent>();

        // Priority: hosting > co-hosting > attending
        (hostRes.data || []).forEach((g: any) => {
          if (!g?.id) return;
          byId.set(g.id, {
            id: g.id,
            title: g.title || "Untitled group",
            time: g.start_time || null,
            end: g.end_time || null,
            role: "hosting",
            cover: g.cover_image_url || null,
          });
        });

        (cohostRes.data || []).forEach((g: any) => {
          if (!g?.id) return;
          if (!byId.has(g.id)) {
            byId.set(g.id, {
              id: g.id,
              title: g.title || "Untitled group",
              time: g.start_time || null,
              end: g.end_time || null,
              role: "co-hosting",
              cover: g.cover_image_url || null,
            });
          }
        });

        const attendeeGroups =
          (attRes.data || [])
            .map((r: any) => r.groups)
            .filter((g: any) => g && g.id) || [];

        attendeeGroups.forEach((g: any) => {
          if (!g?.id) return;
          if (!byId.has(g.id)) {
            byId.set(g.id, {
              id: g.id,
              title: g.title || "Untitled group",
              time: g.start_time || null,
              end: g.end_time || null,
              role: "attending",
              cover: g.cover_image_url || null,
            });
          }
        });

        const items: DayEvent[] = Array.from(byId.values());
        items.sort((a, b) => {
          const ta = a.time ? Date.parse(a.time) : Number.POSITIVE_INFINITY;
          const tb = b.time ? Date.parse(b.time) : Number.POSITIVE_INFINITY;
          return ta - tb;
        });

        // Compute highlight days from these items
        const set = new Set<string>();
        items.forEach((ev) => {
          if (ev.time) set.add(ymd(new Date(ev.time)));
        });

        if (mounted) {
          setHighlightDays(set);
          setAllEvents(items);
        }
      } catch (e) {
        if (mounted) {
          setHighlightDays(new Set());
          setAllEvents([]);
        }
        // eslint-disable-next-line no-console
        console.warn("[Calendar] failed to load involvement/events", e);
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
    const year = d.getFullYear();
    return `${day}${suffix} ${month}, ${year}`;
  }, [selected, today]);

  const selectedWeekday = React.useMemo(() => {
    const d = selected ?? today;
    return d.toLocaleDateString(undefined, { weekday: "long" });
  }, [selected, today]);

  const dayDescription = React.useMemo(() => {
    const count = dayEvents ? dayEvents.length : 0;
    if (count === 0) return "You have nothing on today.";
    if (count === 1) return "You have 1 event today.";
    return `You have ${count} events today.`;
  }, [dayEvents]);

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

  const sheetContent = (
    <div className="mt-3 space-y-2 px-">
      {!allEvents && sheetOpen ? (
        <div className="space-y-2">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="rounded-lg border bg-card px-3 py-3 flex items-start gap-3 animate-pulse"
            >
              <div className="h-8 w-8 rounded-full bg-muted/40" />
              <div className="flex-1 space-y-2">
                <div className="h-3 w-1/2 bg-muted/40 rounded" />
                <div className="h-3 w-1/3 bg-muted/40 rounded" />
              </div>
            </div>
          ))}
        </div>
      ) : dayEvents && dayEvents.length > 0 ? (
        <ul className="space-y-2 px-1">
          {dayEvents.map((ev) => {
            const start = ev.time ? new Date(ev.time) : null;
            const end = ev.end ? new Date(ev.end) : null;

            function fmt12(d: Date | null) {
              if (!d) return "";
              let h = d.getHours();
              const m = d.getMinutes();
              const ampm = h >= 12 ? "pm" : "am";
              h = h % 12;
              if (h === 0) h = 12;
              const mins = m === 0 ? "" : `:${String(m).padStart(2, "0")}`;
              return `${h}${mins}${ampm}`;
            }

            const timeText =
              start && end
                ? `${fmt12(start)} until ${fmt12(end)}`
                : fmt12(start);

            return (
              <li
                key={ev.id}
                className="rounded-2xl bg-muted/20 hover:bg-muted/30 transition border border-border px-4 py-3"
              >
                <div className="flex items-center gap-3">
                  <span
                    className="w-1 self-stretch rounded-full bg-violet-500"
                    aria-hidden="true"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-base font-semibold leading-6 truncate">
                      {ev.title}
                    </p>
                    <p className="text-sm text-muted-foreground mt-0.5">
                      {timeText}
                    </p>
                  </div>
                  {ev.cover ? (
                    <img
                      src={`/api/groups/storage?path=${encodeURIComponent(
                        ev.cover
                      )}`}
                      alt={ev.title}
                      className="h-10 w-10 rounded-lg object-cover border border-border"
                      onError={(e) => {
                        (e.currentTarget as HTMLImageElement).style.display =
                          "none";
                      }}
                    />
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
      ) : (
        <div className="py-8">
          <Empty>
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <CalendarIcon className="h-6 w-6" />
              </EmptyMedia>
              <EmptyTitle>No plans this day</EmptyTitle>
              <EmptyDescription>
                Pick another date or host a group.
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        </div>
      )}
    </div>
  );

  const sheetFooter = (
    <Button className="w-full" onClick={() => setSheetOpen(false)}>
      Done
    </Button>
  );

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

      <Sheet01
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        title={selectedTitle}
        description={dayDescription}
        content={sheetContent}
        footer={sheetFooter}
      />
    </>
  );
}
