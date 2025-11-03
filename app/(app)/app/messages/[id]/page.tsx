"use client";

import { useEffect, useState, useRef, useMemo } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { createClient } from "@/utils/supabase/client";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  MoreVertical,
  ShieldAlert,
  Ban,
  OctagonAlert,
  Plus,
  ArrowUp,
  Check,
  CheckCheck,
} from "lucide-react";
import { Button as ShadButton } from "@/components/ui/button";

import BackButton from "@/components/ui/back-button";

import TextareaAutosize from "react-textarea-autosize";

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

// --- Local MessageInput component (inline) ---
function MessageInput({
  value,
  onChange,
  onSend,
  placeholder = "Write a message…",
  maxRows = 5,
  disabled,
}: {
  value: string;
  onChange: (v: string) => void;
  onSend: () => void;
  placeholder?: string;
  maxRows?: number;
  disabled?: boolean;
}) {
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      onSend();
    }
  };

  return (
    <div className="relative w-full max-w-full overflow-hidden flex items-center gap-2">
      <Button
        type="button"
        variant="outline"
        size="icon"
        className="rounded-full h-9 w-9 shrink-0"
      >
        <Plus className="h-5 w-5" />
      </Button>
      <div className="relative flex-1">
        <TextareaAutosize
          minRows={1}
          maxRows={maxRows}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          data-slot="input-group-control"
          className="block w-full resize-none rounded-full bg-transparent px-4 pr-20 py-2 text-base leading-5 outline-none md:text-sm field-sizing-content min-h-0 whitespace-pre-wrap wrap-break-word"
          style={{ overflow: "hidden" }}
        />
        <Button
          type="button"
          onClick={onSend}
          size="icon"
          disabled={disabled || !value.trim()}
          className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full h-8 w-8 shrink-0"
        >
          <ArrowUp className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
// --- End local MessageInput ---

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
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  // Share the realtime channel across effects so we can broadcast after PATCH
  const channelRef = useRef<any>(null);
  // Track message IDs for efficient lookup in realtime handlers
  const messageIdsRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    messageIdsRef.current = new Set(messages.map((m) => m.id));
  }, [messages]);

  const isGroup = useMemo(() => {
    if (!messages || messages.length === 0) return false;
    const others = new Set(
      messages
        .filter((m) => m.sender_id && m.sender_id !== currentUserId)
        .map((m) => m.sender_id)
    );
    return others.size > 1;
  }, [messages, currentUserId]);

  // Determine the other participant (for 1:1) and resolve their avatar URL for the header
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
      setMessages((prev) =>
        prev.map((m) => (m.id === tempId ? data.message : m))
      );

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
      {/* fixed top bar */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-background border-b px-4 py-3 flex items-center gap-3">
        <BackButton />
        {!isGroup && headerAvatarUrl ? (
          <img
            src={headerAvatarUrl}
            alt={otherProfile?.profile_title || "User avatar"}
            className="w-8 h-8 rounded-full border border-muted object-cover"
            onError={(e) => {
              (e.currentTarget as HTMLImageElement).src =
                "/avatar-fallback.png";
            }}
          />
        ) : null}
        <div className="flex-1">
          <h1 className="text-sm font-semibold">
            {messages.length > 0
              ? messages.find(
                  (m) =>
                    m.profiles?.profile_title && m.sender_id !== currentUserId
                )?.profiles?.profile_title ?? "Conversation"
              : "Conversation"}
          </h1>
          <p className="text-[10px] text-green-600">Online now</p>
        </div>
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
      </header>

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
            messages.map((m, index) => {
              const mine = currentUserId
                ? m.sender_id === currentUserId
                : false;
              // Resolve avatar URL from Supabase Storage if it's a key like `userId/filename.jpg`
              let resolvedAvatarUrl: string | null = null;
              if (!mine && m.profiles?.avatar_url) {
                const raw = m.profiles.avatar_url;
                if (raw.startsWith("http")) {
                  resolvedAvatarUrl = raw;
                } else {
                  const supa = createClient();
                  const bucket =
                    process.env.NEXT_PUBLIC_SUPABASE_AVATARS_BUCKET ||
                    "avatars";
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
                  {isGroup && !mine && m.profiles?.avatar_url ? (
                    <img
                      src={resolvedAvatarUrl ?? ""}
                      alt={m.profiles.profile_title || "User avatar"}
                      className="w-6 h-6 rounded-full border border-muted object-cover self-start"
                      onError={(e) => {
                        (e.currentTarget as HTMLImageElement).src =
                          "/avatar-fallback.png";
                      }}
                    />
                  ) : isGroup && !mine ? (
                    <div className="w-6 h-6 rounded-full bg-muted border border-muted self-start" />
                  ) : null}
                  <div
                    className={
                      mine
                        ? "max-w-[75%] rounded-lg px-3 py-2 text-sm bg-linear-to-br from-blue-500 via-blue-600 to-indigo-500 text-white"
                        : "max-w-[75%] rounded-lg px-3 py-2 text-sm bg-muted text-foreground"
                    }
                  >
                    {isGroup && !mine && m.profiles?.profile_title ? (
                      <p className="text-xs font-medium mb-1">
                        {m.profiles.profile_title}
                      </p>
                    ) : null}
                    <p>{m.body}</p>
                    <div className="flex items-center justify-end gap-1 mt-1">
                      <p className="text-[10px] opacity-60 text-right">
                        {new Date(m.created_at).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
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
            })
          )}
          <div ref={messagesEndRef} />
        </div>
      </main>

      {/* fixed message bar ABOVE the 56px AppShell bar */}
      <footer
        className="fixed left-0 right-0 z-9999 bg-background border-t px-3 py-3"
        style={{ bottom: "50px" }}
      >
        <MessageInput
          value={newMessage}
          onChange={setNewMessage}
          onSend={handleSend}
        />
      </footer>
    </div>
  );
}
