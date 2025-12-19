// app/(app)/app/AppShell.tsx
"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createClient } from "@/utils/supabase/client";
import { usePathname } from "next/navigation";
import MapCanvas from "@/components/map/MapCanvas";
import AppBar from "@/components/nav/AppBar";
import { Button } from "@/components/ui/button";
import { PresenceProvider } from "@/components/providers/presence-context";

/**
 * Presence strategy:
 * - Mark online on interaction and on mount.
 * - Heartbeat every 60s to bump last_seen.
 * - After 5 minutes of no interaction, mark away.
 * - After 10 minutes of no interaction, mark offline (and remove from map 10m after that).
 * - On pagehide/beforeunload, mark offline (sendBeacon or direct upsert).
 * Notes:
 * - Requires RLS policy to allow a user to upsert their own row in `user_presence`.
 */
const IDLE_MS = 5 * 60 * 1000; // inactivity -> away (5m)
const OFFLINE_MS = 10 * 60 * 1000; // inactivity -> offline (10m)
const HEARTBEAT_MS = 60_000; // periodic heartbeat
const MIN_WRITE_MS = 12_000; // throttle presence writes
const SCROLL_FADE_THRESHOLD = 1;

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isMapPage = pathname === "/app";
  const hideAppBar = pathname?.startsWith("/app/messages/");

  const [locationStatus, setLocationStatus] = useState<
    "checking" | "granted" | "prompt" | "denied"
  >("checking");
  const [locationMessage, setLocationMessage] = useState<string | null>(null);

  const supabase = useRef(createClient()).current;

  const userIdRef = useRef<string | null>(null);
  const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const heartbeatRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const offlineTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const visibilityAwayRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastWriteAtRef = useRef(0);
  const lastSentStatusRef = useRef<"online" | "away" | "offline" | null>(null);
  const isMountedRef = useRef(true);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const [isScrolled, setIsScrolled] = useState(false);
  const coordsRef = useRef<{ lat: number; lng: number } | null>(null);
  const locationWatcherRef = useRef<number | null>(null);
  const locationPushRef = useRef<ReturnType<typeof setInterval> | null>(null);

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
        // Write via server API (service key), avoid REST CORS from browser
        const res = await fetch("/api/presence", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            user_id: userId,
            status,
            lat: coordsRef.current?.lat,
            lng: coordsRef.current?.lng,
          }),
          // keepalive helps during rapid navigations (not for beforeunload)
          keepalive: true,
        });
        if (!res.ok) {
          // eslint-disable-next-line no-console
          console.warn(
            "[presence] api/presence failed",
            res.status,
            await res.text()
          );
        }
      } catch (e) {
        // eslint-disable-next-line no-console
        console.warn("[presence] upsertPresence exception", e);
      }
    },
    [supabase]
  );

  const setOnline = useCallback(() => {
    if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    idleTimerRef.current = setTimeout(() => setAway(), IDLE_MS);
    if (offlineTimerRef.current) clearTimeout(offlineTimerRef.current);
    offlineTimerRef.current = setTimeout(
      () => void upsertPresence("offline"),
      OFFLINE_MS
    );
    void upsertPresence("online");
  }, [upsertPresence]);

  const setAway = useCallback(() => {
    if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    idleTimerRef.current = null;
    if (offlineTimerRef.current) clearTimeout(offlineTimerRef.current);
    offlineTimerRef.current = setTimeout(
      () => void upsertPresence("offline"),
      OFFLINE_MS
    );
    void upsertPresence("away");
  }, [upsertPresence]);

  const setOffline = useCallback(async () => {
    const userId = userIdRef.current;
    if (!userId) return;
    try {
      const payload = JSON.stringify({ user_id: userId, status: "offline" });
      let sent = false;
      if (
        typeof navigator !== "undefined" &&
        typeof navigator.sendBeacon === "function"
      ) {
        const blob = new Blob([payload], { type: "application/json" });
        sent = navigator.sendBeacon("/api/presence", blob);
      }
      if (!sent) {
        // Fallback if sendBeacon is unavailable
        void fetch("/api/presence", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: payload,
          keepalive: true,
        });
      }
    } catch (e) {
      // eslint-disable-next-line no-console
      console.warn("[presence] setOffline exception", e);
    }
  }, [supabase]);

  // --- initialize presence + listeners ---
  useEffect(() => {
    let unsubAuth: (() => void) | null = null;

    const init = async () => {
      // load current user
      const { data } = await supabase.auth.getUser();
      userIdRef.current = data.user?.id ?? null;
      // eslint-disable-next-line no-console
      console.log("[presence] current user", { userId: userIdRef.current });

      // subscribe to auth changes too
      const auth = supabase.auth.onAuthStateChange((_evt, session) => {
        userIdRef.current = session?.user?.id ?? null;
        // eslint-disable-next-line no-console
        console.log("[presence] auth change", { userId: userIdRef.current });
        if (userIdRef.current) setOnline();
      });
      unsubAuth = () => auth.data.subscription.unsubscribe();

      // Interactions set online and restart idle timer
      const onInteract = () => setOnline();
      const onVisibility = () => {
        if (visibilityAwayRef.current) {
          clearTimeout(visibilityAwayRef.current);
          visibilityAwayRef.current = null;
        }
        if (document.hidden) {
          visibilityAwayRef.current = setTimeout(() => {
            setAway();
          }, 2 * 60 * 1000); // 2 minute grace when tab/app hidden
        } else {
          setOnline();
        }
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
      if (offlineTimerRef.current) clearTimeout(offlineTimerRef.current);
      if (visibilityAwayRef.current) clearTimeout(visibilityAwayRef.current);
      if (heartbeatRef.current) clearInterval(heartbeatRef.current);
      if (unsubAuth) unsubAuth();

      // best-effort mark offline
      void setOffline();
    };
  }, [setOnline, setAway, setOffline, upsertPresence, supabase]);

  // location watcher and periodic coord push
  useEffect(() => {
    if (locationStatus !== "granted" || typeof navigator === "undefined")
      return;

    if (navigator.geolocation) {
      locationWatcherRef.current = navigator.geolocation.watchPosition(
        (pos) => {
          const { latitude, longitude } = pos.coords;
          if (Number.isFinite(latitude) && Number.isFinite(longitude)) {
            coordsRef.current = { lat: latitude, lng: longitude };
            const status = lastSentStatusRef.current || "online";
            void upsertPresence(status);
          }
        },
        () => {},
        { enableHighAccuracy: true, maximumAge: 30_000, timeout: 15_000 }
      );
    }

    locationPushRef.current = setInterval(() => {
      const status = lastSentStatusRef.current || "online";
      void upsertPresence(status);
    }, 120_000);

    return () => {
      if (locationPushRef.current) clearInterval(locationPushRef.current);
      locationPushRef.current = null;
      if (
        locationWatcherRef.current != null &&
        navigator.geolocation?.clearWatch
      ) {
        navigator.geolocation.clearWatch(locationWatcherRef.current);
      }
      locationWatcherRef.current = null;
    };
  }, [locationStatus, upsertPresence]);

  // --- request location before rendering ---
  useEffect(() => {
    let active = true;
    const init = async () => {
      if (typeof navigator === "undefined" || !navigator.geolocation) {
        if (active) {
          setLocationStatus("denied");
          setLocationMessage("Location is not available on this device.");
        }
        return;
      }

      const setFromPermission = (state: PermissionState) => {
        if (!active) return;
        if (state === "granted") setLocationStatus("granted");
        else setLocationStatus("prompt");
      };

      try {
        if ("permissions" in navigator && navigator.permissions?.query) {
          const perm = await navigator.permissions.query({
            name: "geolocation",
          });
          setFromPermission(perm.state);
          perm.onchange = () => setFromPermission(perm.state);
          return;
        }
      } catch {
        // fall through to prompt
      }

      setLocationStatus("prompt");
    };

    void init();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    const target = scrollRef.current;
    const handler = () => {
      const scrolled = target
        ? target.scrollTop > SCROLL_FADE_THRESHOLD
        : window.scrollY > SCROLL_FADE_THRESHOLD;
      setIsScrolled(scrolled);
    };
    handler();
    if (target) {
      target.addEventListener("scroll", handler, { passive: true });
      return () => target.removeEventListener("scroll", handler);
    }
    window.addEventListener("scroll", handler, { passive: true });
    return () => window.removeEventListener("scroll", handler);
  }, []);

  const requestLocationAccess = useCallback(async () => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setLocationStatus("denied");
      setLocationMessage("Location is not available on this device.");
      return;
    }
    setLocationStatus("checking");
    setLocationMessage(null);
    navigator.geolocation.getCurrentPosition(
      () => setLocationStatus("granted"),
      (err) => {
        setLocationStatus("denied");
        setLocationMessage(
          err?.message || "Location was denied. Please enable it to continue."
        );
      },
      { enableHighAccuracy: true, timeout: 10_000, maximumAge: 0 }
    );
  }, []);

  if (locationStatus !== "granted") {
    return (
      <div className="flex min-h-svh flex-col items-center justify-center gap-4 bg-background px-6 text-center text-foreground">
        <div className="space-y-2">
          <h1 className="text-xl font-semibold">Enable location to continue</h1>
          <p className="text-muted-foreground text-sm">
            We use your location to center the map and show nearby stations.
          </p>
          {locationMessage ? (
            <p className="text-destructive text-sm">{locationMessage}</p>
          ) : null}
        </div>
        <Button size="lg" onClick={() => void requestLocationAccess()}>
          Allow location
        </Button>
        {locationStatus === "checking" ? (
          <p className="text-muted-foreground text-xs">Requesting location…</p>
        ) : null}
      </div>
    );
  }

  // --- existing UI shell (map + app bar + content) ---
  const appBarHeight = hideAppBar ? 0 : 72;
  return (
    <PresenceProvider>
      <div className="relative h-svh">
        <div className="fixed inset-0 z-0">
          <MapCanvas />
        </div>
        <div
          className={`pointer-events-none fixed inset-x-0 top-0 z-10 h-24 bg-linear-to-b from-background/90 to-transparent transition-opacity duration-300 ${
            isScrolled ? "opacity-100" : "opacity-0"
          }`}
        />

        <main
          className={`relative flex h-full flex-col overflow-hidden ${
            isMapPage ? "bg-transparent pointer-events-none" : "bg-background"
          }`}
          style={{
            paddingTop: "0px",
            paddingBottom: "0px",
          }}
        >
          <div
            className={`flex-1 min-h-0 overflow-auto ${
              isMapPage ? "pointer-events-none" : ""
            }`}
            ref={scrollRef}
          >
            {children}
          </div>
        </main>

        {!hideAppBar && <AppBar />}
      </div>
    </PresenceProvider>
  );
}
