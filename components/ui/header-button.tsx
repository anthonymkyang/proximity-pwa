"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import Button32 from "@/components/shadcn-studio/button/button-32";

export interface HeaderButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {}

const HeaderButton = React.forwardRef<HTMLButtonElement, HeaderButtonProps>(
  ({ className, children, ...props }, ref) => {
    return (
      <Button32 ref={ref} type="button" className={cn(className)} {...props}>
        {children}
      </Button32>
    );
  }
);

HeaderButton.displayName = "HeaderButton";

export default HeaderButton;
