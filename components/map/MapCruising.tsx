"use client";

import React from "react";
import { Eye } from "lucide-react";
import { cn } from "@/lib/utils";

type MapCruisingProps = {
  size?: number;
  className?: string;
  onClick?: () => void;
};

export default function MapCruising({
  size = 28,
  className,
  onClick,
}: MapCruisingProps) {
  const dimension = `${size}px`;
  const badgeSize = Math.max(14, Math.round(size * 0.5));

  return (
    <div
      className={cn(
        "relative inline-flex items-center justify-center transition-[opacity,transform] ease-out opacity-100 scale-100",
        onClick ? "cursor-pointer" : "",
        className
      )}
      onClick={onClick}
      style={{
        width: dimension,
        height: dimension,
        transitionDuration: "600ms",
      }}
    >
      <div
        className="relative flex items-center justify-center rounded-full bg-gradient-to-br from-orange-500 via-orange-600 to-orange-700 text-white shadow-[0_8px_18px_rgba(0,0,0,0.32)]"
        style={{ width: dimension, height: dimension }}
      >
        <Eye className="h-4 w-4" />
      </div>
      <div
        className="absolute flex items-center justify-center rounded-full bg-gradient-to-br from-orange-500 via-orange-600 to-orange-700 text-white shadow-[0_4px_10px_rgba(0,0,0,0.25)]"
        style={{
          width: `${badgeSize}px`,
          height: `${badgeSize}px`,
          right: `-${Math.round(badgeSize * 0.3)}px`,
          top: `-${Math.round(badgeSize * 0.1)}px`,
          fontSize: badgeSize <= 16 ? "10px" : "11px",
          fontWeight: 700,
        }}
      >
        2
      </div>
    </div>
  );
}
