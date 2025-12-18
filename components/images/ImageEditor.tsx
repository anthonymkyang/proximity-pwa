"use client";

import React, {
  useEffect,
  useRef,
  useState,
  PointerEvent,
  ChangeEvent,
} from "react";
import { Button } from "@/components/ui/button";
import { Check, X } from "lucide-react";
import BackButton from "@/components/ui/back-button";

interface ImageEditorProps {
  onSave?: (blob: Blob) => Promise<void>;
  onCancel?: () => void;
  title?: string;
  shape?: "circle" | "rectangle";
  aspectRatio?: number; // width / height (16/9 = 1.78, 1/1 = 1)
  initialImageSrc?: string; // Pass initial image without file picker
}

export default function ImageEditor({
  onSave,
  onCancel,
  title = "Position your image",
  shape = "circle",
  aspectRatio = 1,
  initialImageSrc,
}: ImageEditorProps) {
  const [src, setSrc] = useState<string | null>(initialImageSrc || null);
  const [scale, setScale] = useState(1.1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });

  const dragging = useRef(false);
  const dragStart = useRef({ x: 0, y: 0 });
  const dragOrigin = useRef({ x: 0, y: 0 });
  const activePointers = useRef<Map<number, { x: number; y: number }>>(
    new Map()
  );
  const initialDistance = useRef(0);
  const pinching = useRef(false);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const prevObjectUrl = useRef<string | null>(null);

  const [brokenImageEnv, setBrokenImageEnv] = useState(false);

  // Track image intrinsic size
  const [imgSize, setImgSize] = useState<{ w: number; h: number } | null>(null);

  // Container size (base reference)
  const containerSize = 288; // h-72 and w-72 in tailwind

  // Calculate display height early so it's available in handlers
  const isRectangle = shape === "rectangle";
  const displayHeight = isRectangle
    ? Math.round(containerSize / aspectRatio)
    : containerSize;

  useEffect(() => {
    let imageFound: string | null = null;

    if (typeof window !== "undefined") {
      try {
        const sData = window.sessionStorage.getItem("imageeditor:tempDataUrl");
        const sUrl = window.sessionStorage.getItem("imageeditor:tempUrl");
        const sLegacy = window.sessionStorage.getItem("imageeditor:temp");
        imageFound = sUrl || sData || sLegacy || null;
      } catch {
        // ignore
      }

      if (!imageFound) {
        const w = window as any;
        const w1 = w.__imageEditorTemp;
        const w2 = w.__imageEditorTemp__;
        const w3 = w.__IMAGEEDITOR_TEMP__;
        if (typeof w1 === "string") imageFound = w1;
        else if (typeof w2 === "string") imageFound = w2;
        else if (typeof w3 === "string") imageFound = w3;
        else if (w1 && typeof w1 === "object" && w1.url) imageFound = w1.url;
      }
    }

    setSrc((prev) => (prev ? prev : imageFound));
  }, []);

  useEffect(() => {
    if (typeof navigator === "undefined" || typeof window === "undefined")
      return;
    const ua = navigator.userAgent || "";
    const isIOS = /iPhone|iPad|iPod/i.test(ua);
    const isSim = ua.includes("Simulator") || ua.includes("Xcode");
    const noTouch = !("ontouchstart" in window);
    if (isIOS && (isSim || noTouch)) {
      setBrokenImageEnv(true);
    }
  }, []);

  useEffect(() => {
    if (typeof document === "undefined") return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    if (!src) return;
    e.preventDefault();
    e.stopPropagation();

    const pointerId = e.pointerId;
    activePointers.current.set(pointerId, { x: e.clientX, y: e.clientY });

    if (activePointers.current.size === 1) {
      // Single pointer: start drag
      dragging.current = true;
      dragStart.current = { x: e.clientX, y: e.clientY };
      dragOrigin.current = { ...offset };
    } else if (activePointers.current.size === 2) {
      // Two pointers: start pinch
      dragging.current = false;
      pinching.current = true;
      const pointers = Array.from(activePointers.current.values());
      initialDistance.current = getDistance(pointers[0], pointers[1]);
    }
  };

  const getDistance = (
    p1: { x: number; y: number },
    p2: { x: number; y: number }
  ) => {
    const dx = p2.x - p1.x;
    const dy = p2.y - p1.y;
    return Math.sqrt(dx * dx + dy * dy);
  };

  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    if (!src) return;
    e.preventDefault();
    e.stopPropagation();

    const pointerId = e.pointerId;
    activePointers.current.set(pointerId, { x: e.clientX, y: e.clientY });

    if (activePointers.current.size === 2 && pinching.current) {
      // Pinch zoom: calculate new scale based on distance change
      const pointers = Array.from(activePointers.current.values());
      const currentDistance = getDistance(pointers[0], pointers[1]);

      if (initialDistance.current > 0) {
        const scaleFactor = currentDistance / initialDistance.current;
        const newScale = Math.max(0.5, Math.min(5.0, scale * scaleFactor));
        setScale(newScale);
        initialDistance.current = currentDistance;
      }
    } else if (activePointers.current.size === 1 && dragging.current) {
      // Single touch drag
      const cover = imgSize
        ? Math.max(containerSize / imgSize.w, containerSize / imgSize.h)
        : 1;

      const baseW = imgSize ? imgSize.w * cover : containerSize;
      const baseH = imgSize ? imgSize.h * cover : containerSize;
      const drawW = baseW * scale;
      const drawH = baseH * scale;

      // Maximum pan: clamp so image edges align with container edges at extremes
      const maxOffsetX = Math.max(0, (drawW - containerSize) / 2);
      const maxOffsetY = Math.max(0, (drawH - displayHeight) / 2);

      const dx = e.clientX - dragStart.current.x;
      const dy = e.clientY - dragStart.current.y;

      let newX = dragOrigin.current.x + dx;
      let newY = dragOrigin.current.y + dy;

      // Clamp to prevent dragging beyond image edges
      if (newX > maxOffsetX) newX = maxOffsetX;
      if (newX < -maxOffsetX) newX = -maxOffsetX;
      if (newY > maxOffsetY) newY = maxOffsetY;
      if (newY < -maxOffsetY) newY = -maxOffsetY;

      setOffset({
        x: newX,
        y: newY,
      });
    }
  };

  const onPointerUp = (e: PointerEvent<HTMLDivElement>) => {
    if (!src) return;
    e.preventDefault();
    e.stopPropagation();

    const pointerId = e.pointerId;
    activePointers.current.delete(pointerId);

    if (activePointers.current.size === 0) {
      dragging.current = false;
      pinching.current = false;
      initialDistance.current = 0;
    } else if (activePointers.current.size === 1) {
      // Transition from pinch to drag
      const remaining = Array.from(activePointers.current.values())[0];
      dragging.current = true;
      dragStart.current = { x: remaining.x, y: remaining.y };
      dragOrigin.current = { ...offset };
      pinching.current = false;
    }
  };

  const onPointerLeave = () => {
    activePointers.current.clear();
    dragging.current = false;
  };

  const onTouchMove = (e: React.TouchEvent) => {
    // Prevent default touch behaviors like pinch zoom
    if (e.touches.length > 1) {
      e.preventDefault();
    }
  };

  const handlePickAgain = () => {
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
    try {
      window.sessionStorage.removeItem("imageeditor:tempDataUrl");
      window.sessionStorage.removeItem("imageeditor:tempUrl");
      window.sessionStorage.removeItem("imageeditor:temp");
    } catch {}
    setSrc(null);
    fileInputRef.current?.click();
  };

  const handleFileChosen = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      window.sessionStorage.removeItem("imageeditor:tempDataUrl");
      window.sessionStorage.removeItem("imageeditor:tempUrl");
      window.sessionStorage.removeItem("imageeditor:temp");
    } catch {}
    if (prevObjectUrl.current) {
      URL.revokeObjectURL(prevObjectUrl.current);
      prevObjectUrl.current = null;
    }

    const url = URL.createObjectURL(file);
    prevObjectUrl.current = url;

    setScale(1.1);
    setOffset({ x: 0, y: 0 });
    setImgSize(null);

    setSrc(url);
    try {
      window.sessionStorage.setItem("imageeditor:tempUrl", url);
    } catch {}

    if (e.target) e.target.value = "";
  };

  const handleSave = async () => {
    if (!src) {
      onCancel?.();
      return;
    }

    const img = new Image();
    img.crossOrigin = "anonymous";
    img.decoding = "async";
    img.src = src;
    await new Promise((res) => {
      img.onload = () => res(null);
    });

    const iw = img.naturalWidth || img.width;
    const ih = img.naturalHeight || img.height;

    const size = 512;
    const canvas = document.createElement("canvas");

    if (shape === "circle") {
      canvas.width = size;
      canvas.height = size;
    } else {
      canvas.width = size;
      canvas.height = Math.round(size / aspectRatio);
    }

    const ctx = canvas.getContext("2d");
    if (!ctx) {
      onCancel?.();
      return;
    }

    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high" as ImageSmoothingQuality;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (shape === "circle") {
      ctx.save();
      ctx.beginPath();
      ctx.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2);
      ctx.closePath();
      ctx.clip();
    }

    // Use same logic as preview: base cover is calculated from containerSize
    const previewCover = Math.max(containerSize / iw, containerSize / ih);
    const baseCover = Math.max(size / iw, size / ih);

    // Scale factor from preview (288px) to canvas (512px)
    const scaleFromPreview = size / containerSize;

    // Calculate draw dimensions and offset scaled to canvas size
    const previewDrawW = iw * previewCover * scale;
    const previewDrawH = ih * previewCover * scale;
    const canvasDrawW = previewDrawW * scaleFromPreview;
    const canvasDrawH = previewDrawH * scaleFromPreview;

    // Scale offset from preview coordinates to canvas coordinates
    const scaledOffsetX = offset.x * scaleFromPreview;
    const scaledOffsetY = offset.y * scaleFromPreview;

    const centerX = size / 2 + scaledOffsetX;
    const centerY =
      (shape === "circle" ? size : canvas.height) / 2 + scaledOffsetY;

    ctx.drawImage(
      img,
      centerX - canvasDrawW / 2,
      centerY - canvasDrawH / 2,
      canvasDrawW,
      canvasDrawH
    );

    if (shape === "circle") {
      ctx.restore();
    }

    const blob: Blob = await new Promise((resolve) =>
      canvas.toBlob((b) => resolve(b as Blob), "image/jpeg", 0.9)
    );

    await onSave?.(blob);

    if (prevObjectUrl.current) {
      URL.revokeObjectURL(prevObjectUrl.current);
      prevObjectUrl.current = null;
    }
  };

  useEffect(() => {
    return () => {
      if (prevObjectUrl.current) {
        URL.revokeObjectURL(prevObjectUrl.current);
        prevObjectUrl.current = null;
      }
    };
  }, []);

  return (
    <div className="fixed inset-0 z-9999 bg-[#040615] flex flex-col px-4 py-3 gap-4 overscroll-none">
      {/* top bar */}
      <div className="flex items-center justify-between gap-2">
        <BackButton />
        <Button
          size="icon"
          className="rounded-full"
          onClick={handleSave}
          disabled={!src}
        >
          <Check className="h-5 w-5" />
        </Button>
      </div>

      {/* hidden input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFileChosen}
      />

      {/* title */}
      <div className="px-1">
        <p className="text-base font-semibold text-foreground">{title}</p>
      </div>

      {!src ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-4 text-center">
          <p className="text-sm text-muted-foreground">
            There's no image to edit.
          </p>
          <Button onClick={handlePickAgain} className="rounded-full">
            Choose a photo
          </Button>
        </div>
      ) : brokenImageEnv ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-4 text-center">
          <p className="text-sm text-muted-foreground">
            Preview isn't available in this environment.
          </p>
          <p className="text-xs text-muted-foreground/70 max-w-xs">
            The photo will still be saved and will show on your real device /
            browser.
          </p>
          <Button onClick={handleSave} className="rounded-full">
            Save anyway
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={handlePickAgain}
            className="text-xs"
          >
            Pick a different photo
          </Button>
        </div>
      ) : (
        <>
          <div className="flex-1 flex items-center justify-center">
            <div
              className={`relative overflow-hidden bg-slate-200/40 border-4 border-white touch-none shadow-[0_0_50px_rgba(0,0,0,0.45)] ${
                isRectangle ? `w-72` : "h-72 w-72 rounded-full"
              }`}
              style={{
                ...(isRectangle ? { height: `${displayHeight}px` } : {}),
                touchAction: "none",
                WebkitTouchCallout: "none",
                WebkitUserSelect: "none",
                userSelect: "none",
              }}
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              onPointerLeave={onPointerUp}
              onPointerCancel={onPointerUp}
            >
              <img
                key={src}
                src={src}
                alt="image preview"
                className="absolute select-none"
                style={{
                  width: `${
                    imgSize
                      ? Math.max(
                          containerSize / (imgSize.w || 1),
                          containerSize / (imgSize.h || 1)
                        ) * (imgSize.w || containerSize)
                      : containerSize
                  }px`,
                  height: `${
                    imgSize
                      ? Math.max(
                          containerSize / (imgSize.w || 1),
                          containerSize / (imgSize.h || 1)
                        ) * (imgSize.h || containerSize)
                      : containerSize
                  }px`,
                  left: "50%",
                  top: "50%",
                  transform: `translate(-50%, -50%) translate(${offset.x}px, ${offset.y}px) scale(${scale})`,
                  transformOrigin: "center center",
                  willChange: "transform",
                  WebkitUserSelect: "none",
                  userSelect: "none",
                }}
                draggable={false}
                onLoad={(ev) => {
                  const el = ev.currentTarget as HTMLImageElement;
                  const w = el.naturalWidth || el.width;
                  const h = el.naturalHeight || el.height;
                  if (!imgSize || imgSize.w !== w || imgSize.h !== h)
                    setImgSize({ w, h });
                }}
              />
              <div
                className="pointer-events-none absolute inset-3 ring-1 ring-white/15"
                style={isRectangle ? {} : { borderRadius: "50%" }}
              />
            </div>
          </div>

          <div className="pb-6 text-xs text-muted-foreground text-center">
            Pinch to zoom, drag to adjust
          </div>
        </>
      )}
    </div>
  );
}
