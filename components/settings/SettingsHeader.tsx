"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { createClient } from "@/utils/supabase/client";
import { AvatarButton } from "../ui/avatar-button";
import { Save, Pencil } from "lucide-react";

export default function SettingsHeader() {
  const [greeting, setGreeting] = useState("Welcome back");
  const [name, setName] = useState("Cruiser");
  const [nameLoading, setNameLoading] = useState(true);
  const [editingName, setEditingName] = useState(false);
  const nameRef = useRef<HTMLSpanElement | null>(null);
  const [savingName, setSavingName] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);

  function resolveAvatarUrl(raw?: string | null): string | null {
    if (!raw || typeof raw !== "string") return null;
    if (/^https?:\/\//i.test(raw)) return raw;
    // storage key like "avatars/uid/file.jpg" or "uid/file.jpg"
    let path = raw.replace(/^\/+/, "");
    if (path.toLowerCase().startsWith("avatars/")) {
      path = path.slice("avatars/".length);
    }
    const origin =
      typeof window !== "undefined" && window.location?.origin
        ? window.location.origin
        : "";
    const base = origin ? `${origin}` : "";
    return `${base}/api/photos/avatars?path=${encodeURIComponent(path)}`;
  }

  // greeting
  useEffect(() => {
    const h = new Date().getHours();
    const g =
      h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";
    setGreeting(g);
  }, []);

  // load profile (name and avatar_url)
  useEffect(() => {
    const loadProfile = async () => {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        return;
      }
      const { data: profile } = await supabase
        .from("profiles")
        .select("name, avatar_url")
        .eq("id", user.id)
        .maybeSingle();
      if (profile?.name && profile.name.trim().length > 0) {
        setName(profile.name);
      }
      const resolved = resolveAvatarUrl(profile?.avatar_url);
      setAvatarUrl(resolved);
      setNameLoading(false);
    };
    loadProfile();
  }, []);

  const handleNameToggle = useCallback(async () => {
    if (!editingName) {
      setEditingName(true);
      setTimeout(() => {
        if (nameRef.current) {
          const el = nameRef.current;
          el.focus();
          const range = document.createRange();
          range.selectNodeContents(el);
          range.collapse(false);
          const sel = window.getSelection();
          sel?.removeAllRanges();
          sel?.addRange(range);
        }
      }, 0);
      return;
    }
    if (savingName) return;
    setSavingName(true);
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    const newNameRaw = nameRef.current?.textContent ?? "";
    const newName =
      newNameRaw.trim().length > 0 ? newNameRaw.trim() : "Cruiser";
    if (user) {
      await supabase.from("profiles").upsert({
        id: user.id,
        name: newName,
        updated_at: new Date().toISOString(),
      });
    }
    setName(newName);
    setSavingName(false);
    setEditingName(false);
  }, [editingName, savingName]);

  return (
    <>
      {/* Header row */}
      <div className="flex items-center gap-3">
        <AvatarButton fallbackName={name} src={avatarUrl ?? undefined} />
        <div className="leading-tight">
          <p className="text-sm text-muted-foreground">{greeting},</p>
          <div className="flex items-center gap-1">
            {editingName ? (
              <span
                ref={nameRef}
                contentEditable
                suppressContentEditableWarning
                className="text-lg font-semibold outline-none border-none bg-transparent focus:ring-0"
              >
                {name}
              </span>
            ) : nameLoading ? (
              <div className="h-5 w-28 rounded bg-muted animate-pulse" />
            ) : (
              <p className="text-lg font-semibold">{name}</p>
            )}
            <button
              type="button"
              onClick={handleNameToggle}
              aria-label={editingName ? "Save name" : "Edit name"}
              className="ml-1 rounded p-1 hover:bg-muted transition text-muted-foreground"
            >
              {editingName ? (
                savingName ? (
                  <span className="h-4 w-4 rounded-full border-2 border-muted-foreground/30 border-t-muted-foreground animate-spin inline-block" />
                ) : (
                  <Save className="h-4 w-4" />
                )
              ) : (
                <Pencil className="h-4 w-4" />
              )}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
