"use client";

import React from "react";
import { Users } from "lucide-react";
import { cn } from "@/lib/utils";

type MapGroupProps = {
  size?: number;
  className?: string;
  onClick?: () => void;
};

export default function MapGroup({
  size = 32,
  className,
  onClick,
}: MapGroupProps) {
  const ringSize = size + 8;
  const dimension = `${size}px`;

  return (
    <div
      className={cn(
        "relative inline-flex items-center justify-center transition-[opacity,transform] ease-out opacity-100 scale-100",
        onClick ? "cursor-pointer" : "",
        className
      )}
      onClick={onClick}
      style={{
        width: `${ringSize}px`,
        height: `${ringSize}px`,
        transitionDuration: "600ms",
      }}
    >
      <span
        className="pointer-events-none absolute inset-0 rounded-full map-avatar-spin"
        style={{
          background:
            "conic-gradient(from 130deg, #ff2a2a 0deg, #d70015 90deg, #b0000f 180deg, #e60026 270deg, #ff2a2a 360deg)",
          maskImage:
            "radial-gradient(closest-side, transparent 75%, black 90%, black 100%)",
          WebkitMaskImage:
            "radial-gradient(closest-side, transparent 75%, black 90%, black 100%)",
          opacity: 1,
        }}
        aria-hidden
      />
      <div
        className="relative flex items-center justify-center rounded-full bg-red-600 text-white shadow-[0_8px_18px_rgba(0,0,0,0.32)]"
        style={{ width: dimension, height: dimension }}
      >
        <Users className="h-4 w-4" />
      </div>
      <span className="pointer-events-none absolute -bottom-1 left-1/2 -translate-x-1/2 rounded-full bg-red-600 px-1.5 py-0.5 text-[9px] font-semibold leading-none text-white shadow-[0_6px_16px_rgba(0,0,0,0.35)]">
        Today
      </span>
      <span className="pointer-events-none absolute right-0 top-1/2 -translate-y-1/2 translate-x-1/2 rounded-full bg-red-600 px-1.5 py-0.5 text-[9px] font-semibold leading-none text-white shadow-[0_6px_16px_rgba(0,0,0,0.35)]">
        24
      </span>
    </div>
  );
}
