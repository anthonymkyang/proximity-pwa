// app/(app)/app/AppShell.tsx
"use client";

import { useCallback, useEffect, useRef } from "react";
import { createClient } from "@/utils/supabase/client";
import { usePathname } from "next/navigation";
import MapCanvas from "@/components/map/MapCanvas";
import AppBar from "@/components/nav/AppBar";

/**
 * Presence strategy:
 * - Mark online on interaction and on mount.
 * - Heartbeat every 60s to bump last_seen.
 * - After 90s of no interaction, mark away.
 * - On pagehide/beforeunload, mark offline (sendBeacon or direct upsert).
 * Notes:
 * - Requires RLS policy to allow a user to upsert their own row in `user_presence`.
 */
const IDLE_MS = 90_000; // inactivity -> away
const HEARTBEAT_MS = 60_000; // periodic heartbeat
const MIN_WRITE_MS = 12_000; // throttle presence writes

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isMapPage = pathname === "/app";

  const supabase = useRef(createClient()).current;

  const userIdRef = useRef<string | null>(null);
  const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const heartbeatRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastWriteAtRef = useRef(0);
  const lastSentStatusRef = useRef<"online" | "away" | "offline" | null>(null);
  const isMountedRef = useRef(true);

  // --- presence write helpers ---
  const canWriteNow = () => Date.now() - lastWriteAtRef.current >= MIN_WRITE_MS;

  const upsertPresence = useCallback(
    async (status: "online" | "away" | "offline") => {
      const userId = userIdRef.current;
      if (!userId || !isMountedRef.current) return;

      // de-dup + throttle
      if (lastSentStatusRef.current === status && !canWriteNow()) return;

      try {
        lastWriteAtRef.current = Date.now();
        lastSentStatusRef.current = status;
        await supabase.from("user_presence").upsert(
          {
            user_id: userId,
            status,
            last_seen: new Date().toISOString(),
          },
          { onConflict: "user_id" }
        );
      } catch (e) {
        console.warn("presence upsert failed:", e);
      }
    },
    [supabase]
  );

  const setOnline = useCallback(() => {
    if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    idleTimerRef.current = setTimeout(() => upsertPresence("away"), IDLE_MS);
    void upsertPresence("online");
  }, [upsertPresence]);

  const setAway = useCallback(() => {
    if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    idleTimerRef.current = null;
    void upsertPresence("away");
  }, [upsertPresence]);

  const setOffline = useCallback(async () => {
    const userId = userIdRef.current;
    if (!userId) return;
    try {
      await supabase.from("user_presence").upsert(
        {
          user_id: userId,
          status: "offline",
          last_seen: new Date().toISOString(),
        },
        { onConflict: "user_id" }
      );
    } catch {
      // swallow
    }
  }, [supabase]);

  // --- initialize presence + listeners ---
  useEffect(() => {
    let unsubAuth: (() => void) | null = null;

    const init = async () => {
      // load current user
      const { data } = await supabase.auth.getUser();
      userIdRef.current = data.user?.id ?? null;

      // subscribe to auth changes too
      const auth = supabase.auth.onAuthStateChange((_evt, session) => {
        userIdRef.current = session?.user?.id ?? null;
        if (userIdRef.current) setOnline();
      });
      unsubAuth = () => auth.data.subscription.unsubscribe();

      // Interactions set online and restart idle timer
      const onInteract = () => setOnline();
      const onVisibility = () => {
        if (document.hidden) setAway();
        else setOnline();
      };
      const onPageHide = () => setOffline();

      const opts: AddEventListenerOptions = { passive: true };
      window.addEventListener("pointerdown", onInteract, opts);
      window.addEventListener("keydown", onInteract, opts);
      window.addEventListener("touchstart", onInteract, opts);
      document.addEventListener("visibilitychange", onVisibility, opts);
      window.addEventListener("pagehide", onPageHide);
      window.addEventListener("beforeunload", onPageHide);

      // Heartbeat
      heartbeatRef.current = setInterval(() => {
        const last = lastSentStatusRef.current;
        if (last === "online" || last === "away") {
          void upsertPresence(last);
        }
      }, HEARTBEAT_MS);

      // initial mark
      if (userIdRef.current) setOnline();
    };

    void init();

    return () => {
      isMountedRef.current = false;
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
      if (heartbeatRef.current) clearInterval(heartbeatRef.current);
      if (unsubAuth) unsubAuth();

      // best-effort mark offline
      void setOffline();
    };
  }, [setOnline, setAway, setOffline, upsertPresence, supabase]);

  // --- existing UI shell (map + app bar + content) ---
  return (
    <div className="relative min-h-screen">
      <div className="fixed inset-0 z-0">
        <MapCanvas />
      </div>

      <main
        className={`relative min-h-[calc(100dvh-56px)] overflow-y-auto ${
          isMapPage ? "bg-transparent pointer-events-none" : "bg-background"
        }`}
      >
        <div className={isMapPage ? "pointer-events-auto" : ""}>{children}</div>
      </main>

      <AppBar />
    </div>
  );
}
