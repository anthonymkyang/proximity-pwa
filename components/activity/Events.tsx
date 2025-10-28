"use client";

import * as React from "react";
import { ChevronRight } from "lucide-react";

export default function Events() {
  return (
    <section className="mt-4">
      <h2 className="sr-only">Commercial events</h2>
      <div className="space-y-3">
        {[
          { name: "Bear Bash @ Hoist", date: "Fri 21:00", tag: "Nightlife" },
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
  );
}
