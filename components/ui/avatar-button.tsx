"use client";

import React, { useEffect, useState, useRef } from "react";
import { createClient } from "@/utils/supabase/client";
import { Camera } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
  DrawerFooter,
  DrawerClose,
} from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { Image as ImageIcon, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import Image from "next/image";

export function AvatarButton({
  fallbackName = "C",
  size = 64,
  src,
  className,
  showCamera = true,
}: {
  fallbackName?: string;
  size?: number;
  src?: string | null;
  className?: string;
  showCamera?: boolean;
}) {
  const supabase = createClient();
  const router = useRouter();
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const effectiveSrc = src ?? avatarUrl ?? null;

  // Normalize same-origin absolute URLs to relative to avoid next/image host config in dev
  const normalizedSrc = React.useMemo(() => {
    if (!effectiveSrc) return null;
    try {
      // If it's already relative, keep as-is
      if (effectiveSrc.startsWith("/")) return effectiveSrc;
      // If it's an absolute URL and same-origin, strip the origin
      if (typeof window !== "undefined") {
        const origin = window.location.origin;
        if (effectiveSrc.startsWith(origin)) {
          return effectiveSrc.slice(origin.length) || "/";
        }
      }
      return effectiveSrc;
    } catch {
      return effectiveSrc;
    }
  }, [effectiveSrc]);

  const boxSize = typeof size === "number" ? `${size}px` : String(size);
  const initialsFontSize = Math.max(
    12,
    Math.floor((typeof size === "number" ? size : 64) * 0.35)
  );

  // load current avatar (defensive)
  useEffect(() => {
    const load = async () => {
      if (src) return;
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from("profiles")
        .select("avatar_url")
        .eq("id", user.id)
        .maybeSingle();

      if (error) {
        const code = (error as { code?: string }).code;
        if (code !== "42703") {
          console.error("avatar load error", error);
        }
        return;
      }

      if (data?.avatar_url) {
        const { data: signed } = await supabase.storage
          .from("avatars")
          .createSignedUrl(data.avatar_url, 60 * 60 * 24 * 7);
        if (signed?.signedUrl) setAvatarUrl(signed.signedUrl);
      }
    };
    load();
  }, [supabase, src]);

  const handleRemove = async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    await supabase
      .from("profiles")
      .update({ avatar_url: null, updated_at: new Date().toISOString() })
      .eq("id", user.id);

    setAvatarUrl(null);
    setOpen(false);
  };

  const openPicker = () => {
    setOpen(false);
    setTimeout(() => fileInputRef.current?.click(), 20);
  };

  const handleFileChosen = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const objectUrl = URL.createObjectURL(file);

    if (typeof window !== "undefined") {
      // in-memory (works when the navigation keeps the same JS context)
      (window as any).__avatarTemp = {
        url: objectUrl,
        name: file.name,
        type: file.type,
      };
      // fallback for simulator / HMR / full-nav that loses window globals
      try {
        sessionStorage.setItem("avatar:tempUrl", objectUrl);
      } catch (_) {
        // ignore quota / private mode
      }
    }

    // go to the editor
    router.push("/app/settings/avatar");

    // allow selecting the same file again later
    e.target.value = "";
  };

  return (
    <>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFileChosen}
      />
      <div className={cn("relative", className)}>
        <div
          className="relative aspect-square rounded-full bg-muted flex items-center justify-center font-medium border border-border overflow-hidden shrink-0"
          style={{ width: boxSize }}
        >
          {effectiveSrc ? (
            normalizedSrc && normalizedSrc.includes("?") ? (
              // For same-origin API URLs with query strings, avoid next/image localPatterns checks
              // by using a plain img that fills the container.
              // The parent wrapper is relative, so absolute fill works fine.
              // No inline styles, only classes.
              <img
                src={normalizedSrc}
                alt={fallbackName ? `${fallbackName} avatar` : "Avatar"}
                className="absolute inset-0 h-full w-full object-cover object-center"
                loading="eager"
                decoding="async"
              />
            ) : (
              <Image
                src={normalizedSrc as string}
                alt={fallbackName ? `${fallbackName} avatar` : "Avatar"}
                fill
                className="object-cover object-center"
                sizes={`${size}px`}
                priority
              />
            )
          ) : (
            <span style={{ fontSize: `${initialsFontSize}px` }}>
              {fallbackName?.[0]?.toUpperCase() ?? "C"}
            </span>
          )}
        </div>
        {showCamera ? (
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="absolute -bottom-1 -right-1 inline-flex h-7 w-7 items-center justify-center rounded-full bg-background text-foreground shadow-md ring-1 ring-border hover:bg-muted transition"
            aria-label="Change avatar"
          >
            <Camera className="h-3.5 w-3.5" />
          </button>
        ) : null}
      </div>

      {showCamera ? (
        <Drawer open={open} onOpenChange={setOpen}>
          <DrawerContent className="w-full">
            <div className="p-4 space-y-2">
              <DrawerHeader className="px-0 pt-0 pb-2">
                <DrawerTitle>Change avatar</DrawerTitle>
                <DrawerDescription>Select a source</DrawerDescription>
              </DrawerHeader>

              <button
                type="button"
                onClick={openPicker}
                className="w-full flex items-center gap-3 rounded-lg px-3 py-2 hover:bg-muted transition text-left"
              >
                <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-muted">
                  <ImageIcon className="h-4 w-4" />
                </span>
                <span className="text-sm">Choose from library</span>
              </button>

              {avatarUrl ? (
                <button
                  type="button"
                  onClick={handleRemove}
                  className="w-full flex items-center gap-3 rounded-lg px-3 py-2 hover:bg-destructive/10 text-destructive transition text-left"
                >
                  <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-destructive/10 text-destructive">
                    <Trash2 className="h-4 w-4" />
                  </span>
                  <span className="text-sm">Remove current photo</span>
                </button>
              ) : null}

              <DrawerFooter className="px-0 pt-2">
                <DrawerClose asChild>
                  <Button variant="outline" className="w-full">
                    Cancel
                  </Button>
                </DrawerClose>
              </DrawerFooter>
            </div>
          </DrawerContent>
        </Drawer>
      ) : null}
    </>
  );
}
