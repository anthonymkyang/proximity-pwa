"use client";

import Image from "next/image";

type Presence =
  | "online" // green
  | "away" // yellow
  | "recently" // grey
  | "offline"; // no dot

function presenceFromLastSeen(lastSeen?: string | Date | null): Presence {
  if (!lastSeen) return "offline";
  const now = Date.now();
  const seen =
    typeof lastSeen === "string"
      ? new Date(lastSeen).getTime()
      : lastSeen.getTime();
  const diffMin = (now - seen) / 60000;

  if (diffMin <= 2) return "online"; // <= 2 min
  if (diffMin <= 15) return "away"; // <= 15 min
  if (diffMin <= 60) return "recently"; // <= 60 min
  return "offline";
}

type SizeKey = "xs" | "sm" | "md" | "lg" | "xl";
type DotSizeKey = "nano" | "xxs" | "xs" | "sm" | "md";
type InsetKey = "flush" | "tighter" | "tight" | "tightest" | "micro";

const sizeClasses: Record<SizeKey, string> = {
  xs: "w-8 h-8", // 32px
  sm: "w-9 h-9", // 36px
  md: "w-10 h-10", // 40px
  lg: "w-12 h-12", // 48px
  xl: "w-14 h-14", // 56px
};

const dotSizeClasses: Record<DotSizeKey, string> = {
  nano: "w-0.5 h-0.5", // 2px
  xxs: "w-1 h-1", // 4px
  xs: "w-1.5 h-1.5", // 6px
  sm: "w-2 h-2", // 8px
  md: "w-2.5 h-2.5", // 10px
};

const insetClasses: Record<InsetKey, string> = {
  flush: "top-0 left-0",
  tighter: "-top-0.5 -left-0.5",
  tight: "-top-0.5 -left-0.5",
  tightest: "-top-1 -left-1",
  micro: "-top-px -left-px",
};

export default function AvatarWithPresence({
  src,
  alt,
  size = "md",
  className = "",
  status, // optional explicit status
  lastSeen, // or pass a timestamp to compute it
  dotSize = "nano",
  dotInset = "micro",
}: {
  src?: string | null;
  alt?: string;
  /** Avatar size token using Tailwind classes. */
  size?: SizeKey;
  className?: string;
  status?: Presence;
  lastSeen?: string | Date | null;
  /** Presence dot size token using Tailwind classes. */
  dotSize?: DotSizeKey;
  /** How far the dot sits outside the avatar edge. */
  dotInset?: InsetKey;
}) {
  const resolved: Presence = status ? status : presenceFromLastSeen(lastSeen);

  const dotColor =
    resolved === "online"
      ? "bg-emerald-500"
      : resolved === "away"
      ? "bg-amber-400"
      : resolved === "recently"
      ? "bg-neutral-400 dark:bg-neutral-500"
      : ""; // offline => no dot

  return (
    <div
      className={`relative inline-block rounded-full overflow-visible contain-[layout_paint] ${sizeClasses[size]} ${className}`}
    >
      {/* Avatar */}
      {src ? (
        <Image
          src={src}
          alt={alt || "Avatar"}
          fill
          sizes="(max-width: 640px) 40px, 40px"
          className="object-cover rounded-full border border-muted"
          priority={false}
        />
      ) : (
        <div className="w-full h-full rounded-full bg-muted border border-muted" />
      )}

      {/* Presence dot (top-left) */}
      {dotColor ? (
        <span
          className={`absolute ${insetClasses[dotInset]} ${dotSizeClasses[dotSize]} z-10 rounded-full ring-1 ring-background ${dotColor} pointer-events-none`}
          aria-label={`Status: ${resolved}`}
          title={resolved}
        />
      ) : null}
    </div>
  );
}
