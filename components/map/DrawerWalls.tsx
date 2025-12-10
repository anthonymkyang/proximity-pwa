"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import Conversation, { type ConversationMessage } from "@/components/messages/Conversation";
import MessageBar from "@/components/messages/MessageBar";
import { createClient } from "@/utils/supabase/client";
import { cn } from "@/lib/utils";

type DrawerWallsProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: string;
  subtitle?: string;
  ownerType?: "place" | "cruising";
  ownerId?: string | null;
  initialMessages?: ConversationMessage[];
};

const mapRowToMessage = (row: any): ConversationMessage => ({
  id: (row?.id ?? row?.message_id ?? crypto.randomUUID()).toString(),
  body: row?.body ?? "",
  created_at: row?.created_at ?? new Date().toISOString(),
  sender_id: row?.author_id ?? row?.sender_id ?? "",
  profiles: row?.profiles
    ? {
        profile_title: row.profiles.profile_title ?? null,
        avatar_url: row.profiles.avatar_url ?? null,
      }
    : null,
});

export default function DrawerWalls({
  open,
  onOpenChange,
  title = "Wall",
  subtitle,
  ownerType,
  ownerId,
  initialMessages,
}: DrawerWallsProps) {
  const [messages, setMessages] = useState<ConversationMessage[]>(
    initialMessages && initialMessages.length ? initialMessages : []
  );
  const [input, setInput] = useState("");
  const [wallId, setWallId] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [hasMounted, setHasMounted] = useState(false);
  const endRef = useRef<HTMLDivElement | null>(null);
  const supabase = useMemo(() => createClient(), []);

  useEffect(() => {
    setHasMounted(true);
  }, []);

  useEffect(() => {
    let active = true;
    supabase.auth
      .getUser()
      .then(({ data }) => {
        if (!active) return;
        setCurrentUserId(data.user?.id ?? null);
      })
      .catch(() => {
        if (!active) return;
        setCurrentUserId(null);
      })
      .finally(() => {
        if (!active) return;
        setAuthChecked(true);
      });
    return () => {
      active = false;
    };
  }, [supabase]);

  useEffect(() => {
    if (!open || !ownerType || !ownerId) {
      setMessages(initialMessages && initialMessages.length ? initialMessages : []);
      setWallId(null);
      setError(null);
      setLoading(false);
      return;
    }

    if (!authChecked) return;

    if (!currentUserId) {
      setMessages([]);
      setWallId(null);
      setError("Sign in to view this wall.");
      setLoading(false);
      return;
    }

    let active = true;
    setLoading(true);
    setError(null);

    const ensureAndLoad = async () => {
      const res = await fetch("/api/walls/ensure", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ owner_type: ownerType, owner_id: ownerId }),
      });

      if (!active) return;

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setWallId(null);
        setMessages([]);
        setLoading(false);
        setError(body?.error || "Unable to load this wall.");
        return;
      }

      const payload = (await res.json()) as { id?: number | null };
      const newWallId = payload?.id ?? null;
      if (!newWallId) {
        setWallId(null);
        setMessages([]);
        setLoading(false);
        setError("Unable to load this wall.");
        return;
      }

      setWallId(newWallId);

      const msgRes = await fetch("/api/walls/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ wall_id: newWallId }),
      });

      if (!active) return;

      if (!msgRes.ok) {
        setMessages([]);
        const body = await msgRes.json().catch(() => ({}));
        setError(body?.error || "Unable to load wall messages.");
      } else {
        const body = (await msgRes.json()) as { messages?: any[] };
        const msgs = body?.messages ?? [];
        setMessages(msgs.map(mapRowToMessage));
      }

      setLoading(false);
    };

    void ensureAndLoad();

    return () => {
      active = false;
    };
  }, [
    open,
    ownerType,
    ownerId,
    supabase,
    initialMessages,
    authChecked,
    currentUserId,
  ]);

  useEffect(() => {
    if (!open || !wallId) return;

    const channel = supabase
      .channel(`wall-messages-${wallId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "wall_messages", filter: `wall_id=eq.${wallId}` },
        (payload) => {
          const next = mapRowToMessage(payload.new);
          setMessages((prev) => {
            if (prev.some((m) => m.id === next.id)) return prev;
            return [...prev, next];
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [open, wallId, supabase]);

  useEffect(() => {
    if (endRef.current) {
      endRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, open]);

  const headerTitle = useMemo(() => title || "Wall", [title]);

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="pb-4">
        <DrawerHeader className="pb-1">
          <DrawerTitle className="text-lg font-semibold">{headerTitle}</DrawerTitle>
          {subtitle ? (
            <DrawerDescription className="text-sm text-muted-foreground">
              {subtitle}
            </DrawerDescription>
          ) : null}
        </DrawerHeader>
        <div className="px-4">
          <div className="flex h-[60vh] min-h-[300px] flex-col rounded-2xl bg-card/80 px-4 pb-4 shadow-[0_12px_28px_rgba(0,0,0,0.35)] backdrop-blur">
            <div className="flex-1 space-y-3 overflow-y-auto pr-1 pt-2 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
              {loading ? (
                <div className="space-y-2 text-sm text-muted-foreground">
                  <div className="h-3 w-24 rounded bg-muted/60 animate-pulse" />
                  <div className="h-3 w-32 rounded bg-muted/60 animate-pulse" />
                  <div className="h-3 w-28 rounded bg-muted/60 animate-pulse" />
                </div>
              ) : error ? (
                <div className="text-sm text-muted-foreground">{error}</div>
              ) : messages.length ? (
                <Conversation
                  messages={messages}
                  currentUserId={currentUserId}
                  hasMounted={hasMounted}
                  messagesEndRef={endRef}
                />
              ) : (
                <p className="text-sm text-muted-foreground">No posts yet.</p>
              )}
            </div>
            <div className={cn("-mx-3 mt-4", !wallId && "opacity-60")}>
              <MessageBar
                value={input}
                onChange={setInput}
                onSend={() => {
                  if (!input.trim() || sending) return;
                  if (!wallId) {
                    setError("Wall is not available for this item.");
                    return;
                  }
                  if (!currentUserId) {
                    setError("Sign in to post to this wall.");
                    return;
                  }
                  setSending(true);
                  setError(null);
                  supabase
                    .from("wall_messages")
                    .insert({
                      wall_id: wallId,
                      author_id: currentUserId,
                      body: input.trim(),
                    })
                    .select("id,body,created_at,author_id")
                    .maybeSingle()
                    .then(({ data, error: insertError }) => {
                      if (insertError || !data) {
                        setError(insertError?.message || "Unable to post right now.");
                        return;
                      }
                      setMessages((prev) => [...prev, mapRowToMessage(data)]);
                      setInput("");
                    })
                    .finally(() => setSending(false));
                }}
                placeholder="Post to this wall…"
                showShareButton={false}
                disabled={
                  sending ||
                  loading ||
                  !wallId ||
                  !authChecked ||
                  !currentUserId ||
                  Boolean(error)
                }
              />
              <div ref={endRef} />
            </div>
          </div>
        </div>
      </DrawerContent>
    </Drawer>
  );
}
