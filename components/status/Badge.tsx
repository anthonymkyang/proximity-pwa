"use client";

import React from "react";
import { cn } from "@/lib/utils";

type Presence = "online" | "away" | "offline";
type SizeVariant = "lg" | "default" | "sm" | "xs";

type StatusBadgeProps = {
  status?: Presence;
  size?: SizeVariant;
  className?: string;
  withRing?: boolean;
};

const sizeClasses: Record<SizeVariant, string> = {
  lg: "h-3.5 w-3.5",
  default: "h-3 w-3",
  sm: "h-2.5 w-2.5",
  xs: "h-2 w-2",
};

const statusClasses: Record<Presence, string> = {
  online: "bg-emerald-400",
  away: "bg-amber-300",
  offline: "bg-neutral-400",
};

export function StatusBadge({
  status = "offline",
  size = "default",
  className,
  withRing = true,
}: StatusBadgeProps) {
  const sizeClass = sizeClasses[size] ?? sizeClasses.default;
  const colorClass = statusClasses[status] ?? statusClasses.offline;

  return (
    <span
      role="status"
      aria-label={status}
      title={status}
      className={cn(
        "inline-flex shrink-0 rounded-full",
        sizeClass,
        colorClass,
        withRing ? "ring-2 ring-background" : "",
        className
      )}
    />
  );
}

export default StatusBadge;
