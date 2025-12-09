"use client";

import React, { useState } from "react";
import { cn } from "@/lib/utils";

type MapPlaceProps = {
  size?: number;
  className?: string;
  imageUrl?: string;
  alt?: string;
  onClick?: () => void;
  status?: "open" | "closing" | "closed" | null;
};

export default function MapPlace({
  size = 32,
  className,
  imageUrl = "/logos/prowler.svg",
  alt = "Place",
  onClick,
  status = null,
}: MapPlaceProps) {
  const [loaded, setLoaded] = useState(false);
  const ringSize = size + 8;
  const dimension = `${size}px`;

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
        transitionDuration: "600ms",
        transitionDelay: loaded ? "400ms" : "0s",
      }}
    >
      <span
        className="pointer-events-none absolute inset-0 rounded-full map-avatar-spin"
        style={{
          background:
            "conic-gradient(from 120deg, #8ad4ff 0deg, #4ea7ff 90deg, #2c6bff 180deg, #3ec6ff 270deg, #8ad4ff 360deg)",
          maskImage:
            "radial-gradient(closest-side, transparent 75%, black 90%, black 100%)",
          WebkitMaskImage:
            "radial-gradient(closest-side, transparent 75%, black 90%, black 100%)",
          opacity: 0.95,
        }}
        aria-hidden
      />
      <div
        aria-hidden
        className="relative overflow-hidden rounded-full border border-white/60 bg-white/8 shadow-[0_8px_18px_rgba(0,0,0,0.32)]"
        style={{ width: dimension, height: dimension }}
      >
        {imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={imageUrl}
            alt={alt}
            className="h-full w-full object-cover"
            loading="lazy"
            draggable={false}
            onLoad={() => setLoaded(true)}
            onError={() => setLoaded(true)}
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-sky-500/80 via-blue-500/80 to-indigo-600/80 text-[10px] font-semibold text-white">
            {alt?.slice(0, 2) ?? ""}
          </div>
        )}
        <span
          className="pointer-events-none absolute inset-0 rounded-full"
          style={{
            background:
              "radial-gradient(closest-side, rgba(0,0,0,0) 55%, rgba(0,0,0,0.18) 88%, rgba(0,0,0,0.26) 100%)",
          }}
          aria-hidden
        />
      </div>
      {status && status !== "closed" ? (
        <span
          className={cn(
            "pointer-events-none absolute inline-flex h-2 w-2 items-center justify-center rounded-full shadow-[0_2px_6px_rgba(0,0,0,0.45)] ring-2 ring-background",
            status === "closing" ? "bg-amber-400" : "bg-emerald-500"
          )}
          style={{ left: "4px", bottom: "4px" }}
          aria-hidden
        />
      ) : null}
    </div>
  );
}
