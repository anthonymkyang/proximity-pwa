"use client";

import { CalendarClock, CheckCircle2, Users } from "lucide-react";

export default function Timeline() {
  return (
    <section className="mt-4">
      <h2 className="sr-only">Timeline</h2>
      <div className="relative">
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
            { when: "Last Fri", title: "Drag Trivia – Heat #2", type: "past" },
            {
              when: "Next Wed",
              title: "Pool Party Crew – guest list",
              type: "planned",
            },
          ].map((item, idx, arr) => {
            const isPast = item.type === "past";
            const Icon = isPast ? Users : CalendarClock;
            return (
              <li key={idx} className="relative flex gap-3">
                {idx < arr.length - 1 && (
                  <div
                    className="absolute left-[22px] top-5 w-px bg-border"
                    style={{ bottom: "-36px" }}
                  />
                )}
                <div className="relative ml-2.5 mt-3.5 z-10">
                  <div className="flex h-6 w-6 items-center justify-center rounded-full ring-2 ring-background bg-card shadow-sm">
                    <Icon
                      className={`h-3.5 w-3.5 ${
                        isPast ? "text-blue-500" : "text-primary"
                      }`}
                    />
                  </div>
                </div>
                <div className="rounded-xl bg-card text-card-foreground p-3 flex-1">
                  <div className="text-xs text-muted-foreground">
                    {item.when}
                  </div>
                  <div className="mt-1 font-medium">{item.title}</div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    {item.type === "past" ? "You attended" : "Scheduled"}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
