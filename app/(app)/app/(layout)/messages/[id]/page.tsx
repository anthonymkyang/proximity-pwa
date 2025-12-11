"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/utils/supabase/client";
import {
  Plus,
  ArrowUp,
  ArrowLeft,
  MoreVertical,
  UserRound,
  UserPlus,
  Pin,
  Shield,
  Flag,
} from "lucide-react";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupTextarea,
} from "@/components/ui/input-group";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { getAvatarProxyUrl } from "@/lib/profiles/getAvatarProxyUrl";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Message = {
  id: string;
  body: string;
  sender_id: string;
  created_at: string;
  profiles?: {
    profile_title?: string | null;
    avatar_url?: string | null;
  } | null;
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
  const [participantName, setParticipantName] = useState(
    search.get("name") ?? "Contact"
  );
  const [participantAvatar, setParticipantAvatar] = useState<string | null>(
    null
  );
  const participantInitials = useMemo(() => {
    return (
      participantName
        .split(" ")
        .map((word) => word[0])
        .join("")
        .slice(0, 2)
        .toUpperCase() || "C"
    );
  }, [participantName]);

  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [otherUserId, setOtherUserId] = useState<string | null>(null);
  const [contactConnectionId, setContactConnectionId] = useState<string | null>(
    null
  );
  const [pinConnectionId, setPinConnectionId] = useState<string | null>(null);
  const [contactDrawerOpen, setContactDrawerOpen] = useState(false);
  const [contactNickname, setContactNickname] = useState("");
  const [contactWhatsApp, setContactWhatsApp] = useState("");
  const [contactTelegram, setContactTelegram] = useState("");
  const [savingContact, setSavingContact] = useState(false);
  const [pinning, setPinning] = useState(false);
  const [loadingConnections, setLoadingConnections] = useState(false);
  const [contactError, setContactError] = useState<string | null>(null);

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
          const apiName =
            data.other?.profile_title ??
            (data.messages?.[0]?.profiles?.profile_title ?? null);
          const apiOtherId = data.other?.user_id ?? null;
          if (apiOtherId) setOtherUserId(apiOtherId);
          if (apiName) {
            setParticipantName(apiName);
          }
          const rawAvatar =
            data.other?.avatar_url ??
            data.messages?.find((m: Message) => m.profiles?.avatar_url)
              ?.profiles?.avatar_url ??
            null;
          const proxied = getAvatarProxyUrl(rawAvatar);
          if (proxied) {
            setParticipantAvatar(proxied);
          }
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

  async function createContact() {
    if (contactConnectionId) {
      setContactDrawerOpen(false);
      return;
    }
    if (!otherUserId) {
      setContactError("Missing user.");
      return;
    }
    setSavingContact(true);
    setContactError(null);
    try {
      const res = await fetch("/api/connections", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "contact",
          target_profile_id: otherUserId,
          nickname: contactNickname,
          whatsapp: contactWhatsApp,
          telegram: contactTelegram,
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(body?.error || "Unable to add contact");
      }
      setContactConnectionId(body?.connection?.id ?? null);
      setContactDrawerOpen(false);
    } catch (err: any) {
      setContactError(err?.message || "Failed to add contact");
    } finally {
      setSavingContact(false);
    }
  }

  async function handlePinToggle() {
    if (!otherUserId || pinning) return;
    setPinning(true);
    try {
      if (pinConnectionId) {
        await fetch(`/api/connections/${pinConnectionId}`, { method: "DELETE" });
        setPinConnectionId(null);
      } else {
        const res = await fetch("/api/connections", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            type: "pin",
            target_profile_id: otherUserId,
            nickname: participantName,
          }),
        });
        const body = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(body?.error || "Unable to pin profile");
        }
        setPinConnectionId(body?.connection?.id ?? null);
      }
    } catch {
      // ignore errors for now
    } finally {
      setPinning(false);
    }
  }

  // Load connection status for this participant
  useEffect(() => {
    if (!otherUserId) return;
    setLoadingConnections(true);
    fetch(`/api/connections?target_profile_id=${otherUserId}`)
      .then((res) => res.json())
      .then((body) => {
        const list = body?.connections ?? [];
        const contact = list.find(
          (c: any) =>
            c.type === "contact" &&
            ((Array.isArray(c.connection_contacts)
              ? c.connection_contacts[0]?.profile_id
              : c.connection_contacts?.profile_id) === otherUserId)
        );
        const pin = list.find(
          (c: any) =>
            c.type === "pin" &&
            ((Array.isArray(c.connection_pins)
              ? c.connection_pins[0]?.pinned_profile_id
              : c.connection_pins?.pinned_profile_id) === otherUserId)
        );
        setContactConnectionId(contact?.id ?? null);
        setPinConnectionId(pin?.id ?? null);
        if (contact) {
          const detail = Array.isArray(contact.connection_contacts)
            ? contact.connection_contacts[0]
            : contact.connection_contacts;
          setContactNickname((prev) => detail?.display_name || prev || participantName);
          const meta = detail?.metadata || {};
          setContactWhatsApp(meta.whatsapp || "");
          setContactTelegram(meta.telegram || "");
        }
      })
      .catch(() => {
        // ignore
      })
      .finally(() => setLoadingConnections(false));
  }, [otherUserId]);

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

  const hasText = newMessage.trim().length > 0;

  return (
    <div className="h-svh min-h-svh bg-background text-foreground flex flex-col">
      <div className="bg-background/60 supports-[backdrop-filter]:bg-background/50 backdrop-blur-md px-3 py-2 flex items-center justify-between gap-3 border-none">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon-sm"
            className="rounded-full"
            aria-label="Back"
            onClick={() => router.back()}
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex items-center gap-3">
            <Avatar className="h-12 w-12">
              <AvatarImage
                alt={participantName}
                src={participantAvatar ?? undefined}
              />
              <AvatarFallback>{participantInitials}</AvatarFallback>
            </Avatar>
            <div className="leading-tight">
              <div className="text-sm font-medium">{participantName}</div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span className="size-2 rounded-full bg-green-500" />
                <span>Online</span>
              </div>
            </div>
          </div>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon-sm"
              className="rounded-full"
              aria-label="Conversation actions"
            >
              <MoreVertical className="h-5 w-5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuItem>
              <UserRound className="h-4 w-4" />
              View profile
            </DropdownMenuItem>
            <DropdownMenuItem
              disabled={loadingConnections}
              onSelect={(e) => {
                e.preventDefault();
                setContactDrawerOpen(true);
                if (!contactNickname && participantName) {
                  setContactNickname(participantName);
                }
              }}
            >
              <UserPlus className="h-4 w-4" />
              {contactConnectionId ? "View contact" : "Add contact"}
            </DropdownMenuItem>
            <DropdownMenuItem
              disabled={loadingConnections || pinning || !otherUserId}
              onSelect={(e) => {
                e.preventDefault();
                void handlePinToggle();
              }}
            >
              <Pin className="h-4 w-4" />
              {pinConnectionId ? "Unpin" : "Pin profile"}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem variant="destructive">
              <Shield className="h-4 w-4" />
              Block contact
            </DropdownMenuItem>
            <DropdownMenuItem variant="destructive">
              <Flag className="h-4 w-4" />
              Report user
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
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
                  isMe
                    ? "bg-primary text-white rounded-br-none"
                    : "bg-muted text-foreground rounded-bl-none"
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
                    hour12: false,
                  })}
                </div>
              </div>
            </div>
          );
        })}
        <div ref={endRef} style={{ height: 0 }} />
      </div>
      <div className="bg-card/80 backdrop-blur px-3 py-2">
        <InputGroup className="w-full border-0 bg-transparent shadow-none !bg-transparent has-[[data-slot=input-group-control]:focus-visible]:ring-0 has-[[data-slot=input-group-control]:focus-visible]:border-0">
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
            className="text-sm sm:text-base !min-h-0 !py-1.5 !border-0 !bg-transparent shadow-none focus:outline-none focus-visible:outline-none focus-visible:ring-0 focus-visible:border-0"
          />

          <InputGroupAddon align="inline-end" className="pr-1">
            <InputGroupButton
              size="icon-sm"
              variant="default"
              className="rounded-full bg-primary text-primary-foreground hover:bg-primary/90"
              aria-label="Send"
              disabled={!hasText}
              onClick={handleSend}
            >
              <ArrowUp className="h-4 w-4" />
            </InputGroupButton>
          </InputGroupAddon>
        </InputGroup>
      </div>

      {/* Contact drawer */}
      <Drawer open={contactDrawerOpen} onOpenChange={setContactDrawerOpen}>
        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle>{contactConnectionId ? "View contact" : "Add contact"}</DrawerTitle>
            <DrawerDescription>
              Save their details so you can find them later.
            </DrawerDescription>
          </DrawerHeader>
          <div className="space-y-4 px-4 pb-5">
            <div className="space-y-2">
              <Label htmlFor="contact-nickname">Nickname</Label>
              <Input
                id="contact-nickname"
                value={contactNickname}
                onChange={(e) => setContactNickname(e.target.value)}
                placeholder={participantName || "Nickname"}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="contact-whatsapp">WhatsApp</Label>
              <Input
                id="contact-whatsapp"
                value={contactWhatsApp}
                onChange={(e) => setContactWhatsApp(e.target.value)}
                placeholder="+1 555 123 4567"
                inputMode="tel"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="contact-telegram">Telegram</Label>
              <Input
                id="contact-telegram"
                value={contactTelegram}
                onChange={(e) => setContactTelegram(e.target.value)}
                placeholder="@username"
              />
            </div>
            {contactError ? (
              <p className="text-sm text-destructive">{contactError}</p>
            ) : null}
            <div className="flex justify-end gap-2">
              <Button
                variant="ghost"
                onClick={() => setContactDrawerOpen(false)}
              >
                Cancel
              </Button>
              <Button
                onClick={() => void createContact()}
                disabled={savingContact || !otherUserId}
              >
                {savingContact ? "Saving..." : contactConnectionId ? "Update" : "Save contact"}
              </Button>
            </div>
          </div>
        </DrawerContent>
      </Drawer>
    </div>
  );
}
