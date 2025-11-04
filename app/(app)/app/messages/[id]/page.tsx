"use client";

import { useEffect, useState, useRef, useMemo } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { createClient } from "@/utils/supabase/client";

import Conversation from "@/components/messages/Conversation";

import Header from "@/components/messages/Header";
import MessageBar from "@/components/messages/MessageBar";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerFooter,
} from "@/components/ui/drawer";
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemMedia,
  ItemTitle,
} from "@/components/ui/item";
import { Image as ImageIcon } from "lucide-react";
import { Image, MapPin, IdCard, User, Users } from "lucide-react";

type Message = {
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
  } | null;
};

export default function ConversationPage() {
  const params = useParams();
  const search = useSearchParams();

  // support both /app/messages/[id] and /app/messages?id=...
  const routeId = Array.isArray((params as any).id)
    ? (params as any).id[0]
    : (params as any).id ?? null;
  const queryId = search.get("id");
  const conversationId = routeId ?? queryId ?? null;

  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [newMessage, setNewMessage] = useState("");
  const [hasMounted, setHasMounted] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [photosOpen, setPhotosOpen] = useState(false);
  useEffect(() => {
    setHasMounted(true);
  }, []);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  // Share the realtime channel across effects so we can broadcast after PATCH
  const channelRef = useRef<any>(null);
  // Track message IDs for efficient lookup in realtime handlers
  const messageIdsRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    messageIdsRef.current = new Set(messages.map((m) => m.id));
  }, [messages]);

  useEffect(() => {
    const load = async () => {
      if (!conversationId) {
        setError("conversation_id is missing from route");
        setLoading(false);
        return;
      }

      try {
        const supabase = createClient();
        const {
          data: { user },
        } = await supabase.auth.getUser();
        setCurrentUserId(user ? user.id : null);

        const res = await fetch(`/api/messages/${conversationId}`);
        const data = await res.json();

        if (!res.ok) {
          setError(data.error || "Failed to load messages");
          setMessages([]);
          return;
        }

        setMessages(data.messages ?? []);
        // scroll to bottom after messages load
        setTimeout(() => {
          messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
        }, 100);
        setError(null);
      } catch (err) {
        console.error("failed to load messages", err);
        setError("Failed to load messages");
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [conversationId]);

  // Mark as read when the thread is visible/focused and when new messages arrive
  useEffect(() => {
    const markRead = async () => {
      if (!conversationId) return;
      try {
        const res = await fetch(`/api/messages/${conversationId}`, {
          method: "PATCH",
        });
        if (res.ok) {
          // notify peers to refresh receipts
          try {
            channelRef.current?.send({
              type: "broadcast",
              event: "read-updated",
              payload: {},
            });
          } catch {}
        }
      } catch (e) {
        console.warn("markRead failed", e);
      }
    };

    // initial attempt
    markRead();

    const onFocus = () => markRead();
    const onVisibility = () => {
      if (document.visibilityState === "visible") markRead();
    };

    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [conversationId, messages.length]);

  // Realtime: new messages and receipt updates
  useEffect(() => {
    if (!conversationId) return;
    const supa = createClient();

    const channel = supa.channel(`conversation:${conversationId}`);
    channelRef.current = channel;
    channel
      // New messages in this conversation
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `conversation_id=eq.${conversationId}`,
        },
        (payload: any) => {
          const msg = payload.new as Message & { profiles?: any };
          // Avoid duplicates if we already have this id (e.g., optimistic swap already replaced it)
          setMessages((prev) => {
            if (prev.some((m) => m.id === msg.id)) return prev;
            return [...prev, msg];
          });
          // keep scrolled to bottom on incoming
          requestAnimationFrame(() => {
            messagesEndRef.current?.scrollIntoView({
              behavior: "smooth",
              block: "end",
            });
          });
        }
      )
      // Receipt INSERT (first-time delivered/read)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "message_receipts",
        },
        (payload: any) => {
          const rec = payload.new as {
            message_id: string;
            user_id: string;
            delivered_at: string | null;
            read_at: string | null;
          };
          // Only apply the recipient's receipts for our own messages in this conversation
          if (rec.user_id === currentUserId) return;
          if (!messageIdsRef.current.has(rec.message_id)) return;
          setMessages((prev) =>
            prev.map((m) => {
              const mine = currentUserId
                ? m.sender_id === currentUserId
                : false;
              if (!mine || m.id !== rec.message_id) return m;
              return {
                ...m,
                delivered_at: rec.delivered_at ?? m.delivered_at ?? null,
                read_at: rec.read_at ?? m.read_at ?? null,
              };
            })
          );
        }
      )
      // Receipt UPDATE (read time changes, etc.)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "message_receipts",
        },
        (payload: any) => {
          const rec = payload.new as {
            message_id: string;
            user_id: string;
            delivered_at: string | null;
            read_at: string | null;
          };
          if (rec.user_id === currentUserId) return;
          if (!messageIdsRef.current.has(rec.message_id)) return;
          setMessages((prev) =>
            prev.map((m) => {
              const mine = currentUserId
                ? m.sender_id === currentUserId
                : false;
              if (!mine || m.id !== rec.message_id) return m;
              return {
                ...m,
                delivered_at: rec.delivered_at ?? m.delivered_at ?? null,
                read_at: rec.read_at ?? m.read_at ?? null,
              };
            })
          );
        }
      )
      // Broadcast from recipient to prompt a light refresh of receipts
      .on("broadcast", { event: "read-updated" }, async () => {
        try {
          const res = await fetch(`/api/messages/${conversationId}`);
          const data = await res.json();
          if (res.ok && data?.messages) {
            setMessages(data.messages);
          }
        } catch (e) {
          console.warn("refresh after broadcast failed", e);
        }
      })
      .subscribe();

    return () => {
      try {
        channelRef.current = null;
        supa.removeChannel(channel);
      } catch {}
    };
  }, [conversationId, currentUserId]);

  const handleSend = async () => {
    const text = newMessage.trim();
    if (!text || !conversationId) return;

    // optimistic append
    const tempId = `temp-${Date.now()}`;
    const optimistic: Message = {
      id: tempId,
      body: text,
      created_at: new Date().toISOString(),
      sender_id: currentUserId || "me",
      delivered_at: null,
      read_at: null,
      failed: false,
      profiles: {
        profile_title: null,
        avatar_url: null,
      },
    };

    setMessages((prev) => [...prev, optimistic]);
    setNewMessage("");

    // scroll after paint
    requestAnimationFrame(() => {
      messagesEndRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "end",
      });
    });

    try {
      const res = await fetch(`/api/messages/${conversationId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: text }),
      });

      const data = await res.json();

      if (!res.ok || !data?.message) {
        throw new Error(data?.error || "Failed to send message");
      }

      // swap optimistic with server message
      setMessages((prev) => {
        const server = data.message as Message;
        // remove any existing instance of the server id (in case realtime INSERT added it first)
        let next = prev.filter((m) => m.id !== server.id);
        // replace the optimistic message with the server one
        let replaced = false;
        next = next.map((m) => {
          if (m.id === tempId) {
            replaced = true;
            return server;
          }
          return m;
        });
        // if the optimistic message isn't present anymore, append server once
        if (!replaced) next.push(server);
        return next;
      });
      requestAnimationFrame(() => {
        messagesEndRef.current?.scrollIntoView({
          behavior: "smooth",
          block: "end",
        });
      });
    } catch (err: any) {
      // mark optimistic as failed (keeps it visible with single check + 'Failed')
      setMessages((prev) =>
        prev.map((m) => (m.id === tempId ? { ...m, failed: true } : m))
      );
      setError(err?.message || "Failed to send message");
    }
  };

  return (
    <div className="h-full bg-background overflow-hidden">
      <Header
        messages={messages}
        currentUserId={currentUserId}
        hasMounted={hasMounted}
      />

      {/* scrollable messages, padded for header + footer */}
      <main
        className="h-full overflow-y-auto px-4"
        style={{
          paddingTop: "70px",
          paddingBottom: "120px",
        }}
      >
        <div className="space-y-3">
          {error ? <p className="text-sm text-red-500">{error}</p> : null}

          {loading ? (
            <p className="text-sm text-muted-foreground">Loading messages…</p>
          ) : messages.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No messages yet. Say hi 👋
            </p>
          ) : (
            <Conversation
              messages={messages}
              currentUserId={currentUserId}
              hasMounted={hasMounted}
              messagesEndRef={messagesEndRef}
            />
          )}
        </div>
      </main>

      {/* fixed message bar ABOVE the 56px AppShell bar */}
      <footer
        className="fixed left-0 right-0 z-40 bg-card/95 backdrop-blur supports-backdrop-filter:bg-card/80 text-card-foreground px-3 py-3"
        style={{ bottom: "53px" }}
      >
        <MessageBar
          value={newMessage}
          onChange={setNewMessage}
          onSend={handleSend}
          onShareClick={() => setShareOpen(true)}
        />
      </footer>
      <Drawer open={shareOpen} onOpenChange={setShareOpen}>
        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle>Share to conversation</DrawerTitle>
          </DrawerHeader>
          <div className="px-4 pb-4">
            <div className="grid grid-cols-3 gap-4">
              <button
                type="button"
                className="flex flex-col items-center justify-center gap-2 rounded-md bg-card text-card-foreground py-3"
                onClick={() => {
                  setShareOpen(false);
                  setPhotosOpen(true);
                }}
                aria-label="Share photos"
              >
                <Image className="h-6 w-6" />
                <span className="text-xs">Photos</span>
              </button>
              <button
                type="button"
                className="flex flex-col items-center justify-center gap-2 rounded-md bg-card text-card-foreground py-3"
                onClick={() => setShareOpen(false)}
                aria-label="Share location"
              >
                <MapPin className="h-6 w-6" />
                <span className="text-xs">Location</span>
              </button>
              <button
                type="button"
                className="flex flex-col items-center justify-center gap-2 rounded-md bg-card text-card-foreground py-3"
                onClick={() => setShareOpen(false)}
                aria-label="Share my card"
              >
                <IdCard className="h-6 w-6" />
                <span className="text-xs">My card</span>
              </button>
              <button
                type="button"
                className="flex flex-col items-center justify-center gap-2 rounded-md bg-card text-card-foreground py-3"
                onClick={() => setShareOpen(false)}
                aria-label="Share profile"
              >
                <User className="h-6 w-6" />
                <span className="text-xs">Profile</span>
              </button>
              <button
                type="button"
                className="flex flex-col items-center justify-center gap-2 rounded-md bg-card text-card-foreground py-3"
                onClick={() => setShareOpen(false)}
                aria-label="Share group"
              >
                <Users className="h-6 w-6" />
                <span className="text-xs">Group</span>
              </button>
            </div>
          </div>
          <DrawerFooter />
        </DrawerContent>
      </Drawer>
      <Drawer open={photosOpen} onOpenChange={setPhotosOpen}>
        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle>Send photos</DrawerTitle>
          </DrawerHeader>
          <div className="px-4 pb-4">
            <div className="flex w-full flex-col gap-3">
              <Item
                variant="outline"
                onClick={() => setPhotosOpen(false)}
                className="bg-card border-0"
              >
                <ItemMedia variant="icon">
                  <ImageIcon className="h-5 w-5" />
                </ItemMedia>
                <ItemContent>
                  <ItemTitle>Send a photo</ItemTitle>
                  <ItemDescription>Send image from your device</ItemDescription>
                </ItemContent>
              </Item>

              <div className="mt-2">
                <h3 className="px-1 mb-2 text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Recently sent
                </h3>

                {/* Horizontal scroll list */}
                <div className="flex gap-3 -mx-4 px-4 overflow-x-auto pb-1">
                  {Array.from({ length: 10 }).map((_, i) => (
                    <div
                      key={i}
                      className="h-24 w-24 shrink-0 rounded-md border bg-muted flex items-center justify-center text-muted-foreground"
                      aria-label={`Recent photo ${i + 1}`}
                    >
                      <ImageIcon className="h-6 w-6 opacity-70" />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
          <DrawerFooter />
        </DrawerContent>
      </Drawer>
    </div>
  );
}
