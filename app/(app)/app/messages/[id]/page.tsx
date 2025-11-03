"use client";

import { useEffect, useState, useRef } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { createClient } from "@/utils/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MoreVertical, ShieldAlert, Ban, OctagonAlert } from "lucide-react";
import { Button as ShadButton } from "@/components/ui/button";

import BackButton from "@/components/ui/back-button";

import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
  InputGroupText,
  InputGroupTextarea,
} from "@/components/ui/input-group";

type Message = {
  id: string;
  body: string;
  created_at: string;
  sender_id: string;
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
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

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

  const handleSend = async () => {
    const text = newMessage.trim();
    if (!text || !conversationId) return;

    const res = await fetch(`/api/messages/${conversationId}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ body: text }),
    });

    const data = await res.json();
    if (res.ok && data.message) {
      setMessages((prev) => [...prev, data.message]);
      setNewMessage("");
    } else if (!res.ok) {
      setError(data.error || "Failed to send message");
    }
  };

  return (
    <div className="min-h-[calc(100dvh-56px)] bg-background">
      {/* fixed top bar */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-background border-b px-4 py-3 flex items-center gap-3">
        <BackButton />
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
      <main className="px-4 space-y-3 pt-[70px] pb-[70px]">
        {error ? <p className="text-sm text-red-500">{error}</p> : null}

        {loading ? (
          <p className="text-sm text-muted-foreground">Loading messages…</p>
        ) : messages.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No messages yet. Say hi 👋
          </p>
        ) : (
          messages.map((m) => {
            const mine = currentUserId ? m.sender_id === currentUserId : false;
            return (
              <div
                key={m.id}
                className={`flex items-end gap-2 ${
                  mine ? "justify-end" : "justify-start"
                }`}
              >
                {!mine && m.profiles?.avatar_url ? (
                  <img
                    src={
                      m.profiles.avatar_url.startsWith("http")
                        ? m.profiles.avatar_url
                        : `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/avatars/${m.profiles.avatar_url}`
                    }
                    alt={m.profiles.profile_title || "User avatar"}
                    className="w-6 h-6 rounded-full border border-muted object-cover"
                  />
                ) : !mine ? (
                  <div className="w-6 h-6 rounded-full bg-muted border border-muted" />
                ) : null}
                <div
                  className={
                    mine
                      ? "max-w-[75%] rounded-lg px-3 py-2 text-sm bg-linear-to-br from-blue-500 via-blue-600 to-indigo-500 text-white"
                      : "max-w-[75%] rounded-lg px-3 py-2 text-sm bg-muted text-foreground"
                  }
                >
                  <p>{m.body}</p>
                  <p className="text-[10px] opacity-60 mt-1">
                    {new Date(m.created_at).toLocaleTimeString()}
                  </p>
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </main>

      {/* fixed message bar ABOVE the 56px AppShell bar */}
      <footer className="fixed left-0 right-0 bottom-[54px] z-9999 bg-background border-t px-3 py-3">
        <InputGroup className="w-full relative">
          <InputGroupInput
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            placeholder="Write a message…"
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                handleSend();
              }
            }}
            className="rounded-full pr-16"
          />
          <InputGroupButton
            onClick={handleSend}
            variant="default"
            className="rounded-full"
          >
            Send
          </InputGroupButton>
        </InputGroup>
      </footer>
    </div>
  );
}
