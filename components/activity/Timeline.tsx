"use client";

export default function Timeline() {
  return (
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
            { when: "Last Fri", title: "Drag Trivia – Heat #2", type: "past" },
            {
              when: "Next Wed",
              title: "Pool Party Crew – guest list",
              type: "planned",
            },
          ].map((item, idx) => (
            <li key={idx} className="flex gap-3">
              <div className="relative z-10 mt-1 ml-4 h-3 w-3 rounded-full bg-primary ring-2 ring-background" />
              <div className="rounded-xl border bg-card text-card-foreground p-3 flex-1">
                <div className="text-xs text-muted-foreground">{item.when}</div>
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
  );
}
