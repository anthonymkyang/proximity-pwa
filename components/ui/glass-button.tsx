"use client";

import React from "react";
import { motion, type HTMLMotionProps } from "framer-motion";

type GlassButtonProps = Omit<HTMLMotionProps<"button">, "aria-label"> & {
  ariaLabel?: string;
  children?: React.ReactNode;
};

const GlassButton = React.forwardRef<HTMLButtonElement, GlassButtonProps>(
  ({ ariaLabel, children, onClick, className, ...props }, ref) => {
    return (
      <motion.button
        ref={ref}
        aria-label={ariaLabel}
        whileTap={{ scale: 1.15 }}
        drag
        dragElastic={0.2}
        dragConstraints={{ top: 0, bottom: 0, left: 0, right: 0 }}
        onClick={onClick}
        className={
          "h-8 w-8 flex items-center justify-center rounded-full bg-white/5 backdrop-blur-xl border border-white/20 shadow-[inset_0_0_0_0.5px_rgba(255,255,255,0.6),0_2px_10px_rgba(0,0,0,0.2)] hover:bg-white/10 transition-all duration-300 active:scale-110 " +
          (className ?? "")
        }
        {...props}
      >
        {children}
      </motion.button>
    );
  }
);

GlassButton.displayName = "GlassButton";

export default GlassButton;
