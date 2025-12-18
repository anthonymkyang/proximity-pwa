"use client";

import { useEffect, useMemo, useState, useRef, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/utils/supabase/client";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/status/Badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import getAvatarPublicUrl from "@/lib/profiles/getAvatarProxyUrl";
import { ImageIcon } from "lucide-react";
import {
  Ruler,
  Weight,
  Heart,
  UserRound,
  MoveRight,
  Globe2,
  Smile,
  Gauge,
  Scissors,
  ChevronRight,
  Sparkles,
  ScrollText,
  Zap,
  Check,
  ShieldCheck,
  Pill,
  CalendarClock,
  Shield,
  Flame,
  Hand,
  Droplet,
} from "lucide-react";

import TopBar from "@/components/nav/TopBar";
import BackButton from "@/components/ui/back-button";
import { MoreVertical } from "lucide-react";
import Image from "next/image";

import {
  Item,
  ItemMedia,
  ItemContent,
  ItemTitle,
  ItemDescription,
} from "@/components/ui/item";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
  DrawerClose,
} from "@/components/ui/drawer";

// ---------- Types ----------
type SaferSex = {
  // keep this flexible; we'll only read what exists
  status?: string | null;
  on_prep?: boolean | null;
  on_treatment?: boolean | null;
  condoms?: boolean | null;
  last_tested?: string | null; // ISO date
  last_test_date?: string | null; // some schemas use this
  notes?: string | null;
};

interface Profile {
  id: string;
  name: string | null;
  username: string | null;
  profile_title: string | null;
  bio: string | null;
  avatar_url: string | null;
  updated_at: string | null;
  date_of_birth?: string | null;

  nationalities: string[] | null; // strings already human-readable
  languages: string[] | null; // array of UUIDs referencing languages table

  ethnicity_id: string | null;
  body_type_id: string | null;
  position_id: string | null;
  attitude_id: string | null;
  sexuality_id: string | null;
  dick_size_id: string | null;
  dick_girth_id: string | null;
  dick_cut_status_id: string | null;

  height_cm: string | number | null;
  weight_kg: string | number | null;
  height_input_unit: string | null; // e.g. "cm"
  weight_input_unit: string | null; // e.g. "kg"

  dick_length_cm: string | number | null; // value, regardless of named _cm
  dick_length_input_unit: string | null; // e.g. "in" or "cm"
  dick_size_label: string | null; // fallback label
  dick_cut: string | null;
  dick_show: boolean | null; // gate to show actual length

  // Joined references (when available via select)
  body_type?: { label: string | null } | null;
  position?: { label: string | null } | null;
  sexuality?: { label: string | null } | null;
}

const pickLabel = (row: any) =>
  row?.label ?? row?.name ?? row?.title ?? row?.value ?? null;

