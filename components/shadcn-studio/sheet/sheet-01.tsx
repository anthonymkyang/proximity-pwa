"use client";
import * as React from "react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import BackButton from "@/components/ui/back-button";
import TopBar from "@/components/nav/TopBar";

export interface Sheet01Props {
  title: string;
  description?: string;
  content: React.ReactNode;
  footer?: React.ReactNode;
  /** Controlled open state from parent */
  open?: boolean;
  /** Controlled change handler from parent */
  onOpenChange?: (open: boolean) => void;
  /** Optional passthroughs */
  side?: React.ComponentProps<typeof SheetContent>["side"];
  className?: string;
}

/**
 * Controlled, stateless wrapper. No internal setState calls.
 */
const Sheet01: React.FC<Sheet01Props> = ({
  title,
  description,
  content,
  footer,
  open,
  onOpenChange,
  side,
  className,
}) => {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side={side}
        className={`w-full max-w-full h-full border-0 ${className || ""}`}
      >
        <SheetHeader>
          <SheetTitle>{title}</SheetTitle>
          {description ? (
            <SheetDescription>{description}</SheetDescription>
          ) : null}
        </SheetHeader>
        <div className="px-2">{content}</div>
        {footer ? <SheetFooter>{footer}</SheetFooter> : null}
      </SheetContent>
    </Sheet>
  );
};

export default Sheet01;
