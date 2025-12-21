"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import { ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";

export interface ImageCarouselProps {
  open: boolean;
  photos: string[];
  index: number;
  onClose: () => void;
  onPrev: () => void;
  onNext: () => void;
}

/**
 * Lightweight custom overlay carousel (non-Drawer) with blurred dark backdrop
 * Supports keyboard navigation, touch swipes, and mouse clicks
 */
export function ImageCarousel({
  open,
  photos,
  index,
  onClose,
  onPrev,
  onNext,
}: ImageCarouselProps) {
  const [loaded, setLoaded] = useState(false);
  const startXRef = useRef<number | null>(null);
  const startYRef = useRef<number | null>(null);
  const isSwipingRef = useRef(false);
  const SWIPE_THRESHOLD = 48; // pixels

  const onKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (!open) return;
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        onPrev();
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        onNext();
      }
    },
    [open, onClose, onPrev, onNext]
  );

  useEffect(() => {
    if (!open) return;
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onKeyDown]);

  // Reset image loaded flag on photo change
  useEffect(() => {
    setLoaded(false);
  }, [index, photos]);

  // Lazy preload adjacent images
  useEffect(() => {
    if (!open || photos.length <= 1) return;
    const prevIdx = index === 0 ? photos.length - 1 : index - 1;
    const nextIdx = (index + 1) % photos.length;
    [prevIdx, nextIdx].forEach((i) => {
      const url = photos[i];
      if (!url) return;
      const img = document.createElement("img");
      img.src = url;
    });
  }, [open, index, photos]);

  if (!open) return null;
  const current = photos[index];

  return (
    <div
      className="fixed inset-0 z-50 bg-black/70 supports-backdrop-filter:bg-black/50 backdrop-blur-md animate-in fade-in-0 duration-200"
      role="dialog"
      aria-modal="true"
      aria-label="Photos"
      onClick={onClose}
    >
      <div
        className="relative w-full h-full"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Image viewport */}
        <div
          className="absolute inset-0"
          onTouchStart={(e) => {
            const t = e.touches[0];
            startXRef.current = t.clientX;
            startYRef.current = t.clientY;
            isSwipingRef.current = false;
          }}
          onTouchMove={(e) => {
            if (startXRef.current == null || startYRef.current == null) return;
            const t = e.touches[0];
            const dx = t.clientX - startXRef.current;
            const dy = t.clientY - startYRef.current;
            // horizontal intent, prevent background scroll when strong horizontal move
            if (Math.abs(dx) > 12 && Math.abs(dx) > Math.abs(dy)) {
              isSwipingRef.current = true;
              e.preventDefault();
            }
          }}
          onTouchEnd={(e) => {
            if (startXRef.current == null || startYRef.current == null) return;
            const t = e.changedTouches[0];
            const dx = t.clientX - startXRef.current;
            const dy = t.clientY - startYRef.current;
            const horizontal = Math.abs(dx) > Math.abs(dy);
            if (horizontal && Math.abs(dx) > SWIPE_THRESHOLD) {
              if (dx < 0) onNext();
              else onPrev();
            }
            startXRef.current = null;
            startYRef.current = null;
            isSwipingRef.current = false;
          }}
        >
          {current ? (
            <Image
              src={current}
              alt={`Photo ${index + 1} of ${photos.length}`}
              fill
              priority
              sizes="100vw"
              draggable={false}
              unoptimized
              onLoadingComplete={() => setLoaded(true)}
              className={`object-contain transition-opacity duration-300 ${
                loaded ? "opacity-100" : "opacity-0"
              } animate-in zoom-in-95`}
            />
          ) : null}
        </div>
        {/* Controls - only show if more than 1 photo */}
        {photos.length > 1 && (
          <div className="absolute inset-0 flex items-center justify-between px-2">
            <button
              type="button"
              aria-label="Previous photo"
              className="rounded-full bg-background/60 supports-backdrop-filter:bg-background/50 backdrop-blur-md ring-1 ring-border text-foreground hover:bg-background/60 p-2"
              onClick={onPrev}
            >
              <ChevronRight className="h-6 w-6 rotate-180" />
            </button>
            <button
              type="button"
              aria-label="Next photo"
              className="rounded-full bg-background/60 supports-backdrop-filter:bg-background/50 backdrop-blur-md ring-1 ring-border text-foreground hover:bg-background/60 p-2"
              onClick={onNext}
            >
              <ChevronRight className="h-6 w-6" />
            </button>
          </div>
        )}
        {/* Top bar: index + close */}
        <div className="absolute top-2 left-2 right-2 flex items-center justify-between">
          {photos.length > 1 && (
            <div className="rounded-full bg-background/60 supports-backdrop-filter:bg-background/50 backdrop-blur-md ring-1 ring-border text-foreground px-3 py-1 text-xs">
              {index + 1} / {photos.length}
            </div>
          )}
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className={`rounded-full bg-background/60 supports-backdrop-filter:bg-background/50 backdrop-blur-md ring-1 ring-border hover:bg-background/60 ${photos.length === 1 ? 'ml-auto' : ''}`}
            onClick={onClose}
          >
            Close
          </Button>
        </div>
      </div>
    </div>
  );
}
