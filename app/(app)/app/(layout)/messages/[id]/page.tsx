"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/utils/supabase/client";
import { Plus, ArrowUp } from "lucide-react";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupTextarea,
} from "@/components/ui/input-group";

type Message = {
  id: string;
  body: string;
  sender_id: string;
  created_at: string;
};

export default function ConversationPage() {
  const params = useParams();
  const search = useSearchParams();
  const router = useRouter();
  const supabase = useRef(createClient());
  const endRef = useRef<HTMLDivElement | null>(null);

  const routeId = Array.isArray((params as any).id)
    ? (params as any).id[0]
    : (params as any).id ?? null;
  const queryId = search.get("id");
  const conversationId = routeId ?? queryId ?? null;

  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  // load initial messages + current user
  useEffect(() => {
    const load = async () => {
      if (!conversationId) return;
      try {
        const {
          data: { user },
        } = await supabase.current.auth.getUser();
        setCurrentUserId(user?.id ?? null);

        const res = await fetch(`/api/messages/${conversationId}`);
        const data = await res.json();
        if (res.ok) {
          setMessages(
            (data.messages as Message[]).sort(
              (a, b) =>
                new Date(a.created_at).getTime() -
                new Date(b.created_at).getTime()
            )
          );
        }
      } catch {
        // ignore
      }
    };
    load();
  }, [conversationId]);

  // simple realtime subscription
  useEffect(() => {
    if (!conversationId) return;
    const channel = supabase.current
      .channel(`conversation:${conversationId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `conversation_id=eq.${conversationId}`,
        },
        (payload: any) => {
          const msg = payload.new as Message;
          setMessages((prev) => {
            if (prev.some((m) => m.id === msg.id)) return prev;
            return [...prev, msg].sort(
              (a, b) =>
                new Date(a.created_at).getTime() -
                new Date(b.created_at).getTime()
            );
          });
        }
      );
    channel.subscribe();
    return () => {
      try {
        supabase.current.removeChannel(channel);
      } catch {}
    };
  }, [conversationId]);

  // scroll to bottom on new messages
  useEffect(() => {
    if (!endRef.current) return;
    endRef.current.scrollIntoView({ block: "start", behavior: "smooth" });
  }, [messages]);

  const handleSend = async () => {
    const text = newMessage.trim();
    if (!text || !conversationId) return;
    setNewMessage("");
    try {
      await fetch(`/api/messages/${conversationId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: text }),
      });
    } catch {
      // ignore
    }
  };

  // redirect if conversation missing (optional)
  useEffect(() => {
    if (!conversationId) return;
    if (!messages.length) return;
    // noop route protection; keep simple
  }, [conversationId, messages.length]);

  return (
    <div className="h-svh min-h-svh bg-background text-foreground flex flex-col">
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.map((m) => {
          const isMe =
            currentUserId != null ? m.sender_id === currentUserId : false;
          return (
            <div
              key={m.id}
              className={`flex ${isMe ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`rounded-lg px-3 py-2 max-w-[75%] sm:max-w-[65%] lg:max-w-[55%] ${
                  isMe ? "bg-primary text-white" : "bg-muted text-foreground"
                }`}
              >
                <p className="text-sm leading-relaxed wrap-break-word">
                  {m.body}
                </p>
                <div
                  className={`mt-1 text-xs ${
                    isMe ? "text-blue-100" : "text-muted-foreground"
                  }`}
                >
                  {new Date(m.created_at).toLocaleTimeString(undefined, {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </div>
              </div>
            </div>
          );
        })}
        <div ref={endRef} style={{ height: 0 }} />
      </div>
      <div className="bg-card/80 backdrop-blur px-3 py-3">
        <InputGroup className="w-full border-none shadow-none bg-transparent">
          <InputGroupAddon align="inline-start" className="pl-1">
            <InputGroupButton
              size="icon-sm"
              variant="ghost"
              className="rounded-full bg-muted text-foreground hover:bg-muted/80"
              aria-label="Add"
            >
              <Plus className="h-4 w-4" />
            </InputGroupButton>
          </InputGroupAddon>

          <InputGroupTextarea
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            placeholder="Write a message..."
            minRows={1}
            maxRows={6}
            className="text-sm sm:text-base bg-transparent"
          />

          <InputGroupAddon align="inline-end" className="pr-1">
            <InputGroupButton
              size="icon-sm"
              variant="default"
              className="rounded-full bg-primary text-primary-foreground hover:bg-primary/90"
              aria-label="Send"
              onClick={handleSend}
            >
              <ArrowUp className="h-4 w-4" />
            </InputGroupButton>
          </InputGroupAddon>
        </InputGroup>
      </div>
    </div>
  );
}
