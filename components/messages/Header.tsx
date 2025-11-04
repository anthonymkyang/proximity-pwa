"use client";

import { useMemo } from "react";
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
  const otherProfile = useMemo(() => {
    if (!messages || messages.length === 0) return null;
    return (
      messages.find((m) => m.sender_id !== currentUserId && m.profiles)
        ?.profiles ?? null
    );
  }, [messages, currentUserId]);

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
    return (
      messages.find(
        (m) => m.profiles?.profile_title && m.sender_id !== currentUserId
      )?.profiles?.profile_title ?? "Conversation"
    );
  }, [messages, currentUserId]);

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-card/95 backdrop-blur supports-backdrop-filter:bg-card/80 px-4 py-3 flex items-center gap-3">
      <BackButton />
      {headerAvatarUrl ? (
        <img
          src={headerAvatarUrl}
          alt={title || "User avatar"}
          className="w-8 h-8 rounded-full border border-muted object-cover"
          onError={(e) => {
            (e.currentTarget as HTMLImageElement).src = "/avatar-fallback.png";
          }}
        />
      ) : null}
      <div className="flex-1">
        <h1 className="text-sm font-semibold">{title}</h1>
        <p className="text-[10px] text-green-600">Online now</p>
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
