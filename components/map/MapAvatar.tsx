"use client";

import React, { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

type MapAvatarProps = {
  size?: number;
  className?: string;
  avatarUrl?: string;
  alt?: string;
  presence?: "online" | "away" | "offline";
  ringGap?: boolean;
  hideShadow?: boolean;
  messages?: boolean;
  newMessages?: boolean;
  onClick?: () => void;
  onLoaded?: () => void;
};

export default function MapAvatar({
  size = 40,
  className,
  avatarUrl,
  alt = "User",
  presence,
  ringGap = false,
  hideShadow = false,
  messages = false,
  newMessages = false,
  onClick,
  onLoaded,
}: MapAvatarProps) {
  // Drawer (ringGap=true) uses same inner size but smaller ring to leave a clear spacer.
  const innerSize = size;
  const dimension = `${innerSize}px`;
  const ringSize = ringGap ? size + 8 : size + 8;
  const gapSize = ringGap ? 4 : 0;
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    if (loaded && onLoaded) {
      onLoaded();
    }
  }, [loaded, onLoaded]);

  const ringGradient =
    presence === "online"
      ? "conic-gradient(from 140deg, #34d399 0deg, #16a34a 80deg, #0ea5e9 140deg, #34d399 220deg, #16a34a 300deg, #34d399 360deg)"
      : presence === "away"
        ? "conic-gradient(from 120deg, #ffd166 0deg, #ff7a18 90deg, #ff3d3d 180deg, #ff7a18 270deg, #ffd166 360deg)"
        : "conic-gradient(from 110deg, #e5e7eb 0deg, #9ca3af 120deg, #4b5563 240deg, #9ca3af 320deg, #e5e7eb 360deg)";

  return (
    <div
      className={cn(
        "relative inline-flex items-center justify-center transition-[opacity,transform] ease-out",
        onClick ? "cursor-pointer" : "",
        loaded ? "opacity-100 scale-100" : "opacity-0 scale-75",
        className
      )}
      onClick={onClick}
      style={{
        width: `${ringSize}px`,
        height: `${ringSize}px`,
        transitionDuration: "700ms",
        transitionDelay: loaded ? "1s" : "0s",
        boxShadow: hideShadow ? "none" : undefined,
        filter: hideShadow ? "none" : undefined,
      }}
    >
      {ringGradient ? (
        <span
          className="pointer-events-none absolute inset-0 rounded-full map-avatar-spin"
          style={{
            background: ringGradient,
            maskImage:
              ringGap
                ? "radial-gradient(closest-side, transparent 88%, black 96%, black 100%)"
                : "radial-gradient(closest-side, transparent 88%, black 96%, black 100%)",
            WebkitMaskImage:
              ringGap
                ? "radial-gradient(closest-side, transparent 88%, black 96%, black 100%)"
                : "radial-gradient(closest-side, transparent 88%, black 96%, black 100%)",
            opacity: presence === "online" ? 0.9 : 1,
            zIndex: 0,
          }}
          aria-hidden
        />
      ) : null}
      {ringGap ? (
        <span
          className="pointer-events-none absolute rounded-full"
          style={{
            inset: `${gapSize}px`,
            background: "var(--background, #000)",
            zIndex: 1,
          }}
          aria-hidden
        />
      ) : null}
      <div
        aria-hidden
        className={cn(
          "relative z-10 overflow-hidden rounded-full",
          hideShadow ? "bg-transparent" : "bg-white/6",
          hideShadow ? "" : "shadow-[0_10px_24px_rgba(0,0,0,0.32)]"
        )}
        style={{ width: dimension, height: dimension }}
      >
        {avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={avatarUrl}
          alt={alt}
          className="h-full w-full object-cover"
          loading="lazy"
          draggable={false}
          onLoad={() => setLoaded(true)}
          onError={() => setLoaded(true)}
        />
      ) : null}
      </div>
      {hideShadow ? null : (
        <span
          className="pointer-events-none absolute rounded-full bg-white/28 blur-md"
          aria-hidden
          style={{
            width: `${size * 0.8}px`,
            height: "6px",
            left: "50%",
            transform: "translateX(-50%)",
            bottom: "-6px",
          }}
        />
      )}
      {newMessages ? (
        <span
          className="absolute inline-flex h-2 w-2 items-center justify-center rounded-full bg-red-500 shadow-[0_2px_6px_rgba(0,0,0,0.45)] ring-2 ring-background"
          style={{ top: "4px", left: "4px" }}
        />
      ) : null}
    </div>
  );
}
