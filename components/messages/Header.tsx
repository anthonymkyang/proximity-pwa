"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { createClient } from "@/utils/supabase/client";
import BackButton from "@/components/ui/back-button";
import { Button as ShadButton } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MoreVertical, ShieldAlert, Ban, OctagonAlert } from "lucide-react";

export type HeaderMessage = {
  id: string;
  body: string;
  created_at: string;
  sender_id: string;
  profiles?: {
    profile_title?: string | null;
    avatar_url?: string | null;
    age?: number | null;
    sexuality?: { label?: string | null } | null;
    position?: { label?: string | null } | null;
  } | null;
};

export default function Header({
  messages,
  currentUserId,
  hasMounted,
}: {
  messages: HeaderMessage[];
  currentUserId: string | null;
  hasMounted: boolean;
}) {
  // The API attaches the other participant's profile onto every message.
  const otherProfile = useMemo(() => {
    if (!messages || messages.length === 0) return null;
    const anyWithProfile = messages.find((m) => m.profiles);
    return anyWithProfile?.profiles ?? null;
  }, [messages]);

  const headerAvatarUrl = useMemo(() => {
    if (!otherProfile?.avatar_url) return null;
    const raw = otherProfile.avatar_url;
    if (raw.startsWith("http")) return raw;
    try {
      const bucket =
        process.env.NEXT_PUBLIC_SUPABASE_AVATARS_BUCKET || "avatars";
      const supa = createClient();
      const { data } = supa.storage.from(bucket).getPublicUrl(raw);
      return data.publicUrl ?? null;
    } catch {
      return null;
    }
  }, [otherProfile]);

  const title = useMemo(() => {
    if (!messages || messages.length === 0) return "Conversation";
    const withTitle = messages.find((m) => m.profiles?.profile_title);
    return withTitle?.profiles?.profile_title ?? "Conversation";
  }, [messages]);

  const metaLine = useMemo(() => {
    if (!otherProfile) return "";
    const parts: string[] = [];

    if (typeof otherProfile.age === "number" && otherProfile.age > 0) {
      parts.push(String(otherProfile.age));
    }

    const sexLabel = otherProfile.sexuality?.label
      ? String(otherProfile.sexuality.label).trim()
      : "";
    if (sexLabel) parts.push(sexLabel);

    const posLabel = otherProfile.position?.label
      ? String(otherProfile.position.label).trim()
      : "";
    if (posLabel) parts.push(posLabel);

    return parts.join(" • ");
  }, [otherProfile]);

  const otherUserId = useMemo(() => {
    if (!messages || messages.length === 0) return null;
    const firstOther = messages.find(
      (m) => m.sender_id && m.sender_id !== currentUserId
    );
    return firstOther ? firstOther.sender_id : null;
  }, [messages, currentUserId]);

  // Presence state for the other participant
  const [presenceStatus, setPresenceStatus] = useState<
    "online" | "away" | "recently" | "offline"
  >("offline");
  const [lastSeen, setLastSeen] = useState<string | null>(null);

  // Load + subscribe to user_presence for the other participant
  useEffect(() => {
    if (!otherUserId) {
      setPresenceStatus("offline");
      setLastSeen(null);
      return;
    }
    const supabase = createClient();
    let unsub: (() => void) | null = null;
    let mounted = true;

    const statusFromRow = (row: any) => {
      if (!row)
        return { status: "offline" as const, lastSeen: null as string | null };
      const raw = typeof row.status === "string" ? row.status : "";
      const updated = row.updated_at ?? row.updatedAt ?? null;
      // Map raw -> presence; "recently" is computed client-side from updated_at
      let status: "online" | "away" | "recently" | "offline" = "offline";
      if (raw === "online" || raw === "away") status = raw as any;
      else status = "offline";
      return { status, lastSeen: updated };
    };

    // Initial fetch
    supabase
      .from("user_presence")
      .select("status, updated_at")
      .eq("user_id", otherUserId)
      .maybeSingle()
      .then(({ data }) => {
        const { status, lastSeen } = statusFromRow(data);
        if (!mounted) return;
        // If they've been seen in the last hour, present as "recently"
        if (status === "offline" && lastSeen) {
          try {
            const t = new Date(lastSeen).getTime();
            if (!isNaN(t)) {
              const mins = (Date.now() - t) / 60000;
              if (mins <= 60) {
                setPresenceStatus("recently");
              } else {
                setPresenceStatus("offline");
              }
            } else {
              setPresenceStatus("offline");
            }
          } catch {
            setPresenceStatus("offline");
          }
        } else {
          setPresenceStatus(status);
        }
        setLastSeen(lastSeen);
      });

    // Realtime subscribe
    const channel = supabase
      .channel("realtime:user_presence:" + otherUserId)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "user_presence",
          filter: `user_id=eq.${otherUserId}`,
        },
        (payload: any) => {
          const row = payload?.new ?? null;
          const { status, lastSeen } = statusFromRow(row);
          if (!mounted) return;
          if (status === "offline" && lastSeen) {
            try {
              const t = new Date(lastSeen).getTime();
              if (!isNaN(t)) {
                const mins = (Date.now() - t) / 60000;
                setPresenceStatus(mins <= 60 ? "recently" : "offline");
              } else {
                setPresenceStatus("offline");
              }
            } catch {
              setPresenceStatus("offline");
            }
          } else {
            setPresenceStatus(status);
          }
          setLastSeen(lastSeen);
        }
      );
    channel.subscribe();
    unsub = () => channel.unsubscribe();

    return () => {
      mounted = false;
      if (unsub) unsub();
    };
  }, [otherUserId]);

  const presenceDot =
    presenceStatus === "online"
      ? "bg-emerald-500"
      : presenceStatus === "away"
      ? "bg-amber-400"
      : presenceStatus === "recently"
      ? "bg-gray-400"
      : "";

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-card/95 backdrop-blur supports-backdrop-filter:bg-card/80 px-4 py-3 flex items-center justify-between gap-3">
      <div className="flex items-center gap-3">
        <BackButton />
        {otherUserId ? (
          <Link
            href={`/app/profile/${otherUserId}`}
            className="flex items-center gap-3"
          >
            {headerAvatarUrl ? (
              <div
                className="relative overflow-visible"
                style={{ width: 44, height: 44 }}
              >
                <img
                  src={headerAvatarUrl}
                  alt={title || "User avatar"}
                  className="w-11 h-11 rounded-full border border-muted object-cover block"
                  onError={(e) => {
                    (e.currentTarget as HTMLImageElement).src =
                      "/avatar-fallback.png";
                  }}
                />
                {presenceStatus !== "offline" ? (
                  <span
                    className={
                      "absolute -top-1 -left-1 h-3 w-3 rounded-full ring-2 ring-background z-10 pointer-events-none " +
                      presenceDot
                    }
                    aria-hidden="true"
                  />
                ) : null}
              </div>
            ) : null}
            <div className="flex-1">
              <h1 className="text-sm font-semibold">{title}</h1>
              {metaLine ? (
                <p className="text-[10px] text-muted-foreground">{metaLine}</p>
              ) : null}
            </div>
          </Link>
        ) : (
          <>
            {headerAvatarUrl ? (
              <div
                className="relative overflow-visible"
                style={{ width: 44, height: 44 }}
              >
                <img
                  src={headerAvatarUrl}
                  alt={title || "User avatar"}
                  className="w-11 h-11 rounded-full border border-muted object-cover block"
                  onError={(e) => {
                    (e.currentTarget as HTMLImageElement).src =
                      "/avatar-fallback.png";
                  }}
                />
                {presenceStatus !== "offline" ? (
                  <span
                    className={
                      "absolute -top-1 -left-1 h-3 w-3 rounded-full ring-2 ring-background z-10 pointer-events-none " +
                      presenceDot
                    }
                    aria-hidden="true"
                  />
                ) : null}
              </div>
            ) : null}
            <div className="flex-1">
              <h1 className="text-sm font-semibold">{title}</h1>
              {metaLine ? (
                <p className="text-[10px] text-muted-foreground">{metaLine}</p>
              ) : null}
            </div>
          </>
        )}
      </div>

      {hasMounted ? (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <ShadButton variant="ghost" size="icon" className="h-8 w-8">
              <MoreVertical className="h-4 w-4" />
              <span className="sr-only">Open conversation menu</span>
            </ShadButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-44">
            <DropdownMenuItem>
              <ShieldAlert className="mr-2 h-4 w-4" />
              <span>Restrict user</span>
            </DropdownMenuItem>
            <DropdownMenuItem>
              <OctagonAlert className="mr-2 h-4 w-4" />
              <span>Report user</span>
            </DropdownMenuItem>
            <DropdownMenuItem className="text-destructive focus:text-destructive">
              <Ban className="mr-2 h-4 w-4" />
              <span>Block user</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ) : null}
    </header>
  );
}
