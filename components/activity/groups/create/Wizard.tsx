"use client";

import { useEffect, useMemo, useState } from "react";
import Stepper from "./Stepper";
import DetailsStep from "./steps/DetailsStep";
import ScheduleStep from "./steps/ScheduleStep";
import LocationStep from "./steps/LocationStep";
import HostsStep from "./steps/HostsStep";
import RulesStep from "./steps/RulesStep";
import VisibilityStep from "./steps/VisibilityStep";

const steps = [
  { key: "details", label: "Details" },
  { key: "schedule", label: "Schedule" },
  { key: "location", label: "Location" },
  { key: "hosts", label: "Hosts" },
  { key: "rules", label: "Rules" },
  { key: "review", label: "Review" },
];

export default function Wizard({ groupId }: { groupId: string }) {
  // Lock the incoming groupId for the lifetime of the wizard to avoid accidental draft re-creation
  const [gid] = useState<string>(groupId);

  // Persist gid in URL and localStorage so refreshes and child flows keep pointing to the same row
  useEffect(() => {
    try {
      if (typeof window === "undefined") return;
      const url = new URL(window.location.href);
      if (url.searchParams.get("gid") !== gid) {
        url.searchParams.set("gid", gid);
        window.history.replaceState(
          null,
          "",
          `${url.pathname}?${url.searchParams.toString()}`
        );
      }
      localStorage.setItem("groupDraftId", gid);
    } catch {}
  }, [gid]);

  // Step index, persisted to the URL so deep links and refreshes keep position
  const [idx, setIdx] = useState(() => {
    if (typeof window === "undefined") return 0;
    const url = new URL(window.location.href);
    const q = url.searchParams.get("step");
    const n = q ? parseInt(q, 10) : 0;
    return Number.isFinite(n) ? Math.max(0, Math.min(n, steps.length - 1)) : 0;
  });

  useEffect(() => {
    try {
      if (typeof window === "undefined") return;
      const url = new URL(window.location.href);
      url.searchParams.set("step", String(idx));
      window.history.replaceState(
        null,
        "",
        `${url.pathname}?${url.searchParams.toString()}`
      );
    } catch {}
  }, [idx]);

  const [isClient, setIsClient] = useState(false);
  useEffect(() => {
    setIsClient(true);
  }, []);

  const next = () => setIdx((i) => Math.min(i + 1, steps.length - 1));
  const back = () => setIdx((i) => Math.max(i - 1, 0));

  // Keep all steps mounted to avoid form re-inits when e.g. image crop closes
  const stepViews = useMemo(
    () => [
      <DetailsStep key="details" groupId={gid} onNext={next} />,
      <ScheduleStep key="schedule" groupId={gid} onNext={next} onBack={back} />,
      <LocationStep key="location" groupId={gid} onNext={next} onBack={back} />,
      <HostsStep key="hosts" groupId={gid} onNext={next} onBack={back} />,
      <RulesStep key="rules" groupId={gid} onNext={next} onBack={back} />,
      <VisibilityStep key="review" groupId={gid} onBack={back} onNext={next} />,
    ],
    [gid]
  );

  return (
    <div className="mx-auto max-w-3xl">
      {isClient ? (
        <>
          <div className="-mx-4">
            <Stepper steps={steps} activeIndex={idx} />
          </div>
          <div className="mt-8">
            {stepViews.map((view, i) => (
              <div
                key={steps[i].key}
                className={i === idx ? "block" : "hidden"}
              >
                {view}
              </div>
            ))}
          </div>
        </>
      ) : (
        <div className="mt-8" />
      )}
    </div>
  );
}
