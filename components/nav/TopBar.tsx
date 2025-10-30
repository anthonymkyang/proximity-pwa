"use client";

import { ReactNode } from "react";

export type TopBarProps = {
  leftContent?: ReactNode;
  rightContent?: ReactNode;
  children?: ReactNode; // Optional content below the top row (e.g., title, search, chips)
  className?: string;
};

export default function TopBar({
  leftContent,
  rightContent,
  children,
  className,
}: TopBarProps) {
  return (
    <div className={`bg-background ${className ?? ""}`}>
      <div className="flex items-center justify-between py-3">
        <div className="shrink-0 flex items-center gap-2">{leftContent}</div>
        <div className="shrink-0 flex items-center gap-2">{rightContent}</div>
      </div>
      {children}
    </div>
  );
}
