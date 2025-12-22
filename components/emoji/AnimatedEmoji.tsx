"use client";

import { useEffect, useRef, useState } from "react";
import lottie, { AnimationItem } from "lottie-web";

type AnimatedEmojiProps = {
  src: string;
  size?: number;
  onClick?: (e: React.MouseEvent<HTMLButtonElement>) => void;
  className?: string;
  fallback?: string;
  delayMs?: number;
  playOnce?: boolean;
  restAtEnd?: boolean;
  restFrameFraction?: number; // 0..1 fraction of animation to rest on
  disableAnimation?: boolean;
};

export function AnimatedEmoji({
  src,
  size = 36,
  onClick,
  className,
  fallback,
  delayMs = 0,
  playOnce = false,
  restAtEnd = false,
  restFrameFraction,
  disableAnimation = false,
}: AnimatedEmojiProps) {
  const ref = useRef<HTMLDivElement | null>(null);
  const animRef = useRef<AnimationItem | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);

  const playAnimation = () => {
    if (disableAnimation) return;
    const anim = animRef.current;
    if (!anim) return;
    try {
      anim.goToAndPlay(0, true);
    } catch {
      anim.play();
    }
  };

  useEffect(() => {
    setLoaded(false);
    setFailed(false);
    if (!ref.current) return;
    let anim: AnimationItem | null = null;
    const handleLoaded = () => {
      setLoaded(true);
      setFailed(false);
    };
    const handleFailed = () => {
      setLoaded(false);
      setFailed(true);
    };
    let playTimer: NodeJS.Timeout | null = null;
    const handleComplete = () => {
      if (!animRef.current) return;
      try {
        if (restFrameFraction != null) {
          const total = Math.max(1, animRef.current.totalFrames ?? 1);
          const target = Math.round((total - 1) * restFrameFraction);
          animRef.current.goToAndStop(target, true);
          return;
        }
        if (restAtEnd) {
          const endFrame = Math.max(0, (animRef.current.totalFrames ?? 1) - 1);
          animRef.current.goToAndStop(endFrame, true);
        }
      } catch {
        // ignore
      }
    };
    let handleDomLoaded: (() => void) | null = null;
    try {
      anim = lottie.loadAnimation({
        container: ref.current,
        renderer: "svg",
        loop: !playOnce,
        autoplay: false,
        path: src,
      });
      animRef.current = anim;
      handleDomLoaded = () => {
        handleLoaded();
        if (restFrameFraction != null) {
          try {
            const total = Math.max(1, anim.totalFrames ?? 1);
            const target = Math.round((total - 1) * restFrameFraction);
            anim.goToAndStop(target, true);
          } catch {
            // ignore
          }
        }
      };
      anim.addEventListener("DOMLoaded", handleDomLoaded);
      anim.addEventListener("data_failed", handleFailed);
      anim.addEventListener("complete", handleComplete);
      if (!disableAnimation) {
        const start = () => {
          playAnimation();
        };
        playTimer = setTimeout(start, delayMs);
      }
    } catch {
      setLoaded(false);
      setFailed(true);
    }
    return () => {
      animRef.current = null;
      if (handleDomLoaded) {
        anim?.removeEventListener("DOMLoaded", handleDomLoaded);
      }
      anim?.removeEventListener("data_failed", handleFailed);
      anim?.removeEventListener("complete", handleComplete);
      anim?.destroy();
      if (playTimer) clearTimeout(playTimer);
    };
  }, [src, delayMs, playOnce, restAtEnd, restFrameFraction, disableAnimation]);

  return (
    <button
      type="button"
      onClick={onClick}
      onMouseEnter={playAnimation}
      className={`relative grid place-items-center rounded-full hover:scale-110 transition-transform focus:outline-none bg-transparent overflow-hidden ${className ?? ""}`}
      style={{ width: size, height: size }}
    >
      <div ref={ref} className="w-full h-full" />
      {fallback && failed ? (
        <span className="pointer-events-none absolute inset-0 grid place-items-center text-lg">
          {fallback}
        </span>
      ) : null}
    </button>
  );
}
