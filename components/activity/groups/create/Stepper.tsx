"use client";

type Step = { key: string; label: string };

export default function Stepper({
  steps,
  activeIndex,
}: {
  steps: Step[];
  activeIndex: number;
}) {
  const progress = (activeIndex / (steps.length - 1)) * 100;

  return (
    <div className="w-full">
      <div className="w-full h-1.5 bg-muted overflow-hidden">
        <div
          className="h-full bg-primary transition-all duration-500 ease-in-out"
          style={{ width: `${progress}%` }}
        />
      </div>
      <div className="text-left text-sm text-muted-foreground uppercase mt-2 px-4">
        {activeIndex + 1} of {steps.length}
      </div>
    </div>
  );
}
