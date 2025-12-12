import * as React from "react";
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

// --- Reusable presence badge (Badge24) ---
export type Badge24Presence = "online" | "away" | "recent" | null;

export interface Badge24Props {
  src?: string;
  alt?: string;
  fallback?: string;
  className?: string;
  /** presence dot: online = green, away = amber, recent = gray, null = hidden */
  presence?: Badge24Presence;
  /** add an outer ring around the avatar */
  ring?: boolean;
}

/**
 * Normalize various presence inputs to a stable union.
 */
function normalizePresence(
  p?: Badge24Presence | string | boolean | null
): Badge24Presence {
  if (p === true) return "online";
  if (p === false || p == null) return null;
  const v = String(p).toLowerCase().trim();
  if (v === "online") return "online";
  if (v === "away") return "away";
  if (v === "recent" || v === "recently") return "recent";
  if (v === "offline" || v === "null" || v === "none") return null;
  return null;
}

/**
 * Primary reusable component.
 * Mirrors the shadcn/studio pattern exactly, but allows:
 *  - custom image `src`/`alt`/`fallback`
 *  - conditional presence colors
 */
export function Badge24({
  src,
  alt,
  fallback,
  className,
  presence = null,
  ring = true,
}: Badge24Props) {
  const norm = normalizePresence(presence);

  React.useEffect(() => {
    if (process.env.NODE_ENV !== "development") return;
    // eslint-disable-next-line no-console
    console.log("[Badge24] presence", {
      raw: presence,
      normalized: norm,
      alt: alt || null,
      fallback: fallback || null,
    });
  }, [presence, norm, alt, fallback]);

  return (
    <div className="relative w-fit">
      <Avatar
        className={cn(
          "size-10",
          ring ? "ring-2 ring-background" : "",
          className
        )}
      >
        {src ? <AvatarImage src={src} alt={alt || "Avatar"} /> : null}
        <AvatarFallback>{fallback || ""}</AvatarFallback>
      </Avatar>
      <span
        className={cn(
          "absolute -right-0.5 -bottom-0.5 z-10 h-3 w-3 rounded-full border-2 border-background transition-all duration-200",
          norm
            ? "opacity-100 scale-100"
            : "opacity-0 scale-75 bg-transparent",
          norm === "online"
            ? "bg-emerald-500"
            : norm === "away"
              ? "bg-amber-400"
              : norm === "recent"
                ? "bg-neutral-400 dark:bg-neutral-500"
                : "bg-transparent"
        )}
      >
        <span className="sr-only">
          {norm === "online"
            ? "Online"
            : norm === "away"
            ? "Away"
            : norm === "recent"
            ? "Recently active"
            : ""}
        </span>
      </span>
    </div>
  );
}

/**
 * ORIGINAL DEMO: kept for parity (static example)
 * Matches shadcn-studio preview, does not use props.
 */
export function DemoBadge24() {
  return (
    <div className="relative w-fit">
      <Avatar className="size-10">
        <AvatarImage
          src="https://cdn.shadcnstudio.com/ss-assets/avatar/avatar-5.png"
          alt="Hallie Richards"
        />
        <AvatarFallback>HR</AvatarFallback>
      </Avatar>
      <span className="border-background absolute -right-0.5 -bottom-0.5 h-3 w-3 rounded-full border-2 bg-emerald-500">
        <span className="sr-only">Online</span>
      </span>
    </div>
  );
}

export default Badge24;