export default function ProfilePage() {
  // ---- Reactions (long-press) ----
  type ReactionType = "fire" | "heart" | "slap" | "lick";

  const REACTIONS: { key: ReactionType; label: string; Icon: any }[] = [
    { key: "fire", label: "Fire", Icon: Flame },
    { key: "heart", label: "Heart", Icon: Heart },
    { key: "slap", label: "Slap", Icon: Hand },
    { key: "lick", label: "Lick", Icon: Droplet },
  ];

  const [reactionMenu, setReactionMenu] = useState<{
    open: boolean;
    x: number;
    y: number;
    target: null | { toUserId: string; context?: string };
  }>({ open: false, x: 0, y: 0, target: null });

  const longPressTimerRef = useRef<number | null>(null);
  const reactionBtnRef = useRef<HTMLButtonElement | null>(null);

  const clearLongPressTimer = () => {
    if (longPressTimerRef.current != null) {
      window.clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  };

  const beginLongPress = useCallback(
    (e: React.PointerEvent, target: { toUserId: string; context?: string }) => {
      clearLongPressTimer();
      const startX = e.clientX;
      const startY = e.clientY;
      longPressTimerRef.current = window.setTimeout(() => {
        setReactionMenu({
          open: true,
          x: startX,
          y: startY,
          target,
        });
      }, 450);
    },
    []
  );

  const params = useParams();
  const routeId = Array.isArray((params as any).id)
    ? (params as any).id[0]
    : (params as any).id ?? null;

  const beginLongPressFromIcon = useCallback(
    (e: React.PointerEvent) => {
      clearLongPressTimer();
      const el = e.currentTarget as HTMLElement;
      const rect = el.getBoundingClientRect();
      // Anchor the menu to the LEFT of the icon, vertically centered on the icon.
      longPressTimerRef.current = window.setTimeout(() => {
        setReactionMenu({
          open: true,
          x: rect.left - 8, // a small gap from the icon
          y: rect.top + rect.height / 2,
          target: { toUserId: String(routeId), context: "profile:react" },
        });
      }, 450);
    },
    [routeId]
  );

  const cancelLongPress = useCallback(() => {
    clearLongPressTimer();
  }, []);

  const sendReaction = useCallback(
    async (type: ReactionType) => {
      const t = reactionMenu.target;
      if (!t?.toUserId) return;
      try {
        await fetch("/api/reactions/send", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            to_user_id: t.toUserId,
            type,
            context: t.context ?? null,
          }),
        });
      } catch {
        // ignore
      } finally {
        setReactionMenu({ open: false, x: 0, y: 0, target: null });
      }
    },
    [reactionMenu.target]
  );

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [mainPhotoUrl, setMainPhotoUrl] = useState<string | null>(null);
  const [mainLoading, setMainLoading] = useState<boolean>(true);
  const [heroLoaded, setHeroLoaded] = useState(false);
  // --- Realtime presence: show online/away/offline indicator driven by user_presence table ---
  // Possible status: "online", "away", "offline" (default: "offline").
  const [isOnline, setIsOnline] = useState<"online" | "away" | "offline">(
    "offline"
  );

  // --- Distance (km) to this user ---
  const [currentPos, setCurrentPos] = useState<{
    lat: number;
    lng: number;
  } | null>(null);
  const [targetPos, setTargetPos] = useState<{
    lat: number;
    lng: number;
  } | null>(null);
  const [distanceKm, setDistanceKm] = useState<number | null>(null);

  // --- Current authenticated user id (to publish our own location) ---
  const [myUserId, setMyUserId] = useState<string | null>(null);

  // Debounce timer for presence upserts so we don't spam on every GPS tick
  const presenceTimerRef = useRef<number | null>(null);

  const [geoPermission, setGeoPermission] = useState<
    "granted" | "denied" | "prompt" | "unknown"
  >("unknown");

  const watchIdRef = useRef<number | null>(null);
  const requestTimerRef = useRef<number | null>(null);

  type GeoState = "idle" | "requesting" | "watching" | "error";
  const [geoState, setGeoState] = useState<GeoState>("idle");
  const [geoError, setGeoError] = useState<string | null>(null);

  const requestLocationOnce = () => {
    if (typeof navigator === "undefined" || !("geolocation" in navigator)) {
      setGeoError("Geolocation not available");
      setGeoState("error");
      return;
    }
    setGeoError(null);
    setGeoState("requesting");

    // Safety timeout so we never get stuck on "Fetching location…"
    if (requestTimerRef.current != null) {
      clearTimeout(requestTimerRef.current);
    }
    requestTimerRef.current = window.setTimeout(() => {
      setGeoState("error");
      setGeoError("Timed out getting location");
      setTimeout(() => setGeoState("idle"), 0);
    }, 15000);

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        if (requestTimerRef.current != null) {
          clearTimeout(requestTimerRef.current);
          requestTimerRef.current = null;
        }
        const { latitude, longitude } = pos.coords;
        setCurrentPos({ lat: latitude, lng: longitude });
        publishPresence(latitude, longitude);
        setGeoPermission("granted");
        setGeoState("watching");
        setGeoError(null);
        startWatching();
      },
      (err) => {
        if (requestTimerRef.current != null) {
          clearTimeout(requestTimerRef.current);
          requestTimerRef.current = null;
        }
        setGeoState("error");
        setTimeout(() => setGeoState("idle"), 0);
        setGeoError(
          err?.code === 1
            ? "Location permission denied"
            : err?.message || "Failed to get location"
        );
        // Reflect permission if known
        if (err?.code === 1) setGeoPermission("denied");
      },
      { enableHighAccuracy: true, maximumAge: 60_000, timeout: 12000 }
    );
  };

  const startWatching = () => {
    if (!("geolocation" in navigator)) return;
    // Avoid duplicate watchers
    if (watchIdRef.current != null) return;
    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        setCurrentPos({ lat: latitude, lng: longitude });
        publishPresence(latitude, longitude);
        setGeoState("watching");
      },
      (err) => {
        setGeoState("error");
        setGeoError(err?.message || "Location watch failed");
        setTimeout(() => setGeoState("idle"), 0);
      },
      { enableHighAccuracy: true, maximumAge: 60_000, timeout: 15000 }
    );
  };
  useEffect(() => {
    const onVis = () => {
      if (document.visibilityState === "visible" && geoState === "watching") {
        // ensure watch is active
        startWatching();
      } else if (document.visibilityState !== "visible") {
        stopWatching();
      }
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, [geoState]);

  const stopWatching = () => {
    if (watchIdRef.current != null && navigator?.geolocation?.clearWatch) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
  };

  // Publish our own presence location (debounced)
  const publishPresence = (lat: number, lng: number) => {
    if (!myUserId) return;
    // Debounce rapid GPS ticks
    if (presenceTimerRef.current != null) {
      window.clearTimeout(presenceTimerRef.current);
    }
    presenceTimerRef.current = window.setTimeout(async () => {
      try {
        // Write via server API (service key), avoid REST CORS from browser
        const res = await fetch("/api/presence", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            user_id: myUserId,
            status: "online",
            lat,
            lng,
          }),
          keepalive: true,
        });
        if (!res.ok) {
          // eslint-disable-next-line no-console
          console.warn(
            "[profile] /api/presence failed",
            res.status,
            await res.text()
          );
        }
      } catch (e) {
        // eslint-disable-next-line no-console
        console.warn("[profile] presence write error", e);
      } finally {
        presenceTimerRef.current = null;
      }
    }, 750);
  };

  const haversineKm = (
    a: { lat: number; lng: number },
    b: { lat: number; lng: number }
  ) => {
    const toRad = (v: number) => (v * Math.PI) / 180;
    const R = 6371; // km
    const dLat = toRad(b.lat - a.lat);
    const dLng = toRad(b.lng - a.lng);
    const lat1 = toRad(a.lat);
    const lat2 = toRad(b.lat);
    const h =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
    return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
  };

  // Load my auth user id (client-side)
  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => {
      setMyUserId(data?.user?.id ?? null);
    });
  }, []);

  // Subscribe to user_presence realtime updates for this user
  useEffect(() => {
    if (!routeId) return;
    const supabase = createClient();
    let sub: ReturnType<typeof supabase.channel> | null = null;
    let presenceSub: ReturnType<typeof supabase.channel> | null = null;
    let mounted = true;
    let unsub: (() => void) | null = null;

    // Helper to update status from row
    const updateStatus = (row: any) => {
      if (!row) {
        if (mounted) setIsOnline("offline");
        return;
      }
      const status = typeof row.status === "string" ? row.status : "";
      if (status === "online" || status === "away") {
        if (mounted) setIsOnline(status);
      } else {
        if (mounted) setIsOnline("offline");
      }
    };

    // Initial fetch
    supabase
      .from("user_presence")
      .select("status, lat, lng")
      .eq("user_id", routeId)
      .maybeSingle()
      .then(({ data }) => {
        updateStatus(data);
        if (data?.lat != null && data?.lng != null) {
          setTargetPos({ lat: Number(data.lat), lng: Number(data.lng) });
        }
      });

    // Subscribe to changes for this user
    const channel = supabase.channel("realtime:user_presence:" + routeId).on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "user_presence",
        filter: `user_id=eq.${routeId}`,
      },
      (payload: any) => {
        if (payload.eventType === "DELETE") {
          updateStatus(null);
        } else if (payload.new) {
          updateStatus(payload.new);
          if (payload?.new?.lat != null && payload?.new?.lng != null) {
            setTargetPos({
              lat: Number(payload.new.lat),
              lng: Number(payload.new.lng),
            });
          }
        }
      }
    );
    channel.subscribe();

    unsub = () => {
      channel.unsubscribe();
    };

    return () => {
      mounted = false;
      if (unsub) unsub();
    };
  }, [routeId]);

  // If permission is already granted, immediately request once and start watch on mount
  useEffect(() => {
    if (geoPermission === "granted" && geoState === "idle") {
      requestLocationOnce();
    }
    // Cleanup on unmount
    return () => {
      stopWatching();
      if (presenceTimerRef.current != null) {
        clearTimeout(presenceTimerRef.current);
        presenceTimerRef.current = null;
      }
      if (requestTimerRef.current != null) {
        clearTimeout(requestTimerRef.current);
        requestTimerRef.current = null;
      }
      if (longPressTimerRef.current != null) {
        clearTimeout(longPressTimerRef.current);
        longPressTimerRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [geoPermission]);

  useEffect(() => {
    if (currentPos && targetPos) {
      setDistanceKm(haversineKm(currentPos, targetPos));
    } else {
      setDistanceKm(null);
    }
  }, [currentPos, targetPos]);

  // -- Fix mobile viewport height units on iOS/Android toolbars
  useEffect(() => {
    const setVH = () => {
      const vh = window.innerHeight * 0.01;
      document.documentElement.style.setProperty("--app-vh", `${vh}px`);
    };
    setVH();
    window.addEventListener("resize", setVH);
    window.addEventListener("orientationchange", setVH);
    return () => {
      window.removeEventListener("resize", setVH);
      window.removeEventListener("orientationchange", setVH);
    };
  }, []);

  useEffect(() => {
    let status: PermissionStatus | null = null;
    if (typeof navigator !== "undefined" && (navigator as any).permissions) {
      (navigator as any).permissions
        .query({ name: "geolocation" as PermissionName })
        .then((ps: PermissionStatus) => {
          status = ps;
          setGeoPermission(ps.state as any);
          ps.onchange = () => setGeoPermission(ps.state as any);
        })
        .catch(() => setGeoPermission("prompt"));
    }
    return () => {
      if (status) status.onchange = null;
    };
  }, []);

  // Lookup labels
  const [lookups, setLookups] = useState<{
    ethnicity?: string | null;
    body_type?: string | null;
    position?: string | null;
    attitude?: string | null;
    sexuality?: string | null;
    dick_size?: string | null;
    dick_girth?: string | null;
    dick_cut_status?: string | null;
    languages?: string[];
    age: number | null;
  }>({ age: null });

  const [saferSex, setSaferSex] = useState<SaferSex | null>(null);

  // Compute if any safer sex fields are present
  const hasSaferSexContent = useMemo(() => {
    if (!saferSex) return false;
    const fields = [
      "status",
      "on_prep",
      "on_treatment",
      "condoms",
      "last_tested",
      "last_test_date",
      "notes",
    ] as const;
    return fields.some((k) => {
      const v = (saferSex as any)?.[k];
      if (v == null) return false;
      if (typeof v === "string") return v.trim().length > 0;
      return true; // booleans or other truthy values
    });
  }, [saferSex]);

  // --------- Load base profile ---------
  useEffect(() => {
    const run = async () => {
      if (!routeId) {
        setError("Missing profile id");
        setLoading(false);
        return;
      }
      try {
        const supabase = createClient();
        const { data, error } = await supabase
          .from("profiles")
          .select(
            [
              "id",
              "name",
              "username",
              "profile_title",
              "bio",
              "avatar_url",
              "updated_at",
              "date_of_birth",
              "nationalities",
              "languages",
              "ethnicity_id",
              "body_type_id",
              "position_id",
              "attitude_id",
              "sexuality_id",
              "dick_size_id",
              "dick_girth_id",
              "dick_cut_status_id",
              "height_cm",
              "weight_kg",
              "height_input_unit",
              "weight_input_unit",
              "dick_length_cm",
              "dick_length_input_unit",
              "dick_size_label",
              "dick_cut",
              "dick_show",
              "body_type:body_types(label)",
              "position:positions(label)",
              "sexuality:sexualities(label)",
            ].join(",")
          )
          .eq("id", routeId)
          .maybeSingle();
        if (error) throw error;
        if (!data) {
          setError("Profile not found");
          setProfile(null);
        } else {
          setProfile(data as unknown as Profile);
          setError(null);
        }
      } catch (e: any) {
        setError(e?.message || "Failed to load profile");
      } finally {
        setLoading(false);
      }
    };
    run();
  }, [routeId]);
  // --------- Utility: Get age from date_of_birth ---------
  const getAgeFromISODate = (iso: string | null | undefined): number | null => {
    if (!iso) return null;
    const [y, m, d] = iso.split("-").map((v) => parseInt(v, 10));
    if (!y || !m || !d) return null;
    const today = new Date();
    let age = today.getFullYear() - y;
    const monthDiff = today.getMonth() + 1 - m;
    const dayDiff = today.getDate() - d;
    if (monthDiff < 0 || (monthDiff === 0 && dayDiff < 0)) age--;
    return age >= 0 && Number.isFinite(age) ? age : null;
  };

  // --------- Load main public profile image ---------
  useEffect(() => {
    let cancelled = false;

    const loadMainPhoto = async () => {
      if (!routeId) return;
      setMainLoading(true);
      try {
        const supabase = createClient();

        // Prefer an explicit main, otherwise the lowest position
        const { data: rows, error: qErr } = await supabase
          .from("profile_photos_public")
          .select("object_key, is_main, position")
          .eq("user_id", routeId as string)
          .order("is_main", { ascending: false })
          .order("position", { ascending: true })
          .limit(1);

        if (qErr) throw qErr;

        const row = rows?.[0];
        if (row?.object_key) {
          // Always use a signed URL to avoid "flashing" broken image during public fetch
          const { data: signed, error: sErr } = await supabase.storage
            .from("profile_public")
            .createSignedUrl(row.object_key, 60 * 60); // 1 hour

          if (sErr) throw sErr;
          const url = signed?.signedUrl || null;
          if (!cancelled) {
            setHeroLoaded(false);
            setMainPhotoUrl(url);
          }
        } else {
          if (!cancelled) setMainPhotoUrl(null);
        }
      } catch {
        if (!cancelled) setMainPhotoUrl(null);
      } finally {
        if (!cancelled) setMainLoading(false);
      }
    };

    loadMainPhoto();
    return () => {
      cancelled = true;
    };
  }, [routeId]);

  // --------- Load safer sex info for this user ---------
  useEffect(() => {
    const run = async () => {
      if (!routeId) return;
      try {
        const supabase = createClient();
        // Be permissive with column names; select everything we might render.
        const { data, error } = await supabase
          .from("safer_sex")
          .select(
            [
              "status",
              "on_prep",
              "on_treatment",
              "condoms",
              "last_tested",
              "last_test_date",
              "notes",
              "user_id",
            ].join(",")
          )
          .eq("user_id", routeId as string)
          .maybeSingle();
        if (!error && data) {
          setSaferSex(data as unknown as SaferSex);
        } else {
          setSaferSex(null);
        }
      } catch {
        setSaferSex(null);
      }
    };
    run();
  }, [routeId]);

  // --------- Resolve lookups once we have profile ---------
  useEffect(() => {
    const loadLookups = async () => {
      if (!profile) return;
      const supabase = createClient();

      const next: any = {};
      // Prefer joined labels if present (avoids extra queries)
      if ((profile as any)?.body_type?.label != null) {
        next.body_type = (profile as any).body_type.label;
      }
      if ((profile as any)?.position?.label != null) {
        next.position = (profile as any).position.label;
      }
      if ((profile as any)?.sexuality?.label != null) {
        next.sexuality = (profile as any).sexuality.label;
      }

      const fetchSingle = async (
        table: string,
        id: string | null,
        key: string
      ) => {
        if (!id) return;
        const { data, error } = await supabase
          .from(table)
          .select("id, name, label, title, value")
          .eq("id", id)
          .maybeSingle();
        if (!error && data) next[key] = pickLabel(data);
      };

      await Promise.all([
        fetchSingle("ethnicities", profile.ethnicity_id, "ethnicity"),
        next.body_type == null
          ? fetchSingle("body_types", profile.body_type_id, "body_type")
          : Promise.resolve(),
        next.position == null
          ? fetchSingle("positions", profile.position_id, "position")
          : Promise.resolve(),
        fetchSingle("attitudes", profile.attitude_id, "attitude"),
        next.sexuality == null
          ? fetchSingle("sexualities", profile.sexuality_id, "sexuality")
          : Promise.resolve(),
        fetchSingle("dick_sizes", profile.dick_size_id, "dick_size"),
        fetchSingle("dick_girths", profile.dick_girth_id, "dick_girth"),
        fetchSingle(
          "dick_cut_statuses",
          profile.dick_cut_status_id,
          "dick_cut_status"
        ),
      ]);

      // Languages (array of IDs)
      if (Array.isArray(profile.languages) && profile.languages.length) {
        const { data, error } = await supabase
          .from("languages")
          .select("id, name, label")
          .in("id", profile.languages as string[]);
        if (!error && data) {
          next.languages = (data as any[]).map(pickLabel).filter(Boolean);
        }
      }

      setLookups(next);
    };

    loadLookups();
  }, [profile]);

  // --------- Derived display values ---------
  const avatarUrl = useMemo(
    () => getAvatarPublicUrl(profile?.avatar_url) || undefined,
    [profile?.avatar_url]
  );

  const heightDisplay = useMemo(() => {
    if (!profile?.height_cm) return null;
    const val = String(profile.height_cm);
    const unit = profile.height_input_unit || "cm";
    return `${val}${unit}`;
  }, [profile?.height_cm, profile?.height_input_unit]);

  const weightDisplay = useMemo(() => {
    if (!profile?.weight_kg) return null;
    const val = String(profile.weight_kg);
    const unit = profile.weight_input_unit || "kg";
    return `${val}${unit}`;
  }, [profile?.weight_kg, profile?.weight_input_unit]);

  const dickDisplay = useMemo(() => {
    if (!profile) return null;
    const showActual = !!profile.dick_show && profile.dick_length_cm;
    if (showActual) {
      const val = String(profile.dick_length_cm);
      const unit = profile.dick_length_input_unit || "cm";
      return `${val}${unit}`;
    }
    return profile.dick_size_label || lookups.dick_size || null;
  }, [profile, lookups.dick_size]);

  const updatedDisplay = useMemo(() => {
    if (!profile?.updated_at) return null;
    try {
      const d = new Date(profile.updated_at);
      return d.toLocaleString([], {
        hour: "2-digit",
        minute: "2-digit",
        day: "2-digit",
        month: "short",
      });
    } catch {
      return profile.updated_at;
    }
  }, [profile?.updated_at]);

  const dickCutDisplay = useMemo(() => {
    if (lookups.dick_cut_status) return lookups.dick_cut_status;
    if (profile?.dick_cut == null) return null;
    const val = String(profile.dick_cut).toLowerCase();
    if (val === "true" || val === "yes" || val === "cut") return "Cut";
    if (val === "false" || val === "no" || val === "uncut") return "Uncut";
    return profile?.dick_cut;
  }, [lookups.dick_cut_status, profile?.dick_cut]);

  // --------- Overlay hero text helpers ---------
  const ageDisplay = useMemo(() => {
    if (!profile) return null;
    // Prefer DOB-derived age
    const byDob = getAgeFromISODate((profile as any).date_of_birth);
    if (byDob != null) return String(byDob);
    // Fallback if the profile row already contains an age number
    const value = (profile as any).age;
    if (typeof value === "number" && !isNaN(value)) return String(value);
    return null;
  }, [profile]);

  const heroTitle = useMemo(
    () =>
      profile?.profile_title || profile?.name || profile?.username || "User",
    [profile?.profile_title, profile?.name, profile?.username]
  );

  const heroSubline = useMemo(() => {
    const parts: string[] = [];
    if (ageDisplay) parts.push(ageDisplay);
    if (lookups.sexuality) parts.push(lookups.sexuality);
    if (lookups.position) parts.push(lookups.position);
    return parts.join(" • ");
  }, [ageDisplay, lookups.sexuality, lookups.position]);

  const distanceDisplay = useMemo(() => {
    if (distanceKm == null) return "—";
    const km = distanceKm;
    const m = Math.round(km * 1000);

    // Format: compact KM then meters with thousands separators
    const kmStr =
      km >= 100 ? km.toFixed(0) : km >= 10 ? km.toFixed(1) : km.toFixed(2);
    const mStr = new Intl.NumberFormat().format(m);

    return `${kmStr} km · ${mStr} m`;
  }, [distanceKm]);

  // --- Derived geo state flags for UI ---
  const isRequesting = geoState === "requesting";
  const isWatching = geoState === "watching";
  const hasFix = !!currentPos;

  // Dummy counts for "I'm into" section
  const intoCounts = useMemo(
    () => ({ type: 3, action: 1, kinks: 5, scenarios: 2 }),
    []
  );
  const intoTotal = useMemo(
    () => Object.values(intoCounts).reduce((sum, n) => sum + n, 0),
    [intoCounts]
  );

  const intoTitles: Record<"type" | "action" | "kinks" | "scenarios", string> =
    {
      type: "My type",
      action: "Action",
      kinks: "Kinks & fetishes",
      scenarios: "Scenarios",
    };

  // Dummy interest lists for each category (replace with real data later)
  const intoInterests: Record<
    "type" | "action" | "kinks" | "scenarios",
    string[]
  > = {
    type: [
      "Tall guys",
      "Beards",
      "Gym build",
      "Twinks",
      "Dads",
      "Bears",
      "Slim",
      "Masc",
      "Androgynous",
    ],
    action: [
      "Dates",
      "Cuddles",
      "Quick fun",
      "Friends first",
      "Sleepovers",
      "Outdoor",
      "Kissing",
      "Slow burn",
      "Casual",
    ],
    kinks: [
      "Roleplay",
      "Exhibition",
      "Toys",
      "Rimming",
      "Bondage",
      "Voyeur",
      "Massage",
      "Dirty talk",
      "Edging",
    ],
    scenarios: [
      "Spa day",
      "Camping",
      "Gym",
      "Beach",
      "Hotel",
      "Club",
      "After-work",
      "Road trip",
      "Sunday brunch",
    ],
  };

  const [openDrawer, setOpenDrawer] = useState<
    null | "type" | "action" | "kinks" | "scenarios"
  >(null);
  const [profileDrawerOpen, setProfileDrawerOpen] = useState(false);

  const currentCount = openDrawer ? (intoCounts as any)[openDrawer] ?? 0 : 0;
  const currentTitle = openDrawer ? intoTitles[openDrawer] : "";
  const currentInterests = openDrawer ? intoInterests[openDrawer] : [];
  const mutualSet = useMemo(() => {
    if (!openDrawer || !currentInterests?.length) return new Set<string>();
    const n = Math.max(0, Math.min(currentCount, currentInterests.length));
    // simple deterministic-ish shuffle based on routeId + openDrawer for stability within a render
    const seed = (String(routeId) + openDrawer)
      .split("")
      .reduce((s, c) => (s + c.charCodeAt(0)) % 2147483647, 1);
    const arr = [...currentInterests];
    // Fisher–Yates with seeded pseudo-random
    let m = arr.length;
    let k = seed;
    const rand = () => (k = (k * 48271) % 2147483647) / 2147483647;
    while (m) {
      const i = Math.floor(rand() * m--);
      [arr[m], arr[i]] = [arr[i], arr[m]];
    }
    return new Set(arr.slice(0, n));
  }, [openDrawer, currentInterests, currentCount, routeId]);

  return (
    <div className="min-h-dvh bg-background">
      <main className="pb-6">
        {/* Full-bleed main photo (fade-in, no layout swap) */}
        <section className="w-full">
          <div className="relative w-full h-[calc(100dvh-55px)]">
            {/* Neutral placeholder background; no icon to avoid flash */}
            <div className="absolute inset-0 bg-muted" />

            {mainPhotoUrl ? (
              <Image
                key={"hero-" + routeId}
                src={mainPhotoUrl}
                alt="Main profile photo"
                fill
                priority
                sizes="100vw"
                draggable={false}
                unoptimized
                placeholder="blur"
                blurDataURL="data:image/gif;base64,R0lGODlhAQABAAAAACw="
                onLoadingComplete={() => setHeroLoaded(true)}
                className={`object-cover transition-opacity duration-300 ${
                  heroLoaded ? "opacity-100" : "opacity-0"
                }`}
              />
            ) : null}

            {/* Top bar overlay */}
            <TopBar
              className="absolute top-0 left-0 right-0 z-30 bg-transparent px-4"
              leftContent={
                <BackButton
                  variant="ghost"
                  className="bg-background/60 supports-backdrop-filter:bg-background/50 backdrop-blur-md rounded-full ring-1 ring-border text-foreground hover:bg-background/60 hover:text-foreground"
                />
              }
              rightContent={
                <Button
                  aria-label="More options"
                  variant="ghost"
                  size="icon"
                  className="rounded-full bg-background/60 supports-backdrop-filter:bg-background/50 backdrop-blur-md ring-1 ring-border text-foreground hover:bg-background/60 hover:text-foreground"
                >
                  <MoreVertical className="h-6 w-6" />
                </Button>
              }
            />

            {/* Hero text overlay */}
            <div className="absolute left-4 bottom-4 z-40 text-white space-y-1">
              <div className="text-2xl font-semibold drop-shadow-md">
                {heroTitle}
              </div>
              {heroSubline ? (
                <div className="text-sm opacity-90 drop-shadow">
                  {heroSubline}
                </div>
              ) : null}
            </div>

            {/* Avatar overlay + Reaction trigger (moved up) */}
            <div className="absolute right-4 bottom-24 z-40 flex flex-col items-end gap-2">
              <button
                type="button"
                onClick={() => setProfileDrawerOpen(true)}
                className="relative block rounded-full focus:outline-none focus:ring-2 focus:ring-primary/50"
                aria-label="Open profile info"
              >
                <div className="relative">
                  <Avatar className="h-16 w-16 ring-2 ring-white shadow-2xl">
                    <AvatarImage
                      src={avatarUrl}
                      alt={
                        profile?.profile_title || profile?.username || "Avatar"
                      }
                    />
                    <AvatarFallback className="bg-muted text-muted-foreground">
                      {(
                        profile?.profile_title ||
                        profile?.name ||
                        profile?.username ||
                        "U"
                      )
                        .split(" ")
                        .map((s) => s[0])
                        .join("")
                        .slice(0, 2)
                        .toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <StatusBadge
                    status={isOnline}
                    size="sm"
                    className="absolute bottom-0.5 right-0.5"
                  />
                </div>
              </button>

              {/* Reaction trigger button (press & hold to open menu) */}
              <button
                ref={reactionBtnRef}
                type="button"
                aria-label="React"
                className="relative rounded-full bg-background/80 backdrop-blur p-2 shadow ring-1 ring-border hover:bg-background"
                onPointerDown={beginLongPressFromIcon}
                onPointerUp={cancelLongPress}
                onPointerCancel={cancelLongPress}
                onPointerLeave={cancelLongPress}
                onContextMenu={(e) => e.preventDefault()}
              >
                <Smile
                  className="h-5 w-5 text-foreground/70"
                  aria-hidden="true"
                />
              </button>
            </div>

            {/* Bottom gradient */}
            <div className="absolute inset-x-0 bottom-0 h-3/4 bg-linear-to-t from-background to-transparent pointer-events-none" />
          </div>
        </section>
        <div className="px-4 space-y-6 mt-4">
          {loading ? (
            <div className="flex items-center gap-4">
              <Skeleton className="h-16 w-16 rounded-full" />
              <div className="space-y-2 w-40">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-3 w-2/3" />
              </div>
            </div>
          ) : error ? (
            <p className="text-sm text-red-500">{error}</p>
          ) : !profile ? (
            <p className="text-sm text-muted-foreground">
              Profile unavailable.
            </p>
          ) : (
            <>
              {/* ABOUT section */}
              {profile?.bio ? (
                <section>
                  <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
                    About
                  </h3>
                  <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                    {profile.bio}
                  </p>
                </section>
              ) : null}

              {/* View on map pill */}
              <section>
                <div className="rounded-full bg-card p-2 pl-2.5 pr-2.5 shadow-sm flex items-center justify-between">
                  <Button
                    type="button"
                    size="sm"
                    className="rounded-full bg-foreground text-background hover:bg-foreground/90 px-4"
                    onClick={() => {
                      // TODO: navigate to map view with this user highlighted
                    }}
                  >
                    View on map
                  </Button>
                  {distanceKm != null && targetPos ? (
                    // NOTE: distance shows after both currentPos & targetPos are known; button re-enables after failures.
                    <div className="inline-flex items-center gap-1.5 px-3 py-1.5 text-primary font-semibold">
                      <span className="text-sm">{distanceDisplay}</span>
                      <ChevronRight className="h-4 w-4" aria-hidden="true" />
                    </div>
                  ) : (
                    <div className="inline-flex items-center gap-2">
                      {isRequesting ? (
                        <span className="text-sm text-muted-foreground">
                          Fetching location…
                        </span>
                      ) : isWatching && !hasFix ? (
                        <span className="text-sm text-muted-foreground">
                          Waiting for GPS…
                        </span>
                      ) : isWatching && hasFix && !targetPos ? (
                        <span className="text-sm text-muted-foreground">
                          Waiting for their location…
                        </span>
                      ) : geoPermission === "denied" ? (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="rounded-full px-3"
                          disabled
                          title="Location permission is blocked in your browser settings"
                        >
                          Location blocked
                        </Button>
                      ) : (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="rounded-full px-3"
                          onClick={requestLocationOnce}
                        >
                          Enable location
                        </Button>
                      )}
                      {geoError ? (
                        <span className="text-xs text-destructive">
                          {geoError}
                        </span>
                      ) : null}
                    </div>
                  )}
                </div>
              </section>
              {/* Details — Variant A: Cards Grid */}
              <>
                <Separator />
                <section>
                  <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-3">
                    Stats
                  </h3>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {heightDisplay ? (
                      <div className="rounded-lg p-3 bg-card/50 flex items-center justify-between">
                        <div>
                          <p className="text-xs text-muted-foreground">
                            Height
                          </p>
                          <p className="text-sm font-medium">{heightDisplay}</p>
                        </div>
                        <div className="rounded-full bg-muted/40 p-2">
                          <Ruler
                            className="h-5 w-5 text-muted-foreground"
                            aria-hidden="true"
                          />
                        </div>
                      </div>
                    ) : null}

                    {weightDisplay ? (
                      <div className="rounded-lg p-3 bg-card/50 flex items-center justify-between">
                        <div>
                          <p className="text-xs text-muted-foreground">
                            Weight
                          </p>
                          <p className="text-sm font-medium">{weightDisplay}</p>
                        </div>
                        <div className="rounded-full bg-muted/40 p-2">
                          <Weight
                            className="h-5 w-5 text-muted-foreground"
                            aria-hidden="true"
                          />
                        </div>
                      </div>
                    ) : null}

                    {lookups.body_type ? (
                      <div className="rounded-lg p-3 bg-card/50 flex items-center justify-between">
                        <div>
                          <p className="text-xs text-muted-foreground">
                            Body Type
                          </p>
                          <p className="text-sm font-medium">
                            {lookups.body_type}
                          </p>
                        </div>
                        <div className="rounded-full bg-muted/40 p-2">
                          <UserRound
                            className="h-5 w-5 text-muted-foreground"
                            aria-hidden="true"
                          />
                        </div>
                      </div>
                    ) : null}

                    {lookups.position ? (
                      <div className="rounded-lg p-3 bg-card/50 flex items-center justify-between">
                        <div>
                          <p className="text-xs text-muted-foreground">
                            Position
                          </p>
                          <p className="text-sm font-medium">
                            {lookups.position}
                          </p>
                        </div>
                        <div className="rounded-full bg-muted/40 p-2">
                          <MoveRight
                            className="h-5 w-5 text-muted-foreground"
                            aria-hidden="true"
                          />
                        </div>
                      </div>
                    ) : null}

                    {lookups.sexuality ? (
                      <div className="rounded-lg p-3 bg-card/50 flex items-center justify-between">
                        <div>
                          <p className="text-xs text-muted-foreground">
                            Sexuality
                          </p>
                          <p className="text-sm font-medium">
                            {lookups.sexuality}
                          </p>
                        </div>
                        <div className="rounded-full bg-muted/40 p-2">
                          <Heart
                            className="h-5 w-5 text-muted-foreground"
                            aria-hidden="true"
                          />
                        </div>
                      </div>
                    ) : null}

                    {lookups.ethnicity ? (
                      <div className="rounded-lg p-3 bg-card/50 flex items-center justify-between">
                        <div>
                          <p className="text-xs text-muted-foreground">
                            Ethnicity
                          </p>
                          <p className="text-sm font-medium">
                            {lookups.ethnicity}
                          </p>
                        </div>
                        <div className="rounded-full bg-muted/40 p-2">
                          <Globe2
                            className="h-5 w-5 text-muted-foreground"
                            aria-hidden="true"
                          />
                        </div>
                      </div>
                    ) : null}

                    {lookups.attitude ? (
                      <div className="rounded-lg p-3 bg-card/50 flex items-center justify-between">
                        <div>
                          <p className="text-xs text-muted-foreground">
                            Attitude
                          </p>
                          <p className="text-sm font-medium">
                            {lookups.attitude}
                          </p>
                        </div>
                        <div className="rounded-full bg-muted/40 p-2">
                          <Smile
                            className="h-5 w-5 text-muted-foreground"
                            aria-hidden="true"
                          />
                        </div>
                      </div>
                    ) : null}

                    {dickDisplay ? (
                      <div className="rounded-lg p-3 bg-card/50 flex items-center justify-between">
                        <div>
                          <p className="text-xs text-muted-foreground">Dick</p>
                          <p className="text-sm font-medium">{dickDisplay}</p>
                        </div>
                        <div className="rounded-full bg-muted/40 p-2">
                          <Ruler
                            className="h-5 w-5 text-muted-foreground"
                            aria-hidden="true"
                          />
                        </div>
                      </div>
                    ) : null}

                    {lookups.dick_girth ? (
                      <div className="rounded-lg p-3 bg-card/50 flex items-center justify-between">
                        <div>
                          <p className="text-xs text-muted-foreground">Girth</p>
                          <p className="text-sm font-medium">
                            {lookups.dick_girth}
                          </p>
                        </div>
                        <div className="rounded-full bg-muted/40 p-2">
                          <Gauge
                            className="h-5 w-5 text-muted-foreground"
                            aria-hidden="true"
                          />
                        </div>
                      </div>
                    ) : null}

                    {dickCutDisplay ? (
                      <div className="rounded-lg p-3 bg-card/50 flex items-center justify-between">
                        <div>
                          <p className="text-xs text-muted-foreground">
                            Cut status
                          </p>
                          <p className="text-sm font-medium">
                            {dickCutDisplay}
                          </p>
                        </div>
                        <div className="rounded-full bg-muted/40 p-2">
                          <Scissors
                            className="h-5 w-5 text-muted-foreground"
                            aria-hidden="true"
                          />
                        </div>
                      </div>
                    ) : null}
                  </div>
                </section>
                <Separator />
                {saferSex ? (
                  <section>
                    <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-3">
                      Safer sex
                    </h3>

                    {!hasSaferSexContent ? (
                      <p className="text-sm text-muted-foreground">
                        No safer sex information yet.
                      </p>
                    ) : (
                      <>
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                          {/* HIV/Status */}
                          {"status" in saferSex && saferSex?.status ? (
                            <div className="rounded-lg p-3 bg-card/50 flex items-center justify-between">
                              <div>
                                <p className="text-xs text-muted-foreground">
                                  Status
                                </p>
                                <p className="text-sm font-medium">
                                  {String(saferSex.status)}
                                </p>
                              </div>
                              <div className="rounded-full bg-muted/40 p-2">
                                <ShieldCheck
                                  className="h-5 w-5 text-muted-foreground"
                                  aria-hidden="true"
                                />
                              </div>
                            </div>
                          ) : null}

                          {/* On PrEP */}
                          {"on_prep" in saferSex &&
                          saferSex?.on_prep != null ? (
                            <div className="rounded-lg p-3 bg-card/50 flex items-center justify-between">
                              <div>
                                <p className="text-xs text-muted-foreground">
                                  On PrEP
                                </p>
                                <p className="text-sm font-medium">
                                  {saferSex.on_prep ? "Yes" : "No"}
                                </p>
                              </div>
                              <div className="rounded-full bg-muted/40 p-2">
                                <Pill
                                  className="h-5 w-5 text-muted-foreground"
                                  aria-hidden="true"
                                />
                              </div>
                            </div>
                          ) : null}

                          {/* On treatment (if present) */}
                          {"on_treatment" in saferSex &&
                          saferSex?.on_treatment != null ? (
                            <div className="rounded-lg p-3 bg-card/50 flex items-center justify-between">
                              <div>
                                <p className="text-xs text-muted-foreground">
                                  On treatment
                                </p>
                                <p className="text-sm font-medium">
                                  {saferSex.on_treatment ? "Yes" : "No"}
                                </p>
                              </div>
                              <div className="rounded-full bg-muted/40 p-2">
                                <Shield
                                  className="h-5 w-5 text-muted-foreground"
                                  aria-hidden="true"
                                />
                              </div>
                            </div>
                          ) : null}

                          {/* Condoms */}
                          {"condoms" in saferSex &&
                          saferSex?.condoms != null ? (
                            <div className="rounded-lg p-3 bg-card/50 flex items-center justify-between">
                              <div>
                                <p className="text-xs text-muted-foreground">
                                  Condoms
                                </p>
                                <p className="text-sm font-medium">
                                  {saferSex.condoms
                                    ? "Usually"
                                    : "Sometimes/Never"}
                                </p>
                              </div>
                              <div className="rounded-full bg-muted/40 p-2">
                                <Shield
                                  className="h-5 w-5 text-muted-foreground"
                                  aria-hidden="true"
                                />
                              </div>
                            </div>
                          ) : null}

                          {/* Last tested */}
                          {("last_tested" in saferSex ||
                            "last_test_date" in saferSex) &&
                          (saferSex?.last_tested ||
                            saferSex?.last_test_date) ? (
                            <div className="rounded-lg p-3 bg-card/50 flex items-center justify-between">
                              <div>
                                <p className="text-xs text-muted-foreground">
                                  Last tested
                                </p>
                                <p className="text-sm font-medium">
                                  {(() => {
                                    const iso = (saferSex?.last_tested ||
                                      saferSex?.last_test_date) as string;
                                    try {
                                      const d = new Date(iso);
                                      return d.toLocaleDateString(undefined, {
                                        year: "numeric",
                                        month: "short",
                                        day: "2-digit",
                                      });
                                    } catch {
                                      return iso;
                                    }
                                  })()}
                                </p>
                              </div>
                              <div className="rounded-full bg-muted/40 p-2">
                                <CalendarClock
                                  className="h-5 w-5 text-muted-foreground"
                                  aria-hidden="true"
                                />
                              </div>
                            </div>
                          ) : null}
                        </div>

                        {"notes" in saferSex && saferSex?.notes ? (
                          <p className="text-xs text-muted-foreground mt-2 whitespace-pre-wrap">
                            {saferSex.notes}
                          </p>
                        ) : null}
                      </>
                    )}
                  </section>
                ) : null}
                <Separator />
                {/* --- Begin: I'm into section --- */}
                <section>
                  <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">
                    I&apos;m into
                  </h3>
                  <p className="text-xs text-muted-foreground mb-3">
                    You have{" "}
                    <Badge variant="secondary" className="mx-1 align-middle">
                      {intoTotal}
                    </Badge>{" "}
                    things in common.
                  </p>
                  <div className="space-y-2 w-full">
                    <Item asChild className="bg-card/50 w-full max-w-none">
                      <button
                        type="button"
                        className="w-full text-left"
                        onClick={() => setOpenDrawer("type")}
                      >
                        <ItemMedia variant="icon">
                          <Heart
                            className="h-5 w-5 text-foreground/70"
                            aria-hidden="true"
                          />
                        </ItemMedia>
                        <ItemContent>
                          <ItemTitle>My type</ItemTitle>
                          <ItemDescription>What they look for</ItemDescription>
                        </ItemContent>
                        <Badge
                          variant="secondary"
                          className="ml-auto text-xs px-2 py-0.5"
                        >
                          3
                        </Badge>
                      </button>
                    </Item>

                    <Item asChild className="bg-card/50 w-full max-w-none">
                      <button
                        type="button"
                        className="w-full text-left"
                        onClick={() => setOpenDrawer("action")}
                      >
                        <ItemMedia variant="icon">
                          <Zap
                            className="h-5 w-5 text-foreground/70"
                            aria-hidden="true"
                          />
                        </ItemMedia>
                        <ItemContent>
                          <ItemTitle>Action</ItemTitle>
                          <ItemDescription>
                            How they like to play
                          </ItemDescription>
                        </ItemContent>
                        <Badge
                          variant="secondary"
                          className="ml-auto text-xs px-2 py-0.5"
                        >
                          1
                        </Badge>
                      </button>
                    </Item>

                    <Item asChild className="bg-card/50 w-full max-w-none">
                      <button
                        type="button"
                        className="w-full text-left"
                        onClick={() => setOpenDrawer("kinks")}
                      >
                        <ItemMedia variant="icon">
                          <Sparkles
                            className="h-5 w-5 text-foreground/70"
                            aria-hidden="true"
                          />
                        </ItemMedia>
                        <ItemContent>
                          <ItemTitle>Kinks &amp; fetishes</ItemTitle>
                          <ItemDescription>
                            Interests and limits
                          </ItemDescription>
                        </ItemContent>
                        <Badge
                          variant="secondary"
                          className="ml-auto text-xs px-2 py-0.5"
                        >
                          5
                        </Badge>
                      </button>
                    </Item>

                    <Item asChild className="bg-card/50 w-full max-w-none">
                      <button
                        type="button"
                        className="w-full text-left"
                        onClick={() => setOpenDrawer("scenarios")}
                      >
                        <ItemMedia variant="icon">
                          <ScrollText
                            className="h-5 w-5 text-foreground/70"
                            aria-hidden="true"
                          />
                        </ItemMedia>
                        <ItemContent>
                          <ItemTitle>Scenarios</ItemTitle>
                          <ItemDescription>Roleplay and scenes</ItemDescription>
                        </ItemContent>
                        <Badge
                          variant="secondary"
                          className="ml-auto text-xs px-2 py-0.5"
                        >
                          2
                        </Badge>
                      </button>
                    </Item>
                  </div>
                </section>
                {/* --- End: I'm into section --- */}
                <Drawer
                  open={profileDrawerOpen}
                  onOpenChange={setProfileDrawerOpen}
                >
                  <DrawerContent className="max-h-[85dvh]">
                    <DrawerHeader>
                      <DrawerTitle>{heroTitle}</DrawerTitle>
                      {profile?.username ? (
                        <DrawerDescription>
                          @{profile.username}
                        </DrawerDescription>
                      ) : null}
                      {updatedDisplay ? (
                        <p className="text-xs text-muted-foreground mt-1">
                          Updated {updatedDisplay}
                        </p>
                      ) : null}
                    </DrawerHeader>
                    <div className="px-5 pb-6">
                      {/* Additional profile quick info can go here later */}
                    </div>
                  </DrawerContent>
                </Drawer>
                <div className="mb-14" />
                <Drawer
                  open={!!openDrawer}
                  onOpenChange={(o) => (!o ? setOpenDrawer(null) : null)}
                >
                  <DrawerContent className="max-h-[85dvh]">
                    <DrawerHeader>
                      <DrawerTitle>{currentTitle}</DrawerTitle>
                      <DrawerDescription>
                        {currentCount} in common
                      </DrawerDescription>
                    </DrawerHeader>
                    <div className="px-5 pb-6">
                      <div className="grid grid-cols-2 gap-3 text-sm">
                        {currentInterests.map((label) => {
                          const isMutual = mutualSet.has(label);
                          return (
                            <div
                              key={label}
                              className={
                                "rounded-md bg-muted/50 px-3 py-2 flex items-center justify-between " +
                                (isMutual
                                  ? "border-2 border-primary bg-primary/5"
                                  : "border border-transparent")
                              }
                            >
                              <span className="truncate">{label}</span>
                              {isMutual ? (
                                <span className="ml-2 inline-flex items-center justify-center rounded-full p-1.5 bg-primary/10">
                                  <Check
                                    className="h-4 w-4 text-primary"
                                    aria-hidden="true"
                                  />
                                </span>
                              ) : null}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </DrawerContent>
                </Drawer>
              </>

              {/* Sections removed: Highlights (Icon rows), Languages & Nationalities, Actions */}
            </>
          )}
        </div>
        {/* Floating Reactions Menu (anchored to reaction icon, slides out to the left) */}
        {reactionMenu.open ? (
          <>
            <button
              aria-label="Close reactions"
              className="fixed inset-0 z-99"
              onClick={() =>
                setReactionMenu({ open: false, x: 0, y: 0, target: null })
              }
            />
            <div
              className="fixed z-100 -translate-x-full -translate-y-1/2 rounded-2xl bg-popover border shadow-lg px-2 py-1 flex gap-1 animate-in fade-in-0 zoom-in-95 slide-in-from-right-2"
              style={{ left: reactionMenu.x, top: reactionMenu.y }}
              role="menu"
            >
              {REACTIONS.map(({ key, label, Icon }) => (
                <button
                  key={key}
                  onClick={() => sendReaction(key)}
                  className="p-2 rounded-xl bg-card hover:bg-accent focus:outline-none focus:ring-2 focus:ring-primary/30 border"
                  title={label}
                  aria-label={label}
                >
                  <Icon className="h-6 w-6 text-primary" />
                </button>
              ))}
            </div>
          </>
        ) : null}
      </main>
    </div>
  );
}
