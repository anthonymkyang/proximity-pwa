"use client";

import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@/utils/supabase/client";

type PresenceEntry = {
  status: string | null;
  updated_at: string | null;
  last_seen: string | null;
  lat: number | null;
  lng: number | null;
};

type PresenceContextValue = {
  presence: Record<string, PresenceEntry>;
  currentUserId: string | null;
};

export function toUiPresence(entry?: PresenceEntry | null) {
  if (!entry) return null;
  const status = entry.status?.toLowerCase() || null;
  // If status is explicitly missing/null, treat as offline.
  if (!status) return null;
  const ts = entry.updated_at || entry.last_seen;
  const ageMs = ts ? Date.now() - Date.parse(ts) : null;
  const fiveMinutes = 5 * 60 * 1000;
  const tenMinutes = 10 * 60 * 1000;

  // First respect explicit statuses if present
  if (status === "online") return "online";
  if (status === "away") return "away";
  if (status === "offline") return null;

  // If no explicit status, derive from time
  if (ageMs == null || !Number.isFinite(ageMs)) return null;
  if (ageMs > tenMinutes) return null;
  if (ageMs >= fiveMinutes) return "away";
  return "online";
}

const PresenceContext = createContext<PresenceContextValue>({
  presence: {},
  currentUserId: null,
});

export function PresenceProvider({ children }: { children: React.ReactNode }) {
  const supabase = useRef(createClient()).current;
  const [presence, setPresence] = useState<Record<string, PresenceEntry>>({});
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    let channel: ReturnType<typeof supabase.channel> | null = null;
    const toNum = (v: unknown) => {
      const n = Number(v);
      return Number.isFinite(n) ? n : null;
    };

    const load = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!active) return;
      setCurrentUserId(user?.id ?? null);

      const { data, error } = await supabase
        .from("user_presence")
        .select("user_id,status,updated_at,last_seen,lat,lng");
      if (!active) return;
      if (!error && data) {
        const map: Record<string, PresenceEntry> = {};
        data.forEach((row: any) => {
          if (!row.user_id) return;
          map[row.user_id] = {
            status: row.status ?? null,
            updated_at: row.updated_at ?? null,
            last_seen: row.last_seen ?? null,
            lat: toNum(row.lat),
            lng: toNum(row.lng),
          };
        });
        setPresence(map);
      }

      channel = supabase
        .channel("presence-global")
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "user_presence" },
          (payload) => {
            const row: any = payload.new ?? payload.old ?? {};
            if (!row.user_id) return;
            setPresence((prev) => ({
              ...prev,
              [row.user_id]: {
                status: row.status ?? prev[row.user_id]?.status ?? null,
                updated_at:
                  row.updated_at ?? prev[row.user_id]?.updated_at ?? null,
                last_seen: row.last_seen ?? prev[row.user_id]?.last_seen ?? null,
                lat: toNum(row.lat) ?? prev[row.user_id]?.lat ?? null,
                lng: toNum(row.lng) ?? prev[row.user_id]?.lng ?? null,
              },
            }));
          }
        )
        .subscribe();
    };

    void load();
    return () => {
      active = false;
      if (channel) supabase.removeChannel(channel);
    };
  }, [supabase]);

  const value = useMemo(
    () => ({ presence, currentUserId }),
    [presence, currentUserId]
  );

  return (
    <PresenceContext.Provider value={value}>
      {children}
    </PresenceContext.Provider>
  );
}

export function usePresence() {
  return useContext(PresenceContext);
}
