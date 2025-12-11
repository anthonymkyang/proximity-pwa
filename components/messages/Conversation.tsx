"use client";

import { useMemo } from "react";
import type React from "react";
import { createClient } from "@/utils/supabase/client";
import { Check, CheckCheck } from "lucide-react";

export type ConversationMessage = {
  id: string;
  body: string;
  created_at: string;
  sender_id: string;
  delivered_at?: string | null;
  read_at?: string | null;
  failed?: boolean;
  profiles?: {
    profile_title?: string | null;
    avatar_url?: string | null;
    age?: number | null;
    sexuality?: string | null;
    position?: string | null;
  } | null;
};

export default function Conversation({
  messages,
  currentUserId,
  hasMounted,
  messagesEndRef,
}: {
  messages: ConversationMessage[];
  currentUserId: string | null;
  hasMounted: boolean;
  messagesEndRef: React.RefObject<HTMLDivElement | null>;
}) {
  const isGroup = useMemo(() => {
    if (!messages || messages.length === 0) return false;
    const others = new Set(
      messages
        .filter((m) => m.sender_id && m.sender_id !== currentUserId)
        .map((m) => m.sender_id)
    );
    return others.size > 1;
  }, [messages, currentUserId]);

  return (
    <>
      {messages.map((m, index) => {
        const mine = currentUserId ? m.sender_id === currentUserId : false;
        // Resolve avatar URL from Supabase Storage if it's a key like `userId/filename.jpg`
        let resolvedAvatarUrl: string | null = null;
        if (!mine && m.profiles?.avatar_url) {
          const raw = m.profiles.avatar_url;
          if (raw.startsWith("http")) {
            resolvedAvatarUrl = raw;
          } else {
            const supa = createClient();
            const bucket =
              process.env.NEXT_PUBLIC_SUPABASE_AVATARS_BUCKET || "avatars";
            const { data } = supa.storage.from(bucket).getPublicUrl(raw);
            resolvedAvatarUrl = data.publicUrl || null;
          }
        }

        return (
          <div
            key={m.id}
            className={`flex items-start gap-2 ${
              mine ? "justify-end" : "justify-start"
            } ${index === messages.length - 1 ? "" : "mb-3"}`}
          >
            {!mine ? (
              m.profiles?.avatar_url ? (
                <img
                  src={resolvedAvatarUrl ?? ""}
                  alt={m.profiles.profile_title || "User avatar"}
                  className="w-6 h-6 rounded-full border border-muted object-cover self-start"
                  onError={(e) => {
                    (e.currentTarget as HTMLImageElement).src =
                      "/avatar-fallback.png";
                  }}
                />
              ) : (
                <div className="w-6 h-6 rounded-full bg-muted border border-muted self-start" />
              )
            ) : null}

            <div
              className={
                mine
                  ? "max-w-[75%] rounded-lg rounded-br-none px-3 py-2 text-sm bg-primary text-white"
                  : "max-w-[75%] rounded-lg rounded-bl-none px-3 py-2 text-sm bg-muted text-foreground"
              }
            >
              {isGroup && !mine && m.profiles?.profile_title ? (
                <p className="text-xs font-medium mb-1">
                  {m.profiles.profile_title}
                </p>
              ) : null}

              <p>{m.body}</p>

              <div className="flex items-center justify-end gap-1 mt-1">
                <p
                  className="text-[10px] opacity-60 text-right"
                  suppressHydrationWarning
                >
                  {hasMounted
                    ? new Date(m.created_at).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })
                    : ""}
                </p>
                {mine ? (
                  m.failed ? (
                    <span className="text-[10px] text-red-500 ml-1">
                      Failed
                    </span>
                  ) : m.read_at ? (
                    <CheckCheck
                      className="h-3.5 w-3.5 text-primary opacity-90"
                      aria-label="Read"
                    />
                  ) : m.delivered_at ? (
                    <CheckCheck
                      className="h-3.5 w-3.5 text-muted-foreground opacity-70"
                      aria-label="Delivered"
                    />
                  ) : (
                    <Check
                      className="h-3.5 w-3.5 text-muted-foreground opacity-70"
                      aria-label="Sent"
                    />
                  )
                ) : null}
              </div>
            </div>
          </div>
        );
      })}

      <div ref={messagesEndRef} />
    </>
  );
}
