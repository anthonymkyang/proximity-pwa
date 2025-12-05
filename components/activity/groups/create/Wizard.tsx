"use client";

import { useEffect, useMemo, useRef, useState } from "react";
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

type WizardProps = {
  groupId: string;
  persistToUrl?: boolean;
  onStepChange?: (index: number) => void;
  externalBackSignal?: number;
};

export default function Wizard({
  groupId,
  persistToUrl = true,
  onStepChange,
  externalBackSignal,
}: WizardProps) {
  // Lock the incoming groupId for the lifetime of the wizard
  const [id] = useState<string>(groupId);

  // Step index, persisted to URL so refreshes keep position
  const [idx, setIdx] = useState(() => {
    if (typeof window === "undefined" || !persistToUrl) return 0;
    try {
      const url = new URL(window.location.href);
      const q = url.searchParams.get("step");
      const n = q ? parseInt(q, 10) : 0;
      return Number.isFinite(n)
        ? Math.max(0, Math.min(n, steps.length - 1))
        : 0;
    } catch {
      return 0;
    }
  });

  // Keep id + step in the URL, so deep links and refresh work.
  useEffect(() => {
    if (typeof window === "undefined" || !persistToUrl) return;
    try {
      const url = new URL(window.location.href);

      // Ensure id param is present and correct
      if (url.searchParams.get("id") !== id) {
        url.searchParams.set("id", id);
      }

      // Persist step
      url.searchParams.set("step", String(idx));

      window.history.replaceState(
        null,
        "",
        `${url.pathname}?${url.searchParams.toString()}`
      );

      // Optional: remember last draft id locally
      try {
        localStorage.setItem("groupDraftId", id);
      } catch {}
    } catch {
      // ignore URL errors
    }
  }, [id, idx, persistToUrl]);

  const [isClient, setIsClient] = useState(false);
  useEffect(() => {
    setIsClient(true);
  }, []);

  const next = () => setIdx((i) => Math.min(i + 1, steps.length - 1));
  const back = () => setIdx((i) => Math.max(i - 1, 0));

  useEffect(() => {
    onStepChange?.(idx);
  }, [idx, onStepChange]);

  const prevBackSignal = useRef(externalBackSignal);
  useEffect(() => {
    if (externalBackSignal === undefined) return;
    if (prevBackSignal.current === externalBackSignal) return;
    prevBackSignal.current = externalBackSignal;
    setIdx((i) => Math.max(i - 1, 0));
  }, [externalBackSignal]);

  // Keep all steps mounted to avoid form re-inits
  const stepViews = useMemo(
    () => [
      <DetailsStep key="details" groupId={id} onNext={next} />,
      <ScheduleStep key="schedule" groupId={id} onNext={next} onBack={back} />,
      <LocationStep key="location" groupId={id} onNext={next} onBack={back} />,
      <HostsStep key="hosts" groupId={id} onNext={next} onBack={back} />,
      <RulesStep key="rules" groupId={id} onNext={next} onBack={back} />,
      <VisibilityStep key="review" groupId={id} onBack={back} onNext={next} />,
    ],
    [id]
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
