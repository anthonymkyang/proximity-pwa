import * as React from "react";
import { cn } from "@/lib/utils";
import { PlusIcon } from "lucide-react";

// Button32: small, round icon button that works with Radix `asChild` triggers.
// - Forwards its ref to a native <button> so DropdownMenuTrigger can attach focus/aria
// - Accepts a friendly `primary` alias which maps to a solid look
// - Defaults to an outline/ghosty look to match shadcn styles

export type Button32Variant =
  | "default"
  | "secondary"
  | "outline"
  | "ghost"
  | "destructive"
  | "link"
  | "primary"; // alias for a solid primary style

export interface Button32Props
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  label?: string; // a11y label if you don't pass aria-label directly
  variant?: Button32Variant;
  className?: string;
  children?: React.ReactNode; // icon or content
}

const baseClasses =
  "inline-flex items-center justify-center rounded-full h-10 w-10 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none ring-offset-background";

function variantClasses(variant: Button32Variant | undefined) {
  switch (variant) {
    case "primary":
    case "default":
      return "bg-primary text-primary-foreground hover:bg-primary/90";
    case "secondary":
      return "bg-secondary text-secondary-foreground hover:bg-secondary/80";
    case "outline":
      return "border border-input bg-background hover:bg-accent hover:text-accent-foreground";
    case "ghost":
      return "hover:bg-accent hover:text-accent-foreground";
    case "destructive":
      return "bg-destructive text-destructive-foreground hover:bg-destructive/90";
    case "link":
      return "underline-offset-4 hover:underline";
    default:
      return "border border-input bg-background hover:bg-accent hover:text-accent-foreground";
  }
}

const Button32 = React.forwardRef<HTMLButtonElement, Button32Props>(
  (
    {
      label = "Add new item",
      variant = "outline",
      className,
      children,
      type = "button",
      ...props
    },
    ref
  ) => {
    // Prefer explicit aria-label, fallback to `label` for accessibility
    const ariaLabel = (props as any)["aria-label"] ?? label ?? "Button";

    return (
      <button
        ref={ref}
        type={type}
        aria-label={ariaLabel}
        className={cn(baseClasses, variantClasses(variant), className)}
        {...props}
      >
        {children ?? <PlusIcon className="h-5 w-5" />}
        {/* Screen reader text if consumer provided a visual-only icon without aria-label */}
        {!props["aria-label"] && label ? (
          <span className="sr-only">{label}</span>
        ) : null}
      </button>
    );
  }
);

Button32.displayName = "Button32";

export default Button32;
