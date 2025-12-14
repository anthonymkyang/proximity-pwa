"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
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
  Check,
  CheckCheck,
  Reply,
  Copy,
  Info,
  Languages,
  Trash2,
  X,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupTextarea,
} from "@/components/ui/input-group";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
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
import { AnimatedEmoji } from "@/components/emoji/AnimatedEmoji";

type Message = {
  id: string;
  body: string;
  sender_id: string;
  created_at: string;
  conversation_id?: string;
  reply_to_id?: string | null;
  reply_to_body?: string | null;
  reply_to_sender_id?: string | null;
  delivered_at?: string | null;
  read_at?: string | null;
  my_reaction?: string | null;
  reaction_counts?: Record<string, number>;
  profiles?: {
    profile_title?: string | null;
    avatar_url?: string | null;
  } | null;
};

const sortUniqueMessages = (list: Message[]) => {
  const byId = new Map<string, Message>();
  list.forEach((m) => {
    if (!byId.has(m.id)) {
      byId.set(m.id, m);
    }
  });
  return Array.from(byId.values()).sort(
    (a, b) =>
      new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  );
};

const REACTIONS = [
  { type: "heart", emoji: "❤️", src: "/emoji/red-heart.json" },
  { type: "fire", emoji: "🔥", src: "/emoji/fire.json" },
  {
    type: "imp",
    emoji: "😈",
    src: "/emoji/imp-smile.json",
    restFrameFraction: 0.5,
  },
  { type: "laugh", emoji: "😂", src: "/emoji/laughing.json" },
  { type: "surprised", emoji: "😮", src: "/emoji/surprised.json" },
];

const reactionMeta = REACTIONS.reduce<
  Record<string, (typeof REACTIONS)[number]>
>((acc, r) => {
  acc[r.type] = r;
  return acc;
}, {});

const normalizeMessage = (m: Message): Message => ({
  ...m,
  reaction_counts: m.reaction_counts ?? {},
  my_reaction: m.my_reaction ?? null,
  conversation_id: m.conversation_id,
});

const PAGE_SIZE = 30;
const LONG_PRESS_MS = 260;

