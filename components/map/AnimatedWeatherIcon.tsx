"use client";

import React, { useEffect, useRef } from "react";
import lottie from "lottie-web";

type AnimatedWeatherIconProps = {
  animation: string;
  size?: number;
  ariaLabel?: string;
};

export default function AnimatedWeatherIcon({
  animation,
  size = 40,
  ariaLabel = "Weather",
}: AnimatedWeatherIconProps) {
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!ref.current) return;
    const instance = lottie.loadAnimation({
      container: ref.current,
      renderer: "svg",
      loop: true,
      autoplay: true,
      path: animation,
    });
    return () => {
      instance.destroy();
    };
  }, [animation]);

  return (
    <div
      ref={ref}
      aria-label={ariaLabel}
      style={{ width: `${size}px`, height: `${size}px` }}
    />
  );
}
