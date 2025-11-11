"use client";

import { ReactNode } from "react";
import Button32 from "@/components/shadcn-studio/button/button-32";

interface HeaderButtonProps {
  onClick?: () => void;
  ariaLabel?: string;
  children: ReactNode;
}

export default function HeaderButton({
  onClick,
  ariaLabel = "Header button",
  children,
}: HeaderButtonProps) {
  return (
    <Button32 aria-label={ariaLabel} onClick={onClick}>
      {children}
    </Button32>
  );
}