export default function ConversationPage() {
  const params = useParams();
  const search = useSearchParams();
  const router = useRouter();
  const supabase = useRef(createClient());
  const endRef = useRef<HTMLDivElement | null>(null);
  const reactionMenuRef = useRef<HTMLDivElement | null>(null);
  const actionMenuRef = useRef<HTMLDivElement | null>(null);
  const convoChannelRef = useRef<ReturnType<
    ReturnType<typeof createClient>["channel"]
  > | null>(null);
  const reactionsChannelRef = useRef<ReturnType<
    ReturnType<typeof createClient>["channel"]
  > | null>(null);

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
  const [participantProfileTitle, setParticipantProfileTitle] = useState<
    string | null
  >(null);
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
  const [reactionTargetId, setReactionTargetId] = useState<string | null>(null);
  const [reactionError, setReactionError] = useState<string | null>(null);
  const messageIdsRef = useRef<Set<string>>(new Set());
  const currentUserIdRef = useRef<string | null>(null);
  const pendingReceiptsRef = useRef<
    Record<string, { delivered_at: string | null; read_at: string | null }>
  >({});
  const receiptsChannelRef = useRef<ReturnType<
    ReturnType<typeof createClient>["channel"]
  > | null>(null);
  const deliveryAttemptRef = useRef<Set<string>>(new Set());
  const typingBroadcastedRef = useRef(false);
  const typingSelfTimerRef = useRef<NodeJS.Timeout | null>(null);
  const typingTimersRef = useRef<Record<string, NodeJS.Timeout>>({});
  const [typingUsers, setTypingUsers] = useState<Set<string>>(new Set());
  const [initialLoading, setInitialLoading] = useState(true);
  const listRef = useRef<HTMLDivElement | null>(null);
  const loadingOlderRef = useRef(false);
  const shouldAutoScrollRef = useRef(true);
  const messageElsRef = useRef<Record<string, HTMLElement | null>>({});
  const initialScrollDoneRef = useRef(false);
  const [visibleMessages, setVisibleMessages] = useState<Set<string>>(
    new Set()
  );
  const [hasMore, setHasMore] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [replyTarget, setReplyTarget] = useState<Message | null>(null);
  const pendingReplyRef = useRef<{
    reply_to_id: string | null;
    reply_to_body: string | null;
    reply_to_sender_id: string | null;
  } | null>(null);
  const prevHeightRef = useRef<number | null>(null);
  const prevScrollTopRef = useRef<number | null>(null);
  const pendingPrependAdjustRef = useRef(false);
  const [focusedMessageId, setFocusedMessageId] = useState<string | null>(null);
  const [focusedMessageRect, setFocusedMessageRect] = useState<DOMRect | null>(
    null
  );
  const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null);
  const longPressTimerRef = useRef<NodeJS.Timeout | null>(null);
  const longPressTargetRef = useRef<string | null>(null);
  const prevBodyOverflowRef = useRef<string | null>(null);
  const overlayTimerRef = useRef<NodeJS.Timeout | null>(null);
  const copiedTimerRef = useRef<NodeJS.Timeout | null>(null);
  const reactionErrorTimerRef = useRef<NodeJS.Timeout | null>(null);
  const [floatingReactions, setFloatingReactions] = useState<
    Array<{
      id: string;
      messageId: string;
      type: string;
      timestamp: number;
    }>
  >([]);

  const copyToClipboard = useCallback(async (text: string) => {
    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
        return true;
      }
    } catch {
      // ignore and fallback
    }
    try {
      const el = document.createElement("textarea");
      el.value = text;
      el.style.position = "fixed";
      el.style.opacity = "0";
      document.body.appendChild(el);
      el.focus();
      el.select();
      const ok = document.execCommand("copy");
      document.body.removeChild(el);
      return ok;
    } catch {
      return false;
    }
  }, []);

  const startLongPress = useCallback((id: string) => {
    console.log("startLongPress called for message:", id);
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
    }
    longPressTargetRef.current = id;
    longPressTimerRef.current = setTimeout(() => {
      console.log("Long press timer fired for message:", id);
      const messageEl = messageElsRef.current[id];
      if (messageEl) {
        const rect = messageEl.getBoundingClientRect();
        setFocusedMessageRect(rect);
        setFocusedMessageId(id);
      }
      console.log("Setting reactionTargetId to:", id);
      setReactionTargetId(id);
      longPressTargetRef.current = null;
      longPressTimerRef.current = null;
    }, LONG_PRESS_MS);
  }, []);

  const cancelLongPress = useCallback(() => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
    longPressTargetRef.current = null;
  }, []);

  const applyReactionLocal = useCallback(
    (
      messageId: string,
      actorUserId: string | null,
      prevType: string | null,
      nextType: string | null
    ) => {
      if (!messageId) return;
      setMessages((prev) =>
        prev.map((m) => {
          if (m.id !== messageId) return m;
          const counts = { ...(m.reaction_counts ?? {}) };
          if (prevType && counts[prevType]) {
            const nextCount = Math.max(0, (counts[prevType] ?? 1) - 1);
            if (nextCount <= 0) delete counts[prevType];
            else counts[prevType] = nextCount;
          }
          if (nextType) {
            counts[nextType] = (counts[nextType] || 0) + 1;
          }
          const isMe =
            actorUserId != null && actorUserId === currentUserIdRef.current;
          return {
            ...m,
            reaction_counts: counts,
            my_reaction: isMe ? nextType ?? null : m.my_reaction ?? null,
          };
        })
      );
    },
    []
  );

  const showReactionError = useCallback((msg: string) => {
    setReactionError(msg);
    if (reactionErrorTimerRef.current) {
      clearTimeout(reactionErrorTimerRef.current);
    }
    reactionErrorTimerRef.current = setTimeout(() => {
      setReactionError(null);
      reactionErrorTimerRef.current = null;
    }, 4000);
  }, []);

  // Derive other user id from messages if missing (e.g., after refresh)
  useEffect(() => {
    if (otherUserId || !currentUserId) return;
    const firstOther = messages.find(
      (m) => m.sender_id && m.sender_id !== currentUserId
    );
    if (firstOther?.sender_id) {
      setOtherUserId(firstOther.sender_id);
    }
  }, [messages, currentUserId, otherUserId]);

  useEffect(() => {
    currentUserIdRef.current = currentUserId;
  }, [currentUserId]);

  useEffect(() => {
    if (!reactionTargetId) return;
    const handleOutside = (e: Event) => {
      const reactionEl = reactionMenuRef.current;
      const actionEl = actionMenuRef.current;
      // Don't close if clicking inside either menu
      if (reactionEl && reactionEl.contains(e.target as Node)) return;
      if (actionEl && actionEl.contains(e.target as Node)) return;
      setReactionTargetId(null);
      setFocusedMessageId(null);
      setFocusedMessageRect(null);
      cancelLongPress();
    };
    document.addEventListener("pointerdown", handleOutside, true);
    return () =>
      document.removeEventListener("pointerdown", handleOutside, true);
  }, [reactionTargetId, cancelLongPress]);


  useEffect(() => {
    messageIdsRef.current = new Set(messages.map((m) => m.id));
  }, [messages]);

  // Fetch new messages when user returns to tab
  useEffect(() => {
    if (!conversationId) return;

    const handleVisibilityChange = async () => {
      if (document.visibilityState === 'visible') {
        console.log("Tab became visible, fetching new messages");
        try {
          const res = await fetch(`/api/messages/${conversationId}?limit=30`);
          const data = await res.json();
          if (res.ok && data.messages) {
            const incoming = ((data.messages as Message[]) ?? [])
              .filter((m) => !messageIdsRef.current.has(m.id))
              .map((m) =>
                normalizeMessage({
                  ...m,
                  conversation_id: m.conversation_id ?? conversationId ?? undefined,
                })
              );

            if (incoming.length > 0) {
              console.log(`Found ${incoming.length} new messages while tab was hidden`);
              setMessages((prev) => sortUniqueMessages([...prev, ...incoming]));
              shouldAutoScrollRef.current = true;
            }
          }
        } catch (err) {
          console.error("Failed to fetch messages on visibility change:", err);
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [conversationId]);

  useEffect(() => {
    setVisibleMessages(new Set());
    initialScrollDoneRef.current = false;
    setFocusedMessageId(null);
    setReplyTarget(null);
    setReactionTargetId(null);
  }, [conversationId]);

  useEffect(() => {
    return () => {
      if (longPressTimerRef.current) {
        clearTimeout(longPressTimerRef.current);
      }
      if (overlayTimerRef.current) {
        clearTimeout(overlayTimerRef.current);
      }
      if (copiedTimerRef.current) {
        clearTimeout(copiedTimerRef.current);
      }
      if (reactionErrorTimerRef.current) {
        clearTimeout(reactionErrorTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!listRef.current) return;
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          const id = entry.target.getAttribute("data-message-id");
          if (!id) return;
          if (!entry.isIntersecting) return;
          setVisibleMessages((prev) => {
            if (prev.has(id)) return prev;
            const next = new Set(prev);
            next.add(id);
            return next;
          });
          observer.unobserve(entry.target);
        });
      },
      { root: listRef.current, threshold: 0.15 }
    );

    Object.entries(messageElsRef.current).forEach(([id, el]) => {
      if (!el || visibleMessages.has(id)) return;
      observer.observe(el);
    });

    return () => observer.disconnect();
  }, [messages, visibleMessages]);

  // load initial messages + current user (paged)
  useEffect(() => {
    const load = async () => {
      if (!conversationId) {
        setInitialLoading(false);
        return;
      }
      try {
        setInitialLoading(true);
        setHasMore(false);
        setLoadingOlder(false);
        setVisibleMessages(new Set());
        const {
          data: { user },
        } = await supabase.current.auth.getUser();
        setCurrentUserId(user?.id ?? null);

        const res = await fetch(
          `/api/messages/${conversationId}?limit=${PAGE_SIZE}`
        );
        const data = await res.json();
        if (res.ok) {
          shouldAutoScrollRef.current = true;
          const normalized = (data.messages as Message[] | undefined)?.map(
            (m) =>
              normalizeMessage({
                ...m,
                conversation_id:
                  m.conversation_id ?? conversationId ?? undefined,
              })
          );
          setMessages(sortUniqueMessages(normalized ?? []));
          const otherMsg = (data.messages as Message[] | undefined)?.find(
            (m) => m.sender_id && m.sender_id !== user?.id
          );
          const fallbackTitle =
            otherMsg?.profiles?.profile_title ??
            data.messages?.[0]?.profiles?.profile_title ??
            null;
          const apiName =
            data.other?.display_name ??
            data.other?.profile_title ??
            fallbackTitle ??
            null;
          const apiProfileTitle =
            data.other?.profile_title ?? fallbackTitle ?? null;
          const apiOtherId = data.other?.user_id ?? null;
          if (apiOtherId) setOtherUserId(apiOtherId);
          else {
            // derive other user id from messages list if possible
            const firstOther = (data.messages as Message[] | undefined)?.find(
              (m) => m.sender_id && m.sender_id !== user?.id
            );
            if (firstOther?.sender_id) setOtherUserId(firstOther.sender_id);
          }
          if (apiName) setParticipantName(apiName);
          if (apiProfileTitle) setParticipantProfileTitle(apiProfileTitle);
          const rawAvatar =
            data.other?.avatar_url ??
            (data.messages as Message[] | undefined)?.find(
              (m) => m.sender_id !== user?.id && m.profiles?.avatar_url
            )?.profiles?.avatar_url ??
            null;
          const proxied = getAvatarProxyUrl(rawAvatar);
          if (proxied) {
            setParticipantAvatar(proxied);
          }
          setHasMore(Boolean(data.hasMore));
        }
      } catch {
        // ignore
      } finally {
        setInitialLoading(false);
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
          console.log("Realtime INSERT event:", payload.new);
          const msg = payload.new as Message;
          const isMine =
            currentUserIdRef.current != null &&
            msg.sender_id === currentUserIdRef.current;
          console.log("isMine:", isMine, "pendingReplyRef.current:", pendingReplyRef.current);
          // Apply pending reply data if this is our message and we have reply metadata
          if (
            isMine &&
            pendingReplyRef.current &&
            msg.id &&
            !messageIdsRef.current.has(msg.id)
          ) {
            console.log("Applying pendingReplyRef to message:", msg.id);
            Object.assign(msg, pendingReplyRef.current);
            console.log("Message after applying reply data:", msg);
            pendingReplyRef.current = null;
          }
          const pending = pendingReceiptsRef.current[msg.id];
          const msgWithReceipts = pending
            ? {
                ...msg,
                delivered_at:
                  pending.delivered_at ?? (msg as any).delivered_at ?? null,
                read_at: pending.read_at ?? (msg as any).read_at ?? null,
              }
            : msg;
          const normalizedMsg = normalizeMessage(msgWithReceipts as Message);
          shouldAutoScrollRef.current = true;
          setMessages((prev) =>
            prev.some((m) => m.id === msg.id)
              ? prev
              : sortUniqueMessages([
                  ...prev,
                  {
                    ...normalizedMsg,
                    conversation_id:
                      (msg as any).conversation_id ??
                      conversationId ??
                      undefined,
                  },
                ])
          );
        }
      );
    channel.on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "message_receipts",
      },
      (payload: any) => {
        const rec = (payload.new ?? payload.old) as {
          message_id?: string;
          delivered_at?: string | null;
          read_at?: string | null;
          user_id?: string | null;
        };
        const msgId = rec?.message_id;
        if (!msgId) return;

        const applyUpdate = () => {
          let updated = false;
          setMessages((prev) =>
            prev.map((m) => {
              if (m.id !== msgId) return m;
              const isMine =
                currentUserIdRef.current != null &&
                m.sender_id === currentUserIdRef.current;
              if (isMine && rec.user_id === currentUserIdRef.current) return m;
              updated = true;
              return {
                ...m,
                delivered_at: rec.delivered_at ?? m.delivered_at ?? null,
                read_at: rec.read_at ?? m.read_at ?? null,
              };
            })
          );
          return updated;
        };

        // Try updating in-memory message regardless of cached id set
        const didUpdate = applyUpdate();
        if (didUpdate) return;

        // Otherwise, fetch the message to ensure it belongs to this conversation, then cache the receipt
        (async () => {
          try {
            const { data } = await supabase.current
              .from("messages")
              .select("id, conversation_id")
              .eq("id", msgId)
              .maybeSingle();
            if (data?.conversation_id !== conversationId) return;
            pendingReceiptsRef.current[msgId] = {
              delivered_at: rec.delivered_at ?? null,
              read_at: rec.read_at ?? null,
            };
            applyUpdate();
          } catch {
            // ignore
          }
        })();
      }
    );
    channel.on("broadcast", { event: "typing" }, (payload: any) => {
      const rec = payload.payload as {
        user_id?: string | null;
        started?: boolean;
      };
      const uid = rec?.user_id;
      if (!uid || uid === currentUserIdRef.current) return;

      setTypingUsers((prev) => {
        const next = new Set(prev);
        if (rec.started) next.add(uid);
        else next.delete(uid);
        return next;
      });

      if (rec.started) {
        if (typingTimersRef.current[uid]) {
          clearTimeout(typingTimersRef.current[uid]);
        }
        typingTimersRef.current[uid] = setTimeout(() => {
          setTypingUsers((prev) => {
            const next = new Set(prev);
            next.delete(uid);
            return next;
          });
          delete typingTimersRef.current[uid];
        }, 5000);
      } else if (typingTimersRef.current[uid]) {
        clearTimeout(typingTimersRef.current[uid]);
        delete typingTimersRef.current[uid];
      }
    });
    channel.subscribe();
    convoChannelRef.current = channel;
    return () => {
      try {
        convoChannelRef.current = null;
        if (typingSelfTimerRef.current) {
          clearTimeout(typingSelfTimerRef.current);
          typingSelfTimerRef.current = null;
        }
        Object.values(typingTimersRef.current).forEach((t) => clearTimeout(t));
        typingTimersRef.current = {};
        supabase.current.removeChannel(channel);
      } catch {}
    };
  }, [conversationId]);

  // scroll to bottom on new messages
  useEffect(() => {
    if (!shouldAutoScrollRef.current) return;
    if (loadingOlderRef.current) {
      loadingOlderRef.current = false;
      shouldAutoScrollRef.current = false;
      return;
    }
    if (!endRef.current) return;
    endRef.current.scrollIntoView({ block: "start", behavior: "smooth" });
    shouldAutoScrollRef.current = false;
  }, [messages]);

  useEffect(() => {
    if (initialLoading) return;
    if (initialScrollDoneRef.current) return;
    if (!messages.length) return;
    if (!endRef.current) return;
    endRef.current.scrollIntoView({ block: "start", behavior: "auto" });
    shouldAutoScrollRef.current = false;
    initialScrollDoneRef.current = true;
  }, [initialLoading, messages]);

  useEffect(() => {
    if (typingUsers.size === 0) return;
    if (!endRef.current) return;
    endRef.current.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [typingUsers]);

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
        await fetch(`/api/connections/${pinConnectionId}`, {
          method: "DELETE",
        });
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
    fetch(`/api/connections`)
      .then((res) => res.json())
      .then((body) => {
        const list = body?.connections ?? [];
        const contact = list.find((c: any) => {
          if (c.type !== "contact") return false;
          const rows = Array.isArray(c.connection_contacts)
            ? c.connection_contacts
            : [c.connection_contacts].filter(Boolean);
          return rows.some((r: any) => {
            const candidate =
              r?.profile_id ??
              r?.profiles?.id ??
              c.target_profile_id ??
              c.profile_id;
            return candidate === otherUserId;
          });
        });
        const pin = list.find((c: any) => {
          if (c.type !== "pin") return false;
          const rows = Array.isArray(c.connection_pins)
            ? c.connection_pins
            : [c.connection_pins].filter(Boolean);
          return rows.some((r: any) => {
            const candidate =
              r?.pinned_profile_id ??
              r?.pinned_profile?.id ??
              c.target_profile_id ??
              c.pinned_profile_id;
            return candidate === otherUserId;
          });
        });
        setContactConnectionId(contact?.id ?? null);
        setPinConnectionId(pin?.id ?? null);
        if (contact) {
          const detail = Array.isArray(contact.connection_contacts)
            ? contact.connection_contacts[0]
            : contact.connection_contacts;
          setContactNickname(
            (prev) => detail?.display_name || prev || participantName
          );
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
    console.log("handleSend - replyTarget:", replyTarget);
    const replyMeta = replyTarget
      ? {
          reply_to_id: replyTarget.id,
          reply_to_body: replyTarget.body,
          reply_to_sender_id: replyTarget.sender_id,
        }
      : { reply_to_id: null, reply_to_body: null, reply_to_sender_id: null };
    console.log("handleSend - replyMeta:", replyMeta);
    pendingReplyRef.current = replyMeta;
    console.log("handleSend - pendingReplyRef.current:", pendingReplyRef.current);
    setReplyTarget(null);
    shouldAutoScrollRef.current = true;
    if (typingBroadcastedRef.current) {
      emitTyping(false);
      typingBroadcastedRef.current = false;
      if (typingSelfTimerRef.current) {
        clearTimeout(typingSelfTimerRef.current);
        typingSelfTimerRef.current = null;
      }
    }
    try {
      const payload = { body: text, ...replyMeta };
      console.log("Sending message with payload:", payload);
      const res = await fetch(`/api/messages/${conversationId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      console.log("Message API response:", data);
    } catch (err) {
      console.error("Send message error:", err);
    }
  };

  // redirect if conversation missing (optional)
  useEffect(() => {
    if (!conversationId) return;
    if (!messages.length) return;
    // noop route protection; keep simple
  }, [conversationId, messages.length]);

  useEffect(() => {
    if (!conversationId || !currentUserId) return;
    const hasUnreadFromOthers = messages.some(
      (m) => m.sender_id !== currentUserId && !m.read_at
    );
    if (!hasUnreadFromOthers) return;
    const controller = new AbortController();
    const timer = setTimeout(() => {
      fetch(`/api/messages/${conversationId}`, {
        method: "PATCH",
        signal: controller.signal,
      }).catch(() => {
        // ignore
      });
    }, 300);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [conversationId, currentUserId, messages]);

  // For newly received messages, immediately upsert delivered receipts while viewing the thread
  useEffect(() => {
    if (!currentUserId || !messages.length) return;
    const now = new Date().toISOString();
    const rows = messages
      .filter(
        (m) =>
          m.sender_id !== currentUserId &&
          !m.delivered_at &&
          !deliveryAttemptRef.current.has(m.id)
      )
      .map((m) => ({
        message_id: m.id,
        user_id: currentUserId,
        delivered_at: now,
      }));
    if (!rows.length) return;
    rows.forEach((r) => deliveryAttemptRef.current.add(r.message_id));

    (async () => {
      try {
        const { error } = await supabase.current
          .from("message_receipts")
          .upsert(rows, { onConflict: "message_id,user_id" });
        if (error) return;
        const deliveredMap = rows.reduce<Record<string, string>>((acc, r) => {
          acc[r.message_id] = r.delivered_at ?? now;
          return acc;
        }, {});
        setMessages((prev) =>
          prev.map((m) =>
            deliveredMap[m.id]
              ? { ...m, delivered_at: m.delivered_at ?? deliveredMap[m.id] }
              : m
          )
        );
      } catch {
        // ignore
      }
    })();
  }, [currentUserId, messages]);

  const emitTyping = (started: boolean) => {
    if (!conversationId) return;
    const chan = convoChannelRef.current;
    if (!chan) return;
    try {
      void chan.send({
        type: "broadcast",
        event: "typing",
        payload: { user_id: currentUserIdRef.current, started },
      });
    } catch {
      // ignore
    }
  };

  const handleMessageAction = useCallback(
    async (
      action: "reply" | "copy" | "info" | "translate" | "delete",
      msg?: Message
    ) => {
      console.log("handleMessageAction called:", { action, msg });
      if (action === "copy" && msg?.body) {
        const didCopy = await copyToClipboard(msg.body);
        if (didCopy) {
          setCopiedMessageId(msg.id);
          if (copiedTimerRef.current) {
            clearTimeout(copiedTimerRef.current);
          }
          copiedTimerRef.current = setTimeout(() => {
            setCopiedMessageId(null);
            copiedTimerRef.current = null;
          }, 1500);
        }
      } else if (action === "reply" && msg) {
        console.log("Setting replyTarget to:", msg);
        setReplyTarget(msg);
      }
      // TODO: wire reply/info/translate/delete if needed
      setFocusedMessageId(null);
      setFocusedMessageRect(null);
    },
    [copyToClipboard]
  );

  const handleReactionToggle = useCallback(
    async (message: Message, type: string) => {
      const convId = message.conversation_id ?? conversationId;
      if (!convId) {
        showReactionError("Missing conversation id; cannot send reaction.");
        return;
      }
      const actorId = currentUserIdRef.current ?? currentUserId;
      if (!actorId) {
        showReactionError("Not authenticated; please re-login.");
        return;
      }
      const prev = message.my_reaction ?? null;
      const next = prev === type ? null : type;
      setReactionTargetId(null);
      setFocusedMessageId(null);
      setFocusedMessageRect(null);

      // Trigger floating animation when adding a reaction (not removing)
      if (next !== null) {
        const animationId = `${message.id}-${type}-${Date.now()}`;
        setFloatingReactions((prevReactions) => [
          ...prevReactions,
          {
            id: animationId,
            messageId: message.id,
            type: next,
            timestamp: Date.now(),
          },
        ]);
        // Remove after animation completes
        setTimeout(() => {
          setFloatingReactions((prevReactions) =>
            prevReactions.filter((r) => r.id !== animationId)
          );
        }, 1500);
      }

      applyReactionLocal(message.id, actorId, prev, next);
      try {
        const res = await fetch(`/api/messages/${convId}/reactions`, {
          method: "POST",
          credentials: "include",
          cache: "no-store",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message_id: message.id, type: next }),
        });
        if (!res.ok) {
          const text = await res.text();
          showReactionError(
            `Reaction failed (${res.status}): ${text || "unknown error"}`
          );
          // Revert optimistic change on failure
          applyReactionLocal(message.id, actorId, next, prev);
        }
      } catch (err) {
        showReactionError("Reaction failed: network or server error");
        applyReactionLocal(message.id, actorId, next, prev);
      }
    },
    [conversationId, currentUserId, applyReactionLocal, showReactionError]
  );

  const handleTypingChange = (value: string) => {
    setNewMessage(value);
    const hasText = value.trim().length > 0;

    if (hasText) {
      if (!typingBroadcastedRef.current) {
        emitTyping(true);
        typingBroadcastedRef.current = true;
      }
      if (typingSelfTimerRef.current) {
        clearTimeout(typingSelfTimerRef.current);
      }
      typingSelfTimerRef.current = setTimeout(() => {
        emitTyping(false);
        typingBroadcastedRef.current = false;
        typingSelfTimerRef.current = null;
      }, 3500);
    } else if (typingBroadcastedRef.current) {
      emitTyping(false);
      typingBroadcastedRef.current = false;
      if (typingSelfTimerRef.current) {
        clearTimeout(typingSelfTimerRef.current);
        typingSelfTimerRef.current = null;
      }
    }
  };

  const loadOlder = useCallback(async () => {
    if (
      !conversationId ||
      loadingOlderRef.current ||
      loadingOlder ||
      !hasMore ||
      !messages.length
    )
      return;
    const earliest = messages[0];
    if (!earliest) return;
    const container = listRef.current;
    pendingPrependAdjustRef.current = false;
    prevHeightRef.current = null;
    prevScrollTopRef.current = null;
    setLoadingOlder(true);
    loadingOlderRef.current = true;
    try {
      const params = new URLSearchParams({
        limit: String(PAGE_SIZE),
        before: earliest.created_at,
      });
      const res = await fetch(`/api/messages/${conversationId}?${params}`);
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error || "Failed to load messages");
      }
      const incoming = ((data.messages as Message[]) ?? [])
        .filter((m) => !messageIdsRef.current.has(m.id))
        .map((m) =>
          normalizeMessage({
            ...m,
            conversation_id: m.conversation_id ?? conversationId ?? undefined,
          })
        );
      setHasMore(Boolean(data.hasMore));
      if (incoming.length) {
        prevHeightRef.current = container?.scrollHeight ?? null;
        prevScrollTopRef.current = container?.scrollTop ?? null;
        pendingPrependAdjustRef.current = true;
        setVisibleMessages((prev) => {
          const next = new Set(prev);
          incoming.forEach((m) => next.add(m.id));
          return next;
        });
        setMessages((prev) => sortUniqueMessages([...incoming, ...prev]));
      } else {
        pendingPrependAdjustRef.current = false;
        prevHeightRef.current = null;
        prevScrollTopRef.current = null;
      }
    } catch {
      pendingPrependAdjustRef.current = false;
      loadingOlderRef.current = false;
      setLoadingOlder(false);
    } finally {
      if (!pendingPrependAdjustRef.current) {
        loadingOlderRef.current = false;
        setLoadingOlder(false);
        prevHeightRef.current = null;
        prevScrollTopRef.current = null;
      }
    }
  }, [conversationId, hasMore, loadingOlder, messages]);

  useLayoutEffect(() => {
    if (!pendingPrependAdjustRef.current) return;
    const el = listRef.current;
    const before = prevHeightRef.current;
    const beforeScroll = prevScrollTopRef.current;
    if (!el || before == null || beforeScroll == null) {
      pendingPrependAdjustRef.current = false;
      loadingOlderRef.current = false;
      setLoadingOlder(false);
      prevHeightRef.current = null;
      prevScrollTopRef.current = null;
      return;
    }
    const after = el.scrollHeight;
    el.scrollTop = beforeScroll + (after - before);
    pendingPrependAdjustRef.current = false;
    loadingOlderRef.current = false;
    setLoadingOlder(false);
    prevHeightRef.current = null;
    prevScrollTopRef.current = null;
  }, [messages]);

  const hasText = newMessage.trim().length > 0;
  const receiptIdsKey = useMemo(() => {
    return messages
      .map((m) => m.id)
      .filter(Boolean)
      .sort()
      .join(",");
  }, [messages]);
  const displayName = (contactNickname?.trim() || participantName || "").trim();
  const secondaryName =
    contactNickname?.trim() && participantProfileTitle
      ? participantProfileTitle
      : participantProfileTitle && participantProfileTitle !== displayName
      ? participantProfileTitle
      : null;

  useEffect(() => {
    if (!conversationId) return;
    const ids = Array.from(messageIdsRef.current);
    if (!ids.length) return;

    const filter = `message_id=in.(${ids.map((id) => `"${id}"`).join(",")})`;

    const channel = supabase.current.channel(
      `receipts:${conversationId}:${ids.length}`
    );

    const handleReceipt = (payload: any) => {
      const rec = (payload.new ?? payload.old) as {
        message_id?: string;
        delivered_at?: string | null;
        read_at?: string | null;
        user_id?: string | null;
      };
      const msgId = rec?.message_id;
      if (!msgId) return;

      let updated = false;
      setMessages((prev) =>
        prev.map((m) => {
          if (m.id !== msgId) return m;
          const isMine =
            currentUserIdRef.current != null &&
            m.sender_id === currentUserIdRef.current;
          if (isMine && rec.user_id === currentUserIdRef.current) return m;
          updated = true;
          return {
            ...m,
            delivered_at: rec.delivered_at ?? m.delivered_at ?? null,
            read_at: rec.read_at ?? m.read_at ?? null,
          };
        })
      );
      if (updated) return;
      pendingReceiptsRef.current[msgId] = {
        delivered_at: rec.delivered_at ?? null,
        read_at: rec.read_at ?? null,
      };
    };

    channel.on(
      "postgres_changes",
      { event: "*", schema: "public", table: "message_receipts", filter },
      handleReceipt
    );
    channel.subscribe();
    receiptsChannelRef.current = channel;

    return () => {
      try {
        if (receiptsChannelRef.current) {
          supabase.current.removeChannel(receiptsChannelRef.current);
        }
      } catch {}
      receiptsChannelRef.current = null;
    };
  }, [conversationId, receiptIdsKey]);

  useEffect(() => {
    if (!conversationId) return;
    const ids = Array.from(messageIdsRef.current);
    if (!ids.length) return;

    const filter = `message_id=in.(${ids.map((id) => `"${id}"`).join(",")})`;

    const channel = supabase.current.channel(
      `reactions:${conversationId}:${ids.length}`
    );

    const handleReaction = (payload: any) => {
      const recNew = payload.new ?? {};
      const recOld = payload.old ?? {};
      const msgId =
        (recNew as any).message_id ?? (recOld as any).message_id ?? null;
      if (!msgId) return;
      const prevType = (recOld as any).type ?? null;
      const nextType = (recNew as any).type ?? null;
      const actorUserId =
        (recNew as any).user_id ?? (recOld as any).user_id ?? null;
      // Ignore own realtime event; optimistic update already applied
      if (actorUserId && actorUserId === currentUserIdRef.current) return;
      applyReactionLocal(msgId, actorUserId, prevType, nextType);
    };

    channel.on(
      "postgres_changes",
      { event: "*", schema: "public", table: "message_reactions", filter },
      handleReaction
    );
    channel.subscribe();
    reactionsChannelRef.current = channel;

    return () => {
      try {
        if (reactionsChannelRef.current) {
          supabase.current.removeChannel(reactionsChannelRef.current);
        }
      } catch {}
      reactionsChannelRef.current = null;
    };
  }, [conversationId, receiptIdsKey, applyReactionLocal]);

  useEffect(() => {
    const el = listRef.current;
    if (!el) return;
    const handleScroll = () => {
      cancelLongPress();
      setReactionTargetId(null);
      if (!hasMore || loadingOlder || loadingOlderRef.current) return;
      // Trigger when within ~5 messages from top; using a px threshold approximating a few message heights
      if (el.scrollTop <= 120) {
        void loadOlder();
      }
    };
    el.addEventListener("scroll", handleScroll, { passive: true });
    return () => el.removeEventListener("scroll", handleScroll);
  }, [hasMore, loadingOlder, loadOlder, messages.length, cancelLongPress]);

  return (
    <div className="h-svh min-h-svh bg-background text-foreground flex flex-col">
      <style>{`
        @keyframes floatUp {
          0% {
            transform: translateY(0) scale(0.8);
            opacity: 0;
          }
          10% {
            opacity: 1;
          }
          100% {
            transform: translateY(-120px) scale(1);
            opacity: 0;
          }
        }
        @keyframes fadeOut {
          0% {
            opacity: 0;
          }
          10% {
            opacity: 1;
          }
          70% {
            opacity: 1;
          }
          100% {
            opacity: 0;
          }
        }
      `}</style>
      {focusedMessageId && (
        <div
          className="fixed inset-0 z-40 transition-all duration-300"
          style={{
            backgroundColor: "rgba(0, 0, 0, 0.6)",
            backdropFilter: "blur(8px)",
          }}
          onClick={() => {
            setReactionTargetId(null);
            setFocusedMessageId(null);
            setFocusedMessageRect(null);
          }}
        />
      )}
      <div className="bg-background/60 supports-backdrop-filter:bg-background/50 backdrop-blur-md px-3 py-2 flex items-center justify-between gap-3 border-none">
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
            {initialLoading ? (
              <>
                <div className="h-12 w-12 rounded-full bg-muted animate-pulse" />
                <div className="leading-tight space-y-1">
                  <div className="h-4 w-32 rounded bg-muted animate-pulse" />
                  <div className="h-3 w-24 rounded bg-muted/80 animate-pulse" />
                </div>
              </>
            ) : (
              <>
                <Avatar className="h-12 w-12">
                  <AvatarImage
                    alt={participantName}
                    src={participantAvatar ?? undefined}
                  />
                  <AvatarFallback>{participantInitials}</AvatarFallback>
                </Avatar>
                <div className="leading-tight">
                  <div className="text-sm font-medium flex items-center gap-1 max-w-60">
                    <span className="truncate">{displayName || "Contact"}</span>
                    {secondaryName ? (
                      <span className="text-xs text-muted-foreground truncate max-w-[140px]">
                        {secondaryName}
                      </span>
                    ) : null}
                  </div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span className="size-2 rounded-full bg-green-500" />
                    <span>Online</span>
                  </div>
                </div>
              </>
            )}
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
              disabled={loadingConnections && !contactConnectionId}
              onSelect={(e) => {
                e.preventDefault();
                if (contactConnectionId) {
                  router.push(`/app/connections/${contactConnectionId}`);
                  return;
                }
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
              disabled={
                loadingConnections ||
                pinning ||
                !otherUserId ||
                (Boolean(contactConnectionId) && !pinConnectionId)
              }
              onSelect={(e) => {
                e.preventDefault();
                void handlePinToggle();
              }}
            >
              <Pin className="h-4 w-4" />
              {pinConnectionId ? "Unpin profile" : "Pin profile"}
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
      {reactionError ? (
        <div className="px-4 py-2 text-sm text-destructive bg-destructive/10 border-b border-destructive/30">
          {reactionError}
        </div>
      ) : null}
      <div
        ref={listRef}
        className={`relative flex-1 px-4 pt-4 space-y-3 ${
          focusedMessageId ? "overflow-hidden touch-none" : "overflow-y-auto"
        } select-none ${
          typingUsers.size > 0 ? "pb-10" : "pb-2"
        } [&::-webkit-scrollbar]:hidden`}
        style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
        onWheelCapture={(e) => {
          if (focusedMessageId) e.preventDefault();
        }}
        onTouchMove={(e) => {
          if (focusedMessageId) e.preventDefault();
        }}
        onScroll={(e) => {
          if (focusedMessageId) {
            e.preventDefault();
            const el = e.currentTarget;
            el.scrollTop = el.scrollTop;
          }
        }}
      >
        {copiedMessageId ? (
          <div className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center">
            <div className="rounded-xl bg-card px-4 py-2 text-sm text-foreground shadow-lg border">
              Copied message
            </div>
          </div>
        ) : null}
        {initialLoading && messages.length === 0
          ? Array.from({ length: 6 }).map((_, idx) => {
              const isMe = idx % 2 === 0;
              return (
                <div
                  key={`skeleton-${idx}`}
                  className={`flex ${isMe ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`rounded-lg px-3 py-2 max-w-[70%] ${
                      isMe
                        ? "bg-primary/30 text-white rounded-br-none"
                        : "bg-muted text-muted-foreground rounded-bl-none"
                    } animate-pulse space-y-2`}
                  >
                    <div className="h-3 w-32 rounded bg-foreground/20" />
                    <div className="h-3 w-20 rounded bg-foreground/10" />
                  </div>
                </div>
              );
            })
          : null}
        {messages.map((m) => {
          const isMe =
            currentUserId != null ? m.sender_id === currentUserId : false;
          const isVisible = visibleMessages.has(m.id);
          const reactionEntries = Object.entries(
            m.reaction_counts || {}
          ).filter(([, count]) => (count ?? 0) > 0);
          const totalReactions = reactionEntries.reduce(
            (sum, [, count]) => sum + (count ?? 0),
            0
          );
          const showPicker = reactionTargetId === m.id;
          const isFocused = focusedMessageId === m.id;
          const myReaction = m.my_reaction ?? null;

          // Calculate centered position when focused
          const messageStyle: React.CSSProperties = {};
          if (isFocused && focusedMessageRect) {
            const viewportHeight = window.innerHeight;
            const viewportCenterY = viewportHeight / 2;
            const messageHeight = focusedMessageRect.height;
            const targetTop = viewportCenterY - messageHeight / 2;
            const translateY = targetTop - focusedMessageRect.top;

            Object.assign(messageStyle, {
              transform: `translateY(${translateY}px)`,
              zIndex: 50,
              transition: "transform 300ms ease-out",
            });
          }

          const reactionChip = reactionEntries.length ? (
            <div
              className="inline-flex items-center gap-1 rounded-full bg-transparent px-0 py-0 text-[12px] text-current"
              onClick={(e) => {
                e.stopPropagation();
                setReactionTargetId(m.id);
              }}
            >
              {reactionEntries.map(([type]) => {
                const meta = reactionMeta[type];
                const fallback = meta?.emoji ?? "★";
                return (
                  <span key={type} className="inline-flex items-center gap-1">
                    <AnimatedEmoji
                      src={meta?.src ?? ""}
                      fallback={fallback}
                      size={18}
                      playOnce
                      restAtEnd
                      restFrameFraction={meta?.restFrameFraction}
                    />
                  </span>
                );
              })}
              {totalReactions > 1 ? (
                <span className="ml-0.5 text-xs font-semibold">
                  {totalReactions}
                </span>
              ) : null}
            </div>
          ) : null;
          return (
            <div
              key={m.id}
              ref={(el) => {
                messageElsRef.current[m.id] = el;
              }}
              className={`relative flex ${
                isMe ? "justify-end" : "justify-start"
              } ${!isFocused ? "transition-all duration-300 ease-out" : ""} ${
                isVisible
                  ? "opacity-100 translate-y-0"
                  : "opacity-0 translate-y-1"
              }`}
              style={isFocused ? messageStyle : undefined}
              data-message-id={m.id}
            >
              {showPicker && (
                <>
                  <div
                    className={`absolute top-0 z-50 ${
                      isMe ? "right-0" : "left-0"
                    }`}
                    ref={reactionMenuRef}
                    onClick={(e) => e.stopPropagation()}
                    style={{ transform: "translateY(calc(-100% - 8px))" }}
                  >
                    <div className="flex items-center gap-1 rounded-full border bg-background/95 px-2 py-1 shadow-lg backdrop-blur pointer-events-auto">
                    {REACTIONS.map((r, idx) => {
                      const isActive = myReaction === r.type;
                      return (
                        <div
                          key={r.type}
                          role="button"
                          tabIndex={0}
                          className={`p-2 text-xl leading-none rounded-full transition pointer-events-auto ${
                            isActive ? "bg-muted" : "hover:bg-muted"
                          }`}
                          data-reaction={r.type}
                          onPointerDown={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            void handleReactionToggle(m, r.type);
                          }}
                          onMouseDown={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            void handleReactionToggle(m, r.type);
                          }}
                          onTouchStart={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            void handleReactionToggle(m, r.type);
                          }}
                          onClick={(e) => {
                            e.stopPropagation();
                            void handleReactionToggle(m, r.type);
                          }}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" || e.key === " ") {
                              e.preventDefault();
                              e.stopPropagation();
                              void handleReactionToggle(m, r.type);
                            }
                          }}
                        >
                          <AnimatedEmoji
                            src={r.src}
                            fallback={r.emoji}
                            size={20}
                            delayMs={idx * 80}
                            playOnce
                            restAtEnd
                            restFrameFraction={r.restFrameFraction}
                          />
                        </div>
                      );
                    })}
                  </div>
                  </div>
                  <div
                    className={`absolute bottom-0 z-50 ${
                      isMe ? "right-0" : "left-0"
                    }`}
                    ref={actionMenuRef}
                    style={{ transform: "translateY(calc(100% + 8px))" }}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="rounded-lg border bg-background/95 shadow-lg backdrop-blur min-w-[180px]">
                      <div className="py-1">
                        <button
                          className="flex w-full items-center gap-2 px-3 py-2 text-sm hover:bg-muted transition-colors"
                          onClick={(e) => {
                            e.stopPropagation();
                            console.log("Reply button clicked for message:", m.id);
                            handleMessageAction("reply", m);
                          }}
                        >
                          <Reply className="h-4 w-4" />
                          Reply
                        </button>
                        <button
                          className="flex w-full items-center gap-2 px-3 py-2 text-sm hover:bg-muted transition-colors"
                          onClick={() => handleMessageAction("copy", m)}
                        >
                          <Copy className="h-4 w-4" />
                          Copy message
                        </button>
                        <button
                          className="flex w-full items-center gap-2 px-3 py-2 text-sm hover:bg-muted transition-colors"
                          onClick={() => handleMessageAction("info", m)}
                        >
                          <Info className="h-4 w-4" />
                          Info
                        </button>
                        <button
                          className="flex w-full items-center gap-2 px-3 py-2 text-sm hover:bg-muted transition-colors"
                          onClick={() => handleMessageAction("translate", m)}
                        >
                          <Languages className="h-4 w-4" />
                          Translate
                        </button>
                        <div className="my-1 border-t border-border" />
                        <button
                          className="flex w-full items-center gap-2 px-3 py-2 text-sm text-destructive hover:bg-destructive/10 transition-colors"
                          onClick={() => handleMessageAction("delete", m)}
                        >
                          <Trash2 className="h-4 w-4" />
                          Delete
                        </button>
                      </div>
                    </div>
                  </div>
                </>
              )}
              {floatingReactions
                  .filter((fr) => fr.messageId === m.id)
                  .map((fr) => {
                    const meta = reactionMeta[fr.type];
                    const fallback = meta?.emoji ?? "★";
                    return (
                      <div
                        key={fr.id}
                        className="absolute pointer-events-none z-30"
                        style={{
                          left: isMe ? "auto" : "50%",
                          right: isMe ? "50%" : "auto",
                          bottom: "20%",
                          animation: "floatUp 1.5s ease-out forwards",
                        }}
                      >
                        <div
                          style={{
                            animation: "fadeOut 1.5s ease-out forwards",
                            transform: "scale(1.5)",
                          }}
                        >
                          <AnimatedEmoji
                            src={meta?.src ?? ""}
                            fallback={fallback}
                            size={48}
                            playOnce
                            restAtEnd
                            restFrameFraction={meta?.restFrameFraction}
                          />
                        </div>
                      </div>
                    );
                  })}
                <div
                className={`relative rounded-lg px-3 py-2 max-w-[75%] sm:max-w-[65%] lg:max-w-[55%] ${
                  isMe
                    ? "bg-primary text-white rounded-br-none"
                    : "bg-muted text-foreground rounded-bl-none"
                } transition-all duration-300 ease-out overflow-hidden pointer-events-auto`}
                onMouseDown={(e) => {
                  if (e.button !== 0) return;
                  startLongPress(m.id);
                }}
                onMouseUp={cancelLongPress}
                onMouseLeave={cancelLongPress}
                onTouchStart={() => startLongPress(m.id)}
                onTouchEnd={cancelLongPress}
                onTouchCancel={cancelLongPress}
                onContextMenu={(e) => {
                  e.preventDefault();
                  setReactionTargetId(m.id);
                }}
                onDoubleClick={(e) => {
                  e.stopPropagation();
                  void handleReactionToggle(m, "heart");
                }}
              >
                {m.reply_to_id && m.reply_to_body ? (
                  <div className={`mb-2 rounded px-2 py-1.5 border-l-2 ${
                    isMe
                      ? "bg-white/20 border-white/40"
                      : "bg-black/10 border-black/30"
                  }`}>
                    <div className={`text-[10px] font-semibold mb-0.5 ${
                      isMe ? "text-white/90" : "text-foreground/80"
                    }`}>
                      {m.reply_to_sender_id === currentUserId ? "You" : participantName || "Them"}
                    </div>
                    <div className={`text-xs line-clamp-2 ${
                      isMe ? "text-white/80" : "text-foreground/70"
                    }`}>{m.reply_to_body}</div>
                  </div>
                ) : null}
                <p className="text-sm leading-relaxed wrap-break-word">
                  {m.body}
                </p>
                <div
                  className={`mt-1 text-xs flex items-center gap-2 ${
                    isMe ? "text-blue-100" : "text-muted-foreground"
                  }`}
                  style={{
                    justifyContent: isMe ? "space-between" : "space-between",
                  }}
                >
                  {isMe ? (
                    <>
                      <div className="flex-1 flex items-center gap-1">
                        {reactionChip}
                      </div>
                      <div className="flex items-center gap-1">
                        <span>
                          {new Date(m.created_at).toLocaleTimeString(
                            undefined,
                            {
                              hour: "2-digit",
                              minute: "2-digit",
                              hour12: false,
                            }
                          )}
                        </span>
                        {m.read_at ? (
                          <CheckCheck className="h-3.5 w-3.5 text-white" />
                        ) : m.delivered_at ? (
                          <Check className="h-3.5 w-3.5" />
                        ) : null}
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="flex items-center gap-1">
                        <span>
                          {new Date(m.created_at).toLocaleTimeString(
                            undefined,
                            {
                              hour: "2-digit",
                              minute: "2-digit",
                              hour12: false,
                            }
                          )}
                        </span>
                      </div>
                      {reactionChip}
                    </>
                  )}
                </div>
              </div>
            </div>
          );
        })}
        {typingUsers.size > 0 ? (
          <div className="flex justify-start">
            <div className="rounded-lg rounded-bl-none px-3 py-2 bg-muted text-foreground inline-flex items-center gap-1 shadow-sm">
              <span className="sr-only">Typing...</span>
              {[0, 1, 2].map((i) => (
                <span
                  key={i}
                  className="h-1.5 w-1.5 rounded-full bg-foreground/70 animate-bounce"
                  style={{ animationDelay: `${i * 120}ms` }}
                />
              ))}
            </div>
          </div>
        ) : null}
        <div ref={endRef} style={{ height: 0 }} />
      </div>
      <div className="bg-card/80 backdrop-blur px-3 py-2">
        {replyTarget ? (
          <div className="mb-2 flex items-start gap-2 rounded-lg bg-muted px-3 py-2 text-xs shadow-sm border-l-2 border-primary">
            <div className="flex-1 min-w-0">
              <div className="text-primary font-medium mb-0.5">
                Replying to {replyTarget.sender_id === currentUserId ? "yourself" : participantName || "them"}
              </div>
              <div className="line-clamp-2 text-foreground/70">
                {replyTarget.body}
              </div>
            </div>
            <button
              className="shrink-0 text-foreground/60 hover:text-foreground transition-colors p-1"
              onClick={() => setReplyTarget(null)}
              aria-label="Cancel reply"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        ) : null}
        <InputGroup
          className="w-full border-0 bg-transparent shadow-none has-[[data-slot=input-group-control]:focus-visible]:ring-0 has-[[data-slot=input-group-control]:focus-visible]:border-0 **:data-[slot=input-group-control]:bg-transparent **:data-[slot=input-group-control]:shadow-none **:data-[slot=input-group-control]:border-0"
          style={{ background: "transparent" }}
        >
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
            onChange={(e) => handleTypingChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            onBlur={() => {
              if (typingBroadcastedRef.current) {
                emitTyping(false);
                typingBroadcastedRef.current = false;
              }
              if (typingSelfTimerRef.current) {
                clearTimeout(typingSelfTimerRef.current);
                typingSelfTimerRef.current = null;
              }
            }}
            placeholder="Write a message..."
            minRows={1}
            maxRows={6}
            className="text-base min-h-0 py-1.5 border-0 bg-transparent shadow-none focus:outline-none focus-visible:outline-none focus-visible:ring-0 focus-visible:border-0"
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
            <DrawerTitle>
              {contactConnectionId ? "View contact" : "Add contact"}
            </DrawerTitle>
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
                {savingContact
                  ? "Saving..."
                  : contactConnectionId
                  ? "Update"
                  : "Save contact"}
              </Button>
            </div>
          </div>
        </DrawerContent>
      </Drawer>
    </div>
  );
}
