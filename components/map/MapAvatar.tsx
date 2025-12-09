"use client";

import React, { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

type MapAvatarProps = {
  size?: number;
  className?: string;
  avatarUrl?: string;
  alt?: string;
  presence?: "online" | "away" | "offline";
  messages?: boolean;
  newMessages?: boolean;
  onClick?: () => void;
};

export default function MapAvatar({
  size = 40,
  className,
  avatarUrl,
  alt = "User",
  presence,
  messages = false,
  newMessages = false,
  onClick,
}: MapAvatarProps) {
  const dimension = `${size}px`;
  const ringSize = size + 8;
  const [loaded, setLoaded] = useState(false);

  const ringGradient =
    presence === "online"
      ? "conic-gradient(from 140deg, #34d399 0deg, #16a34a 80deg, #0ea5e9 140deg, #34d399 220deg, #16a34a 300deg, #34d399 360deg)"
      : presence === "away"
        ? "conic-gradient(from 120deg, #ffd166 0deg, #ff7a18 90deg, #ff3d3d 180deg, #ff7a18 270deg, #ffd166 360deg)"
        : presence === "offline"
          ? "conic-gradient(from 110deg, #e5e7eb 0deg, #9ca3af 120deg, #4b5563 240deg, #9ca3af 320deg, #e5e7eb 360deg)"
          : null;

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
      }}
    >
      {ringGradient ? (
        <span
          className="pointer-events-none absolute inset-0 rounded-full map-avatar-spin"
          style={{
            background: ringGradient,
            maskImage:
              "radial-gradient(closest-side, transparent 88%, black 96%, black 100%)",
            WebkitMaskImage:
              "radial-gradient(closest-side, transparent 88%, black 96%, black 100%)",
            opacity: presence === "online" ? 0.9 : 1,
          }}
          aria-hidden
        />
      ) : null}
      <div
        aria-hidden
        className="relative overflow-hidden rounded-full border border-white/60 bg-white/6 shadow-[0_10px_24px_rgba(0,0,0,0.32)]"
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
        <span
          className="pointer-events-none absolute inset-0 rounded-full"
          style={{
            background:
              "conic-gradient(from 110deg, rgba(255,165,88,0.95), rgba(128,196,255,0.9), rgba(120,255,214,0.9), rgba(120,120,255,0.8), rgba(255,156,120,0.95), rgba(255,220,130,0.85), rgba(255,165,88,0.95))",
            maskImage:
              "radial-gradient(closest-side, transparent 78%, black 92%, black 100%)",
            WebkitMaskImage:
              "radial-gradient(closest-side, transparent 78%, black 92%, black 100%)",
            opacity: 0.8,
            mixBlendMode: "screen",
          }}
          aria-hidden
        />
        <span
          className="pointer-events-none absolute inset-0 rounded-full"
          style={{
            background:
              "radial-gradient(closest-side, rgba(0,0,0,0) 50%, rgba(0,0,0,0.22) 90%, rgba(0,0,0,0.32) 100%)",
          }}
          aria-hidden
        />
      </div>
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
      {newMessages ? (
        <span
          className="absolute inline-flex h-2 w-2 items-center justify-center rounded-full bg-red-500 shadow-[0_2px_6px_rgba(0,0,0,0.45)] ring-2 ring-background"
          style={{ top: "4px", left: "4px" }}
        />
      ) : null}
    </div>
  );
}
