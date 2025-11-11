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
import Badge24 from "@/components/shadcn-studio/badge/badge-24";

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

function toHeaderPresence(
  row: { status?: string | null; updated_at?: string | null } | null
): "online" | "away" | "recently" | "offline" {
  if (!row?.updated_at) return "offline";
  const t = Date.parse(row.updated_at);
  if (!Number.isFinite(t)) return "offline";
  const minutes = (Date.now() - t) / 60000;
  if (minutes > 60) return "offline"; // inactive -> no dot
  if (minutes > 5) return "recently"; // 5–60 min -> grey dot
  // <= 5 minutes: prefer explicit status when present
  if (row.status === "away") return "away";
  if (row.status === "online") return "online";
  // if status is offline but timestamp is fresh, still consider recently
  return "recently";
}

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

  const headerInitials = useMemo(() => {
    const t = title || "?";
    return t
      .split(" ")
      .map((w) => w?.trim?.()[0] ?? "")
      .filter(Boolean)
      .slice(0, 2)
      .join("")
      .toUpperCase();
  }, [title]);

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
      return toHeaderPresence({
        status: row?.status ?? null,
        updated_at: row?.updated_at ?? null,
      });
    };

    // Initial fetch
    supabase
      .from("user_presence")
      .select("status, updated_at")
      .eq("user_id", otherUserId)
      .maybeSingle()
      .then(({ data }) => {
        if (!mounted) return;
        const next = statusFromRow(data);
        setPresenceStatus(next);
        setLastSeen(data?.updated_at ?? null);
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
          if (!mounted) return;
          const row = payload?.new ?? payload?.old ?? null;
          const next = statusFromRow(row);
          setPresenceStatus(next);
          setLastSeen(row?.updated_at ?? null);
        }
      );
    channel.subscribe();
    unsub = () => channel.unsubscribe();

    return () => {
      mounted = false;
      if (unsub) unsub();
    };
  }, [otherUserId]);

  const badgePresence =
    presenceStatus === "recently"
      ? "recent"
      : presenceStatus === "offline"
      ? null
      : presenceStatus;

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-card/95 backdrop-blur supports-backdrop-filter:bg-card/80 px-4 py-3 flex items-center justify-between gap-3">
      <div className="flex items-center gap-3">
        <BackButton />
        {otherUserId ? (
          <Link
            href={`/app/profile/${otherUserId}`}
            className="flex items-center gap-3"
          >
            <Badge24
              src={headerAvatarUrl || undefined}
              alt={title || "User avatar"}
              fallback={headerInitials}
              presence={badgePresence}
              className="h-11 w-11"
              ring
            />
            <div className="flex-1">
              <h1 className="text-sm font-semibold">{title}</h1>
              {metaLine ? (
                <p className="text-[10px] text-muted-foreground">{metaLine}</p>
              ) : null}
            </div>
          </Link>
        ) : (
          <>
            <Badge24
              src={headerAvatarUrl || undefined}
              alt={title || "User avatar"}
              fallback={headerInitials}
              presence={badgePresence}
              className="h-11 w-11"
              ring
            />
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
