"use client";

export default function Calendar() {
  return (
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
  );
}
