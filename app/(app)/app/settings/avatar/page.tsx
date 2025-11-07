"use client";

import React, {
  useEffect,
  useRef,
  useState,
  PointerEvent,
  ChangeEvent,
} from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";
import BackButton from "@/components/ui/back-button";
import { Button } from "@/components/ui/button";
import { Check } from "lucide-react";

export default function AvatarEditorPage() {
  const router = useRouter();
  const supabase = createClient();

  const [src, setSrc] = useState<string | null>(null);
  const [scale, setScale] = useState(1.1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });

  const dragging = useRef(false);
  const dragStart = useRef({ x: 0, y: 0 });
  const dragOrigin = useRef({ x: 0, y: 0 });

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [brokenImageEnv, setBrokenImageEnv] = useState(false);

  useEffect(() => {
    let imageFound: string | null = null;

    if (typeof window !== "undefined") {
      try {
        const sData = window.sessionStorage.getItem("avatar:tempDataUrl");
        const sUrl = window.sessionStorage.getItem("avatar:tempUrl");
        const sLegacy = window.sessionStorage.getItem("avatar:temp");
        imageFound = sData || sUrl || sLegacy || null;
      } catch {
        // ignore
      }

      if (!imageFound) {
        const w = window as any;
        const w1 = w.__avatarTemp;
        const w2 = w.__avatarTemp__;
        const w3 = w.__AVATAR_TEMP__;
        if (typeof w1 === "string") imageFound = w1;
        else if (typeof w2 === "string") imageFound = w2;
        else if (typeof w3 === "string") imageFound = w3;
        else if (w1 && typeof w1 === "object" && w1.url) imageFound = w1.url;
      }
    }

    setSrc(imageFound);
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
    dragging.current = true;
    dragStart.current = { x: e.clientX, y: e.clientY };
    dragOrigin.current = { ...offset };
  };

  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    if (!dragging.current) return;
    const dx = e.clientX - dragStart.current.x;
    const dy = e.clientY - dragStart.current.y;
    setOffset({
      x: dragOrigin.current.x + dx,
      y: dragOrigin.current.y + dy,
    });
  };

  const onPointerUp = () => {
    dragging.current = false;
  };

  const handlePickAgain = () => {
    fileInputRef.current?.click();
  };

  const handleFileChosen = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const result = ev.target?.result as string | null;
      if (result) {
        setSrc(result);
        try {
          window.sessionStorage.setItem("avatar:tempDataUrl", result);
        } catch {
          // ignore quota
        }
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSave = async () => {
    if (!src) {
      router.replace("/app/settings");
      return;
    }

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      router.push("/auth");
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
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      router.replace("/app/settings");
      return;
    }
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high" as ImageSmoothingQuality;

    ctx.clearRect(0, 0, size, size);
    ctx.save();
    ctx.beginPath();
    ctx.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2);
    ctx.closePath();
    ctx.clip();

    // Scale the image to COVER the square canvas while preserving aspect ratio.
    const baseCover = Math.max(size / iw, size / ih);
    const coverScale = baseCover * 1.4 * scale; // same visual zoom range as preview
    const drawW = iw * coverScale;
    const drawH = ih * coverScale;
    const centerX = size / 2 + offset.x; // 1:1 with UI offset
    const centerY = size / 2 + offset.y;

    ctx.drawImage(img, centerX - drawW / 2, centerY - drawH / 2, drawW, drawH);

    ctx.restore();

    const blob: Blob = await new Promise((resolve) =>
      canvas.toBlob((b) => resolve(b as Blob), "image/jpeg", 0.9)
    );

    const filePath = `${user.id}/${Date.now()}.jpg`;

    const { error: uploadError } = await supabase.storage
      .from("avatars")
      .upload(filePath, blob, {
        upsert: true,
        contentType: "image/jpeg",
      });

    if (uploadError) {
      console.error(uploadError);
      return;
    }

    const { error: updateError } = await supabase
      .from("profiles")
      .update({
        avatar_url: filePath,
        updated_at: new Date().toISOString(),
      })
      .eq("id", user.id);

    if (updateError) {
      console.error(updateError);
    }

    router.replace("/app/settings");
  };

  return (
    <div className="fixed inset-0 z-9999 bg-[#040615] flex flex-col px-4 py-3 gap-4 overscroll-none">
      {/* top bar */}
      <div className="flex items-center justify-between gap-2">
        <BackButton />
        {/* CHANGED: not ghost, primary rounded icon */}
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
        <p className="text-base font-semibold text-foreground">
          Position your image
        </p>
      </div>

      {!src ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-4 text-center">
          <p className="text-sm text-muted-foreground">
            There’s no image to edit.
          </p>
          <Button onClick={handlePickAgain} className="rounded-full">
            Choose a photo
          </Button>
        </div>
      ) : brokenImageEnv ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-4 text-center">
          <p className="text-sm text-muted-foreground">
            Preview isn’t available in this environment.
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
              className="relative h-72 w-72 rounded-full overflow-hidden bg-slate-200/40 border-4 border-white touch-none shadow-[0_0_50px_rgba(0,0,0,0.45)]"
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              onPointerLeave={onPointerUp}
            >
              <img
                key={src}
                src={src}
                alt="avatar preview"
                className="absolute inset-0 h-full w-full object-cover select-none"
                style={{
                  transform: `translate(${offset.x}px, ${offset.y}px) scale(${scale})`,
                  transformOrigin: "center center",
                }}
                draggable={false}
              />
              <div className="pointer-events-none absolute inset-3 rounded-full ring-1 ring-white/15" />
            </div>
          </div>

          <div className="pb-6 space-y-2">
            <p className="text-xs text-muted-foreground">Zoom</p>
            <input
              type="range"
              min={1}
              max={2.6}
              step={0.02}
              value={scale}
              onChange={(e) => setScale(Number(e.target.value))}
              className="w-full"
            />
          </div>
        </>
      )}
    </div>
  );
}
