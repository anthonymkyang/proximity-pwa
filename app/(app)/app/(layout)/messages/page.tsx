"use client";

import { useState, useEffect, useLayoutEffect, useRef } from "react";
import Link from "next/link";
import {
  Search,
  Plus,
  Archive,
  Trash2,
  User,
  Inbox,
  AlertTriangle,
  Check,
  CheckCheck,
  Lock,
} from "lucide-react";
import GlassButton from "@/components/ui/header-button";
import {
  InputGroup,
  InputGroupInput,
  InputGroupAddon,
} from "@/components/ui/input-group";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Badge24 } from "@/components/shadcn-studio/badge/badge-24";
import { StatusBadge } from "@/components/status/Badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Checkbox } from "@/components/ui/checkbox";
import { createClient } from "@/utils/supabase/client";
import {
  Empty,
  EmptyDescription,
  EmptyTitle,
  EmptyMedia,
  EmptyHeader,
  EmptyContent,
} from "@/components/ui/empty";
import getAvatarProxyUrl from "@/lib/profiles/getAvatarProxyUrl";
import {
  usePresence,
  toUiPresence,
} from "@/components/providers/presence-context";

// -----------------------------------------------------------------------------
// LOCAL MOCK
// -----------------------------------------------------------------------------
const filters = ["All", "Unread", "Favourites", "Groups", "+ Add"] as const;

// shape coming back from Supabase (normalised)
type DBConversation = {
  id: string;
  name: string;
  lastMessage: string | null;
  lastMessageEncrypted?: boolean | null;
  lastMessageId?: string | null;
  avatar?: string | null;
  updated_at?: string | null;
  lastMessageAt?: string | null;
  lastMessageSenderId?: string | null;
  lastReceipt?: { delivered_at: string | null; read_at: string | null } | null;
  unreadCount?: number;
  presence?: "online" | "away" | "recent" | null;
  secondary?: string | null;
  isGroup?: boolean;
};

function getConversationTime(convo: DBConversation) {
  const raw = convo.updated_at ?? convo.lastMessageAt ?? null;
  if (!raw) return 0;
  const ts = new Date(raw).getTime();
  return Number.isNaN(ts) ? 0 : ts;
}

function sortConversations(convos: DBConversation[]) {
  return [...convos].sort((a, b) => getConversationTime(b) - getConversationTime(a));
}

function resolveCoverUrl(path?: string | null): string | null {
  if (!path) return null;
  const s = String(path);
  if (s.startsWith("http://") || s.startsWith("https://")) return s;
  return `/api/groups/storage?path=${encodeURIComponent(s.replace(/^\/+/, ""))}`;
}

// -----------------------------------------------------------------------------
// REUSABLE ROW LAYOUT
// -----------------------------------------------------------------------------
function ListItemRow({
  left,
  right,
  className = "",
}: {
  left: React.ReactNode;
  right: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`relative flex items-center gap-3 -mr-4 ${className}`}>
      <div className="relative h-12 w-12 grid place-items-center">{left}</div>
      <div className="min-w-0 flex-1 border-b border-b-muted py-3 pr-4">
        {right}
      </div>
    </div>
  );
}

// -----------------------------------------------------------------------------
// SWIPE ROW
// -----------------------------------------------------------------------------
function SwipeableRow({
  children,
  onArchive,
  onDelete,
  onContact,
  disabled,
}: {
  children: React.ReactNode;
  onArchive?: () => void;
  onDelete?: () => void;
  onContact?: () => void;
  disabled?: boolean;
}) {
  const [offset, setOffset] = useState(0);
  const [startX, setStartX] = useState<number | null>(null);
  const [openSide, setOpenSide] = useState<"left" | "right" | null>(null);
  const MAX_LEFT = 128;
  const MAX_RIGHT = 88;
  const THRESHOLD = 56;

  function handlePointerDown(e: React.PointerEvent) {
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    setStartX(e.clientX);
  }

  function handlePointerMove(e: React.PointerEvent) {
    if (startX == null) return;
    const dx = e.clientX - startX;
    const base =
      openSide === "left" ? MAX_RIGHT : openSide === "right" ? -MAX_LEFT : 0;
    const next = Math.max(-MAX_LEFT, Math.min(MAX_RIGHT, base + dx));
    setOffset(next);
  }

  function handlePointerUp() {
    if (startX == null) return;
    let side: "left" | "right" | null = null;
    if (offset >= THRESHOLD) side = "left";
    if (offset <= -THRESHOLD) side = "right";

    setOpenSide(side);
    if (side === "left") setOffset(MAX_RIGHT);
    else if (side === "right") setOffset(-MAX_LEFT);
    else setOffset(0);
    setStartX(null);
  }

  function closeIfOpen() {
    if (openSide) {
      setOpenSide(null);
      setOffset(0);
    }
  }

  return (
    <div className="relative touch-pan-y select-none">
      {/* Left action (Contact) */}
      <div className="absolute inset-y-0 left-0 flex items-center pl-3 pr-2">
        <Button
          variant="outline"
          size="icon"
          className="rounded-full"
          onClick={(e) => {
            e.preventDefault();
            onContact?.();
            closeIfOpen();
          }}
          aria-label="Open contact"
        >
          <User className="h-4 w-4" />
        </Button>
      </div>

      {/* Right actions */}
      <div className="absolute inset-y-0 right-0 flex items-center gap-2 pr-2 pl-4">
        <Button
          variant="outline"
          size="icon"
          className="rounded-full"
          onClick={(e) => {
            e.preventDefault();
            onArchive?.();
            closeIfOpen();
          }}
          aria-label="Archive"
        >
          <Archive className="h-4 w-4" />
        </Button>
        <Button
          variant="destructive"
          size="icon"
          className="rounded-full"
          onClick={(e) => {
            e.preventDefault();
            onDelete?.();
            closeIfOpen();
          }}
          aria-label="Delete"
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>

      {/* Foreground row */}
      <div
        role={!disabled ? "button" : undefined}
        onPointerDown={disabled ? undefined : handlePointerDown}
        onPointerMove={disabled ? undefined : handlePointerMove}
        onPointerUp={disabled ? undefined : handlePointerUp}
        onPointerCancel={disabled ? undefined : handlePointerUp}
        style={{
          transform: !disabled ? `translateX(${offset}px)` : undefined,
          transition: startX && !disabled ? "none" : "transform 200ms ease",
        }}
        className="bg-background"
      >
        {children}
      </div>
    </div>
  );
}

// -----------------------------------------------------------------------------
// PAGE COMPONENT
// -----------------------------------------------------------------------------
export default function MessagesPage() {
  const [activeFilter, setActiveFilter] =
    useState<(typeof filters)[number]>("All");
  const [selectMode, setSelectMode] = useState(false);
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const selectedCount = Object.values(selected).filter(Boolean).length;

  // actual conversations from Supabase
  const [loading, setLoading] = useState(true);
  const [userConversations, setUserConversations] = useState<DBConversation[]>(
    []
  );
  const [loadError, setLoadError] = useState<string | null>(null);
  const [connectionNames, setConnectionNames] = useState<
    Record<string, { name?: string | null; profileTitle?: string | null }>
  >({});
  const [connectionsLoaded, setConnectionsLoaded] = useState(false);

  const [rawRows, setRawRows] = useState<any[] | null>(null);
  const convoIdsRef = useRef<Set<string>>(new Set());
  const [showDebug, setShowDebug] = useState(false);
  const listItemRefs = useRef<Map<string, HTMLLIElement>>(new Map());
  const listPositionsRef = useRef<Map<string, DOMRect>>(new Map());
  const listReadyRef = useRef(false);
  // Ref mapping user_id -> conversation ids for 1:1
  const userToConvoRef = useRef<Record<string, string[]>>({});
  const convoToOtherRef = useRef<Record<string, string | null>>({});
  const messageToConvoRef = useRef<Record<string, string>>({});
  const messageSenderRef = useRef<Record<string, string>>({});

  // 👇 NEW: show what user the client thinks is logged in
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const currentUserIdRef = useRef<string | null>(null);
  const { presence: presenceCtx } = usePresence();
  useEffect(() => {
    currentUserIdRef.current = currentUserId;
  }, [currentUserId]);

  useEffect(() => {
    const load = async () => {
      try {
        const supabase = createClient();

        // 1) who am I?
        const {
          data: { user },
          error: userError,
        } = await supabase.auth.getUser();
        let activeUser = user;
        if (!activeUser || userError) {
          const { data: sessionData } = await supabase.auth.getSession();
          activeUser = sessionData.session?.user ?? null;
        }

        if (!activeUser) {
          setCurrentUserId(null);
          setUserConversations([]);
          setRawRows([]);
          setLoadError(userError ? userError.message : "Not authenticated");
          setLoading(false);
          return;
        }

        setCurrentUserId(activeUser.id);

        // 2) my memberships (which conversations I'm in)
        let { data: myMemberships, error: myMembershipsError } =
          await supabase
            .from("conversation_members")
            .select("conversation_id, user_id, role, joined_at")
            .eq("user_id", activeUser.id)
            .order("joined_at", { ascending: false });

        if (!myMembershipsError && (!myMemberships || myMemberships.length === 0)) {
          try {
            const { data: fallbackMemberships, error: fallbackError } =
              await supabase.rpc("get_my_conversation_memberships_secure");
            if (!fallbackError && Array.isArray(fallbackMemberships)) {
              myMemberships = fallbackMemberships;
            } else if (fallbackError) {
              myMembershipsError = fallbackError;
            }
          } catch (err: any) {
            myMembershipsError = err;
          }
        }

        if (myMembershipsError) {
          setLoadError(myMembershipsError.message);
          setUserConversations([]);
          setRawRows([]);
          setLoading(false);
          return;
        }

        setRawRows(myMemberships ?? []);

        // if user is in no conversations, we're done
        if (!myMemberships || myMemberships.length === 0) {
          setUserConversations([]);
          setLoadError(null);
          setLoading(false);
          return;
        }

        // 3) collect all conversation IDs
        const convoIds = Array.from(
          new Set(myMemberships.map((m) => m.conversation_id))
        );
        convoIdsRef.current = new Set(convoIds);

        // --- fetch latest messages for each conversation ---
        let msgs: any[] | null = null;
        try {
          const { data: rpcMessages, error: rpcErr } = await supabase.rpc(
            "get_latest_messages_secure",
            { convo_ids: convoIds }
          );
          if (rpcErr) {
            console.warn("messages fetch failed", rpcErr.message);
          } else {
            msgs = rpcMessages ?? [];
          }
        } catch (err: any) {
          console.warn("messages fetch failed", err?.message ?? err);
        }
        if (!msgs) {
          const { data: fallbackMsgs, error: msgsError } = await supabase
            .from("messages")
            .select(
              "id, body, ciphertext, nonce, conversation_id, sender_id, created_at"
            )
            .in("conversation_id", convoIds)
            .order("created_at", { ascending: false });
          if (msgsError) {
            console.warn("messages fetch failed", msgsError.message);
          }
          msgs = fallbackMsgs ?? [];
        }
        const latestByConvo: Record<string, any> = {};
        for (const m of msgs ?? []) {
          if (m?.id && m?.conversation_id) {
            messageToConvoRef.current[m.id] = m.conversation_id;
            if (m.sender_id) messageSenderRef.current[m.id] = m.sender_id;
          }
          if (!latestByConvo[m.conversation_id])
            latestByConvo[m.conversation_id] = m;
        }

        // Compute unread counts per conversation for messages from others
        const otherMsgs = (msgs ?? []).filter(
          (m) => m.sender_id !== activeUser.id
        );
        const otherMsgIds = otherMsgs.map((m) => m.id);
        let readByMsgId: Record<string, boolean> = {};
        if (otherMsgIds.length) {
          const { data: readRecs } = await supabase
            .from("message_receipts")
            .select("message_id, read_at")
            .in("message_id", otherMsgIds)
            .eq("user_id", activeUser.id)
            .not("read_at", "is", null);
          for (const r of readRecs ?? []) readByMsgId[r.message_id] = true;
        }
        const unreadByConvo: Record<string, number> = {};
        for (const m of otherMsgs) {
          const cid = m.conversation_id as string;
          if (!readByMsgId[m.id]) {
            unreadByConvo[cid] = (unreadByConvo[cid] ?? 0) + 1;
          }
        }

        // 4) fetch ALL members for ALL those conversations (NO joins here!)
        let { data: allMembers, error: allMembersError } = await supabase
          .from("conversation_members")
          .select("conversation_id, user_id, role, joined_at")
          .in("conversation_id", convoIds);

        if (
          !allMembersError &&
          (!allMembers || allMembers.length === 0) &&
          convoIds.length
        ) {
          try {
            const { data: fallbackMembers, error: fallbackError } =
              await supabase.rpc("get_conversation_members_secure", {
                convo_ids: convoIds,
              });
            if (!fallbackError && Array.isArray(fallbackMembers)) {
              allMembers = fallbackMembers;
            } else if (fallbackError) {
              allMembersError = fallbackError;
            }
          } catch (err: any) {
            allMembersError = err;
          }
        }

        if (allMembersError) {
          setLoadError(allMembersError.message);
          setUserConversations([]);
          setLoading(false);
          return;
        }

        // 5) we ALSO need the conversation rows (to get name)
        const { data: convoRows, error: convoRowsError } = await supabase
          .from("conversations")
          .select("id, name, type")
          .in("id", convoIds);

        // If RLS blocks conversations, we still want to render the list using fallbacks.
        // So we do NOT early-return here.
        if (convoRowsError) {
          console.warn("conversations fetch failed", convoRowsError.message);
        }

        const convoById: Record<string, any> = {};
        if (convoRows && Array.isArray(convoRows)) {
          for (const c of convoRows) {
            convoById[c.id] = c;
          }
        }

        const groupConvoIds = (convoRows ?? [])
          .filter((c) => String(c.type || "").toLowerCase() === "group")
          .map((c) => c.id);
        const groupCoverById: Record<string, string | null> = {};
        if (groupConvoIds.length) {
          const { data: groupRows } = await supabase
            .from("groups")
            .select("id, cover_image_url")
            .in("id", groupConvoIds);
          for (const g of groupRows ?? []) {
            groupCoverById[g.id] = g.cover_image_url || null;
          }
        }

        // 6) collect ALL user_ids from allMembers so we can fetch profiles separately
        const allUserIds = Array.from(
          new Set((allMembers ?? []).map((m) => m.user_id))
        );

        // 7) fetch profiles for those users
        // assumes public.profiles(id uuid pk, profile_title, avatar_url, name)
        let profileById: Record<string, any> = {};
        try {
          const { data: profiles, error: profilesError } = await supabase
            .from("profiles")
            .select("id, name, profile_title, avatar_url")
            .in("id", allUserIds);

          if (profilesError) {
            console.warn("profiles fetch failed", profilesError.message);
          } else {
            for (const p of profiles ?? []) {
              profileById[p.id] = p;
            }
          }
        } catch (err: any) {
          console.warn("profiles fetch failed", err?.message ?? err);
        }

        if (Object.keys(profileById).length === 0 && allUserIds.length) {
          try {
            const { data: profiles, error: profilesError } = await supabase.rpc(
              "get_profiles_secure",
              { user_ids: allUserIds }
            );
            if (profilesError) {
              console.warn("profiles fetch failed", profilesError.message);
            } else {
              for (const p of profiles ?? []) {
                profileById[p.id] = p;
              }
            }
          } catch (err: any) {
            console.warn("profiles fetch failed", err?.message ?? err);
          }
        }

        const directOtherByConvo: Record<string, any> = {};
        if (convoIds.length && Object.keys(profileById).length === 0) {
          try {
            const results = await Promise.all(
              convoIds.map(async (convoId) => {
                const { data: otherRows, error } = await supabase.rpc(
                  "get_direct_other",
                  { convo_id: convoId }
                );
                if (error) return null;
                const row = Array.isArray(otherRows) ? otherRows[0] : otherRows;
                if (!row?.user_id) return null;
                return [convoId, row] as const;
              })
            );
            results.forEach((item) => {
              if (!item) return;
              const [cid, row] = item;
              directOtherByConvo[cid] = row;
            });
          } catch (err: any) {
            console.warn("profiles fetch failed", err?.message ?? err);
          }
        }

        // 7.1) presence for all users
        const { data: presenceRows } = await supabase
          .from("user_presence")
          .select("user_id, status, updated_at")
          .in("user_id", allUserIds);
        const presenceByUser: Record<
          string,
          { status: string | null; updated_at: string | null }
        > = {};
        for (const r of presenceRows ?? []) {
          presenceByUser[r.user_id] = {
            status: r.status ?? null,
            updated_at: r.updated_at ?? null,
          };
        }
        const classifyPresence = (row?: {
          status: string | null;
          updated_at: string | null;
        }) => {
          if (!row || !row.updated_at) return null;
          const updated = new Date(row.updated_at).getTime();
          const now = Date.now();
          const minutes = (now - updated) / 60000;
          if (minutes > 60) return null; // offline too long
          if (minutes <= 60 && minutes > 5) return "recent";
          // <= 5 minutes -> online/away depending on status
          if (row.status === "away") return "away";
          return "online";
        };

        // 8) group members by conversation
        const byConvo: Record<string, any[]> = {};
        for (const m of allMembers ?? []) {
          if (!byConvo[m.conversation_id]) byConvo[m.conversation_id] = [];
          byConvo[m.conversation_id].push(m);
        }

        // --- gather receipts for 1:1 where I am the last sender ---
        // determine recipients for 1:1 where I am the last sender
        const candidateMsgIds: string[] = [];
        const candidateRecipientIds: Set<string> = new Set();
        for (const convoId of convoIds) {
          const latest = latestByConvo[convoId];
          const members = byConvo[convoId] ?? [];
          const others = members.filter(
            (m: any) => m.user_id !== activeUser.id
          );
          const isGroup = members.length > 2;
          if (
            !isGroup &&
            latest &&
            latest.sender_id === activeUser.id &&
            others[0]
          ) {
            candidateMsgIds.push(latest.id);
            candidateRecipientIds.add(others[0].user_id);
          }
        }

        let receiptsByMsg: Record<
          string,
          { delivered_at: string | null; read_at: string | null }
        > = {};
        if (candidateMsgIds.length) {
          const { data: recs, error: recErr } = await supabase
            .from("message_receipts")
            .select("message_id, user_id, delivered_at, read_at")
            .in("message_id", candidateMsgIds)
            .in("user_id", Array.from(candidateRecipientIds));
          if (!recErr) {
            for (const r of recs ?? []) {
              receiptsByMsg[r.message_id] = {
                delivered_at: r.delivered_at ?? null,
                read_at: r.read_at ?? null,
              };
            }
          }
        }

        // 1:1 user_id -> conversation id(s) mapping
        const userToConvo: Record<string, string[]> = {};

        // 9) build the final display list
        const displayConvos = convoIds.map((convoId) => {
          const myRow = myMemberships.find(
            (m) => m.conversation_id === convoId
          );
          const members = byConvo[convoId] ?? [];
          const convoRow = convoById[convoId] ?? null;
          const others = members.filter((m) => m.user_id !== activeUser.id);
          const convoType =
            typeof convoRow?.type === "string"
              ? convoRow.type.toLowerCase()
              : null;
          const isGroup = convoType === "group" || members.length > 2;

          let name: string;
          let secondary: string | null = null;
          let avatar: string | null = null;
          let presence: "online" | "away" | "recent" | null = null;

          if (isGroup) {
            // group: prefer conversation.name
            name =
              (convoRow && convoRow.name) ||
              (members.length
                ? `${members.length} people`
                : "Group conversation");
            avatar = resolveCoverUrl(groupCoverById[convoId]);
          } else {
            // 1:1: show the other participant's profile title, NOT their user_id
            const other = others[0];
            const otherProfile = other ? profileById[other.user_id] : null;
            const directFallback = directOtherByConvo[convoId] ?? null;
            name =
              (otherProfile && otherProfile.name) ||
              directFallback?.name ||
              "Unknown user";
            const override = connectionNames[other?.user_id ?? ""];
            if (override?.name) {
              name = override.name || name;
              secondary = override.profileTitle || null;
            } else {
              secondary =
                otherProfile?.profile_title ||
                directFallback?.profile_title ||
                null;
            }
            avatar =
              otherProfile?.avatar_url ?? directFallback?.avatar_url ?? null;
            presence =
              !isGroup && other
                ? classifyPresence(presenceByUser[other.user_id])
                : null;
            // Record mapping for 1:1 threads
            if (!isGroup && others[0]?.user_id) {
              const ouid = others[0].user_id as string;
              if (!userToConvo[ouid]) userToConvo[ouid] = [];
              if (!userToConvo[ouid].includes(convoId))
                userToConvo[ouid].push(convoId);
              convoToOtherRef.current[convoId] = ouid;
            }
          }

          const latest = latestByConvo[convoId] ?? null;
          const lastMessage = latest?.body ?? null;
          const lastMessageEncrypted = Boolean(
            !lastMessage && latest?.ciphertext
          );
          const lastMessageAt = latest?.created_at ?? null;
          const lastMessageSenderId = latest?.sender_id ?? null;

          // Use only explicit presence (from Supabase or presence context)
          const effectivePresence = presence;

          let lastReceipt: {
            delivered_at: string | null;
            read_at: string | null;
          } | null = null;
          if (!isGroup && latest && latest.sender_id === activeUser.id) {
            lastReceipt = receiptsByMsg[latest.id] ?? {
              delivered_at: null,
              read_at: null,
            };
          }

          return {
            id: convoId,
            name,
            avatar,
            lastMessage,
            lastMessageEncrypted,
            lastMessageId: latest?.id ?? null,
            updated_at: lastMessageAt ?? myRow?.joined_at ?? null,
            lastMessageAt,
            lastMessageSenderId,
            lastReceipt,
            unreadCount: unreadByConvo[convoId] ?? 0,
            presence: effectivePresence,
            secondary,
            isGroup,
          } as DBConversation;
        });

        setUserConversations(sortConversations(displayConvos));
        userToConvoRef.current = userToConvo;
        // Build reverse map for overrides
        const convToOther: Record<string, string | null> = {};
        Object.entries(userToConvo).forEach(([uid, convs]) => {
          convs.forEach((cid) => {
            convToOther[cid] = uid;
          });
        });
        convoToOtherRef.current = convToOther;
        initRealtime(convoIds);
        setLoadError(null);
        setLoading(false);
      } catch (err: any) {
        console.error("unexpected", err);
        setLoadError(err?.message ?? "Unexpected error");
        setUserConversations([]);
        setLoading(false);
      }
    };

    load();
  }, []);

  const realtimeChannelRef = useRef<ReturnType<
    ReturnType<typeof createClient>["channel"]
  > | null>(null);

  async function fetchConversationSummary(
    convoId: string,
    userId: string
  ): Promise<DBConversation | null> {
    try {
      const supabase = createClient();
      const [{ data: convoRow }, { data: memberRows, error: memberError }] =
        await Promise.all([
          supabase
            .from("conversations")
            .select("id, name, type")
            .eq("id", convoId)
            .maybeSingle(),
          supabase
            .from("conversation_members")
            .select("conversation_id, user_id, role, joined_at")
            .eq("conversation_id", convoId),
        ]);

      if (memberError) return null;
      const members = memberRows ?? [];
      const myMembership = members.find((m) => m.user_id === userId) ?? null;
      const convoType =
        typeof convoRow?.type === "string" ? convoRow.type.toLowerCase() : null;
      const isGroup = convoType === "group" || members.length > 2;

      let latest: any | null = null;
      try {
        const { data: rpcMessages, error: rpcErr } = await supabase.rpc(
          "get_messages_secure",
          { convo_id: convoId, limit_count: 1, before_time: null }
        );
        if (rpcErr) {
          console.warn("messages fetch failed", rpcErr.message);
        } else {
          latest = Array.isArray(rpcMessages) ? rpcMessages[0] : null;
        }
      } catch (err: any) {
        console.warn("messages fetch failed", err?.message ?? err);
      }
      if (!latest) {
        const { data: fallbackLatest } = await supabase
          .from("messages")
          .select("id, body, ciphertext, conversation_id, sender_id, created_at")
          .eq("conversation_id", convoId)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        latest = fallbackLatest ?? null;
      }

      if (latest?.id && latest?.conversation_id) {
        messageToConvoRef.current[latest.id] = latest.conversation_id;
        if (latest.sender_id) {
          messageSenderRef.current[latest.id] = latest.sender_id;
        }
      }

      let name = convoRow?.name || "Group conversation";
      let secondary: string | null = null;
      let avatar: string | null = null;
      let presence: "online" | "away" | "recent" | null = null;

      if (!isGroup) {
        const other = members.find((m) => m.user_id !== userId);
        const otherId = other?.user_id ?? null;
        if (otherId) {
          let otherProfile: any | null = null;
          try {
            const { data: row, error: otherProfileError } = await supabase
              .from("profiles")
              .select("id, name, profile_title, avatar_url")
              .eq("id", otherId)
              .maybeSingle();
            if (!otherProfileError) {
              otherProfile = row ?? null;
            }
          } catch {
            // ignore
          }
          if (!otherProfile) {
            try {
              const { data: rows } = await supabase.rpc("get_profiles_secure", {
                user_ids: [otherId],
              });
              otherProfile = Array.isArray(rows) ? rows[0] : null;
            } catch {
              // ignore
            }
          }
          if (!otherProfile) {
            try {
              const { data: otherRows } = await supabase.rpc("get_direct_other", {
                convo_id: convoId,
              });
              const row = Array.isArray(otherRows) ? otherRows[0] : otherRows;
              if (row?.user_id) {
                otherProfile = {
                  id: row.user_id,
                  name: row.name ?? null,
                  profile_title: row.profile_title ?? null,
                  avatar_url: row.avatar_url ?? null,
                };
              }
            } catch {
              // ignore
            }
          }
          name = otherProfile?.name || "Unknown user";
          const override = connectionNames[otherId];
          if (override?.name) {
            name = override.name || name;
            secondary = override.profileTitle || null;
          } else {
            secondary = otherProfile?.profile_title || null;
          }
          avatar = otherProfile?.avatar_url ?? null;
          const entry = presenceCtx?.[otherId];
          presence = entry ? toUiPresence(entry as any) : null;
          if (!userToConvoRef.current[otherId]) {
            userToConvoRef.current[otherId] = [];
          }
          if (!userToConvoRef.current[otherId].includes(convoId)) {
            userToConvoRef.current[otherId].push(convoId);
          }
          convoToOtherRef.current[convoId] = otherId;
        }
      } else {
        name =
          convoRow?.name ||
          (members.length ? `${members.length} people` : "Group conversation");
        const { data: groupRow } = await supabase
          .from("groups")
          .select("cover_image_url")
          .eq("id", convoId)
          .maybeSingle();
        avatar = resolveCoverUrl(groupRow?.cover_image_url ?? null);
      }

      let unreadCount = 0;
      if (latest && latest.sender_id !== userId) {
        const { data: convoMsgs } = await supabase
          .from("messages")
          .select("id, sender_id")
          .eq("conversation_id", convoId)
          .neq("sender_id", userId);
        const msgIds = (convoMsgs ?? []).map((m) => m.id);
        if (msgIds.length) {
          const { data: readRecs } = await supabase
            .from("message_receipts")
            .select("message_id, read_at")
            .in("message_id", msgIds)
            .eq("user_id", userId)
            .not("read_at", "is", null);
          const readById = new Set(
            (readRecs ?? []).map((r) => r.message_id)
          );
          unreadCount = msgIds.filter((id) => !readById.has(id)).length;
        }
      }

      let lastReceipt: { delivered_at: string | null; read_at: string | null } | null =
        null;
      if (!isGroup && latest && latest.sender_id === userId) {
        const otherId = convoToOtherRef.current[convoId];
        if (otherId) {
          const { data: receiptRow } = await supabase
            .from("message_receipts")
            .select("delivered_at, read_at")
            .eq("message_id", latest.id)
            .eq("user_id", otherId)
            .maybeSingle();
          if (receiptRow) {
            lastReceipt = {
              delivered_at: receiptRow.delivered_at ?? null,
              read_at: receiptRow.read_at ?? null,
            };
          }
        }
      }

      return {
        id: convoId,
        name,
        avatar,
        lastMessage: latest?.body ?? null,
        lastMessageEncrypted: Boolean(!latest?.body && latest?.ciphertext),
        lastMessageId: latest?.id ?? null,
        updated_at: latest?.created_at ?? myMembership?.joined_at ?? null,
        lastMessageAt: latest?.created_at ?? null,
        lastMessageSenderId: latest?.sender_id ?? null,
        lastReceipt,
        unreadCount,
        presence,
        secondary,
        isGroup,
      };
    } catch {
      return null;
    }
  }

  function initRealtime(convoIds: string[]) {
    try {
      // Avoid duplicate subscriptions
      if (realtimeChannelRef.current) return;
      const supabase = createClient();
      const channel = supabase.channel("messages:list");

      // New messages
      channel.on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages" },
        (payload: any) => {
          const m = payload.new as {
            id: string;
            body: string;
            ciphertext?: string | null;
            conversation_id: string;
            sender_id: string;
            created_at: string;
          };
          if (!convoIdsRef.current.has(m.conversation_id)) {
            const uid = currentUserIdRef.current;
            if (!uid) return;
            (async () => {
              try {
                const supa = createClient();
                const { data: memberRow } = await supa
                  .from("conversation_members")
                  .select("conversation_id")
                  .eq("conversation_id", m.conversation_id)
                  .eq("user_id", uid)
                  .maybeSingle();
                if (!memberRow) return;
                convoIdsRef.current.add(m.conversation_id);
                const summary = await fetchConversationSummary(
                  m.conversation_id,
                  uid
                );
                if (!summary) return;
                setUserConversations((prev) => {
                  if (prev.some((c) => c.id === m.conversation_id)) return prev;
                  return sortConversations([...prev, summary]);
                });
              } catch {
                // ignore
              }
            })();
            return;
          }
          if (m.id) {
            messageToConvoRef.current[m.id] = m.conversation_id;
            if (m.sender_id) messageSenderRef.current[m.id] = m.sender_id;
          }

          setUserConversations((prev) => {
            const next = prev.map((c) => {
              if (c.id !== m.conversation_id) return c;
              // Only update if this is newer than what we show
              const isNewer =
                !c.lastMessageAt ||
                new Date(m.created_at).getTime() >=
                  new Date(c.lastMessageAt).getTime();
              if (!isNewer) return c;
              return {
                ...c,
                lastMessage: m.body,
                lastMessageEncrypted: Boolean(!m.body && m.ciphertext),
                lastMessageId: m.id,
                lastMessageAt: m.created_at,
                lastMessageSenderId: m.sender_id,
                updated_at: m.created_at,
                lastReceipt:
                  m.sender_id === currentUserIdRef.current
                    ? { delivered_at: null, read_at: null }
                    : c.lastReceipt,
                unreadCount:
                  m.sender_id !== currentUserIdRef.current
                    ? (c.unreadCount ?? 0) + 1
                    : c.unreadCount ?? 0,
              };
            });
            return sortConversations(next);
          });
        }
      );

      // New conversation membership (e.g. added to a group)
      channel.on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "conversation_members" },
        async (payload: any) => {
          const row = payload.new as {
            conversation_id?: string;
            user_id?: string;
          };
          const convoId = row?.conversation_id;
          const userId = row?.user_id;
          if (!convoId || !userId) return;
          if (userId !== currentUserIdRef.current) return;
          if (convoIdsRef.current.has(convoId)) return;

          convoIdsRef.current.add(convoId);
          const summary = await fetchConversationSummary(convoId, userId);
          if (!summary) return;
          setUserConversations((prev) => {
            if (prev.some((c) => c.id === convoId)) return prev;
            return sortConversations([...prev, summary]);
          });
        }
      );

      // Message receipts (delivered/read) realtime
      channel.on(
        "postgres_changes",
        { event: "*", schema: "public", table: "message_receipts" },
        async (payload: any) => {
          const r = (payload.new ?? payload.old) as {
            message_id?: string;
            user_id?: string;
            delivered_at?: string | null;
            read_at?: string | null;
          };
          const msgId = r?.message_id;
          if (!msgId) return;

          // Map message -> conversation (lookup, fetch if missing)
          let convoId = messageToConvoRef.current[msgId];
          let senderId = messageSenderRef.current[msgId];
          if (!convoId || !senderId) {
            try {
              const supa = createClient();
              const { data: msgRow } = await supa
                .from("messages")
                .select("conversation_id, sender_id")
                .eq("id", msgId)
                .maybeSingle();
              if (msgRow?.conversation_id) {
                convoId = msgRow.conversation_id;
                messageToConvoRef.current[msgId] = convoId;
              }
              if (msgRow?.sender_id) {
                senderId = msgRow.sender_id;
                messageSenderRef.current[msgId] = senderId;
              }
            } catch {
              // ignore
            }
          }
          if (!convoId) return;

          // 1) If this receipt is for a message from the current user, update lastReceipt markers when it is the latest message
          if (senderId === currentUserIdRef.current) {
            setUserConversations((prev) =>
              prev.map((c) => {
                if (c.id !== convoId) return c;
                if (!c.lastMessageId || c.lastMessageId !== msgId) return c;
                const nextReceipt = {
                  delivered_at:
                    r.delivered_at ?? c.lastReceipt?.delivered_at ?? null,
                  read_at: r.read_at ?? c.lastReceipt?.read_at ?? null,
                };
                return { ...c, lastReceipt: nextReceipt };
              })
            );
          }

          // 2) If this receipt is from the current user reading others' messages, decrement unread
          if (r.user_id === currentUserIdRef.current && r.read_at) {
            setUserConversations((prev) =>
              prev.map((c) => {
                if (c.id !== convoId) return c;
                // only decrement when the message was from the other user
                if (senderId === currentUserIdRef.current) return c;
                const nextUnread = Math.max(0, (c.unreadCount ?? 0) - 1);
                return { ...c, unreadCount: nextUnread };
              })
            );
          }
        }
      );

      // Presence changes (DB: public.user_presence)
      channel.on(
        "postgres_changes",
        { event: "*", schema: "public", table: "user_presence" },
        (payload: any) => {
          const row = (payload.new ?? payload.old) as {
            user_id?: string;
            status?: string | null;
            updated_at?: string | null;
            last_seen?: string | null;
            lat?: number | null;
            lng?: number | null;
          };
          const uid = row?.user_id;
          if (!uid) return;
          const uiPresence = toUiPresence({
            status: row.status ?? null,
            updated_at: row.updated_at ?? null,
            last_seen: row.last_seen ?? null,
            lat: row.lat ?? null,
            lng: row.lng ?? null,
          });
          const convos = userToConvoRef.current[uid];
          if (!convos || convos.length === 0) return;
          setUserConversations((prev) =>
            prev.map((c) =>
              convos.includes(c.id) ? { ...c, presence: uiPresence } : c
            )
          );
        }
      );

      channel.subscribe((status) => {
        if (process.env.NODE_ENV !== "production") {
          // console.debug("realtime status", status);
        }
      });

      realtimeChannelRef.current = channel;
    } catch (e) {
      // noop
    }
  }

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      try {
        if (realtimeChannelRef.current) {
          const supabase = createClient();
          supabase.removeChannel(realtimeChannelRef.current);
          realtimeChannelRef.current = null;
        }
      } catch {}
    };
  }, []);

  // Fetch connections to map nicknames/profile titles by profile id
  useEffect(() => {
    let active = true;
    fetch("/api/connections")
      .then((res) => res.json())
      .then((body) => {
        if (!active) return;
        const map: Record<
          string,
          { name?: string | null; profileTitle?: string | null }
        > = {};
        for (const conn of body?.connections ?? []) {
          if (conn.type === "contact") {
            const contact = Array.isArray(conn.connection_contacts)
              ? conn.connection_contacts[0]
              : conn.connection_contacts;
            const pid = contact?.profile_id || contact?.profiles?.id;
            if (pid) {
              map[pid] = {
                name: contact?.display_name || null,
                profileTitle: contact?.profiles?.profile_title || null,
              };
            }
          } else if (conn.type === "pin") {
            const pin = Array.isArray(conn.connection_pins)
              ? conn.connection_pins[0]
              : conn.connection_pins;
            const pid = pin?.pinned_profile_id || pin?.pinned_profile?.id;
            if (pid) {
              map[pid] = {
                name: pin?.nickname || null,
                profileTitle: pin?.pinned_profile?.profile_title || null,
              };
            }
          }
        }
        setConnectionNames(map);
      })
      .catch(() => {})
      .finally(() => {
        if (active) setConnectionsLoaded(true);
      });
    return () => {
      active = false;
    };
  }, []);

  // Apply connection nicknames after fetch
  useEffect(() => {
    const map = connectionNames;
    if (!map || Object.keys(map).length === 0) return;
    setUserConversations((prev) =>
      prev.map((c) => {
        const otherId = convoToOtherRef.current[c.id];
        if (!otherId) return c;
        const override = map[otherId];
        if (!override) return c;
        return {
          ...c,
          name: override.name || c.name,
          secondary: override.profileTitle || c.secondary || null,
        };
      })
    );
  }, [connectionNames]);

  // Apply presence updates from shared presence context
  useEffect(() => {
    if (!presenceCtx || Object.keys(presenceCtx).length === 0) return;
    setUserConversations((prev) =>
      prev.map((c) => {
        const otherId = convoToOtherRef.current[c.id];
        if (!otherId) return c;
        const entry = presenceCtx[otherId];
        if (!entry) return c;
        const uiPresence = toUiPresence(entry as any);
        return { ...c, presence: uiPresence };
      })
    );
  }, [presenceCtx]);

  const listReady = !loading && connectionsLoaded;
  const hasNoConvos =
    listReady && userConversations.length === 0 && !loadError && !!currentUserId;
  const visibleConversations =
    activeFilter === "Unread"
      ? userConversations.filter((c) => (c.unreadCount ?? 0) > 0)
      : activeFilter === "Groups"
      ? userConversations.filter((c) => c.isGroup)
      : activeFilter === "Favourites"
      ? []
      : userConversations;
  const hasUnreadEmpty =
    activeFilter === "Unread" &&
    listReady &&
    !loadError &&
    visibleConversations.length === 0;
  const hasFavouritesEmpty =
    activeFilter === "Favourites" &&
    listReady &&
    !loadError &&
    visibleConversations.length === 0;
  const unreadTotal = userConversations.reduce(
    (acc, c) => acc + (c.unreadCount ?? 0),
    0
  );

  const toStatus = (
    presence: DBConversation["presence"]
  ): "online" | "away" | "offline" => {
    if (presence === "online") return "online";
    if (presence === "away" || presence === "recent") return "away";
    return "offline";
  };

  useLayoutEffect(() => {
    if (!listReady) return;
    const nextPositions = new Map<string, DOMRect>();
    listItemRefs.current.forEach((el, id) => {
      if (!el) return;
      nextPositions.set(id, el.getBoundingClientRect());
    });

    if (listReadyRef.current) {
      nextPositions.forEach((next, id) => {
        const prev = listPositionsRef.current.get(id);
        if (!prev) return;
        const dy = prev.top - next.top;
        if (dy === 0) return;
        const el = listItemRefs.current.get(id);
        if (!el) return;
        el.animate(
          [{ transform: `translateY(${dy}px)` }, { transform: "translateY(0)" }],
          {
            duration: 220,
            easing: "cubic-bezier(0.22, 1, 0.36, 1)",
          }
        );
      });
    } else {
      listReadyRef.current = true;
    }

    listPositionsRef.current = nextPositions;
  }, [listReady, visibleConversations]);

  return (
    <div className="pb-14">
      <div className="flex items-center gap-2 pb-2 px-4">
        <h1 className="flex-1 px-1 text-4xl font-extrabold tracking-tight">
          Messages
        </h1>
        {/* Actions moved to TopBar; leave space for layout if needed */}
      </div>
      {/* Search */}
      <div className="pb-5 px-4">
        <InputGroup className="border-0 shadow-none">
          <InputGroupInput placeholder="Ask or search messages" />
          <InputGroupAddon>
            <Search className="h-4 w-4 text-muted-foreground" />
          </InputGroupAddon>
        </InputGroup>
      </div>

      {/* Filter chips */}
      <div className="flex gap-2 overflow-x-auto pb-3 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
        <div className="pl-2.5"></div>
        {filters.map((f) => (
          <Button
            key={f}
            size="sm"
            variant={activeFilter === f ? "default" : "outline"}
            className={`rounded-full ${
              activeFilter === f ? "" : "border-muted/40"
            }`}
            onClick={() => setActiveFilter(f)}
          >
            <span className="flex items-center gap-2">
              <span>{f}</span>
              {f === "Unread" && unreadTotal > 0 ? (
                <span className="inline-flex min-w-[18px] items-center justify-center rounded-full bg-primary/15 px-1.5 py-0.5 text-[10px] font-semibold text-primary">
                  {unreadTotal}
                </span>
              ) : null}
            </span>
          </Button>
        ))}
        <div className="pr-2.5"></div>
      </div>

      {/* Archived row */}
      {activeFilter === "All" ? (
        <div className="px-4">
          <ListItemRow
            left={<Archive className="h-5 w-5 text-muted-foreground" />}
            right={
              <span className="truncate text-base font-semibold text-muted-foreground">
                Archived
              </span>
            }
          />
        </div>
      ) : null}

      {/* EMPTY STATE */}
      {hasNoConvos || hasUnreadEmpty || hasFavouritesEmpty ? (
        <div className="pt-8 px-4">
          <Empty>
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <Inbox className="h-6 w-6" />
              </EmptyMedia>
              <EmptyTitle>
                {hasUnreadEmpty
                  ? "No unread messages"
                  : hasFavouritesEmpty
                  ? "No favourites yet"
                  : "No messages yet"}
              </EmptyTitle>
              <EmptyDescription>
                {hasUnreadEmpty
                  ? "You're all caught up."
                  : hasFavouritesEmpty
                  ? "Star a conversation to keep it here."
                  : "When you start chatting, your conversations will appear here."}
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        </div>
      ) : !listReady ? (
        <ul className="px-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <li key={`skeleton-${i}`}>
              <ListItemRow
                left={<Skeleton className="h-12 w-12 rounded-full" />}
                right={
                  <div className="min-w-0 grid grid-cols-[minmax(0,1fr)_auto] gap-x-3">
                    <div className="col-start-1">
                      <Skeleton className="h-4 w-40" />
                    </div>
                    <div className="col-start-2 row-start-1 flex justify-end">
                      <Skeleton className="h-3 w-10" />
                    </div>
                    <div className="col-start-1 row-start-2 mt-1">
                      <Skeleton className="h-3 w-52" />
                    </div>
                    <div className="col-start-2 row-start-2 mt-1 flex justify-end">
                      <Skeleton className="h-3 w-6" />
                    </div>
                  </div>
                }
              />
            </li>
          ))}
        </ul>
      ) : (
        // CONVERSATION LIST
        <ul className="px-4 animate-in fade-in duration-300">
          {/* if there's an error, show it in-list */}
          {loadError ? (
            <li className="bg-destructive/5 py-3 flex items-start gap-3">
              <div className="h-8 w-8 rounded-full bg-destructive/10 flex items-center justify-center text-destructive">
                <AlertTriangle className="h-4 w-4" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-destructive">
                  Couldn’t load your conversations
                </p>
                <p className="text-xs text-muted-foreground break-all">
                  {loadError}
                </p>
                <button
                  onClick={() => {
                    window.location.reload();
                  }}
                  className="mt-1 text-xs text-primary"
                >
                  Try again
                </button>
              </div>
            </li>
          ) : null}

          {visibleConversations.map((c) => {
            const ts = c.lastMessageAt || c.updated_at;
            const displayTime = ts
              ? new Date(ts).toLocaleTimeString(undefined, {
                  hour: "2-digit",
                  minute: "2-digit",
                })
              : "";

            const lastLine = c.lastMessage
              ? c.lastMessage
              : c.lastMessageEncrypted
                ? "Encrypted message"
                : "No messages yet";
            const avatarUrl = c.avatar
              ? c.isGroup
                ? c.avatar
                : getAvatarProxyUrl(c.avatar) ?? undefined
              : undefined;

            if (process.env.NODE_ENV !== "production") {
              // eslint-disable-next-line no-console
              console.log("[Messages] presence", {
                id: c.id,
                name: c.name,
                presence: c.presence,
                avatarUrl,
                lastMessageAt: c.lastMessageAt,
                updated_at: c.updated_at,
              });
            }

            return (
              <li
                key={c.id}
                ref={(el) => {
                  if (el) {
                    listItemRefs.current.set(c.id, el);
                  } else {
                    listItemRefs.current.delete(c.id);
                  }
                }}
              >
                <SwipeableRow
                  onArchive={() => console.log("archive", c.id)}
                  onDelete={() => console.log("delete", c.id)}
                  onContact={() => console.log("contact", c.id)}
                  disabled={selectMode}
                >
                  <Link
                    href={`/app/messages/${c.id}`}
                    className={`relative block ${selectMode ? "pl-14" : ""}`}
                  >
                    {selectMode && (
                      <div className="absolute left-4 top-1/2 -translate-y-1/2 z-10">
                        <Checkbox
                          checked={!!selected[c.id]}
                          onCheckedChange={(v) =>
                            setSelected((s) => ({ ...s, [c.id]: !!v }))
                          }
                          className="rounded-full"
                          aria-label={`Select ${c.name}`}
                        />
                      </div>
                    )}
                    <ListItemRow
                      left={
                        <div className="relative">
                          <Badge24
                            src={avatarUrl}
                            alt={c.name}
                            fallback={c.name?.slice(0, 2).toUpperCase() || "??"}
                            presence={null}
                            ring
                          />
                          {!c.isGroup ? (
                            <StatusBadge
                              status={toStatus(c.presence)}
                              size="sm"
                              className="absolute -bottom-0.5 -right-0.5"
                            />
                          ) : null}
                        </div>
                      }
                      right={
                        <div className="min-w-0 grid grid-cols-[minmax(0,1fr)_auto] gap-x-3">
                          {/* Row 1: title + time (+ badge under time) */}
                          <p className="col-start-1 truncate text-base font-semibold max-w-[70vw] sm:max-w-[80vw]">
                            <span className="truncate inline-block max-w-[55vw] align-middle">
                              {c.name}
                            </span>
                            {c.secondary ? (
                              <span className="pl-2 text-sm font-normal text-muted-foreground truncate inline-block max-w-[35vw] align-middle">
                                {c.secondary}
                              </span>
                            ) : null}
                          </p>
                          <div className="col-start-2 row-start-1 text-right">
                            <div className="text-xs text-muted-foreground leading-none mt-0.5">
                              {displayTime}
                            </div>
                          </div>
                          {/* Row 2: preview + send/deliver/read status aligned with preview */}
                          <p className="col-start-1 mt-0.5 text-sm text-muted-foreground truncate whitespace-nowrap">
                            {lastLine}
                          </p>
                          <div className="col-start-2 row-start-2 mt-0.5 leading-tight flex items-center justify-end">
                            {typeof c.unreadCount === "number" &&
                            c.unreadCount > 0 ? (
                              <span className="inline-flex min-w-[22px] items-center justify-center rounded-full bg-primary px-2 py-0.5 text-[10px] font-semibold text-primary-foreground">
                                {c.unreadCount}
                              </span>
                            ) : !c.isGroup &&
                              c.lastMessageSenderId === currentUserId ? (
                              c.lastReceipt?.read_at ? (
                                <CheckCheck
                                  className="h-3.5 w-3.5 text-accent opacity-90"
                                  aria-label="Read"
                                />
                              ) : c.lastReceipt?.delivered_at ? (
                                <CheckCheck
                                  className="h-3.5 w-3.5 text-accent opacity-70"
                                  aria-label="Delivered"
                                />
                              ) : c.lastMessageAt ? (
                                <Check
                                  className="h-3.5 w-3.5 text-accent opacity-70"
                                  aria-label="Sent"
                                />
                              ) : null
                            ) : null}
                          </div>
                        </div>
                      }
                    />
                  </Link>
                </SwipeableRow>
              </li>
            );
          })}
        </ul>
      )}

      {!hasNoConvos && activeFilter === "All" ? (
        <div className="m-4 text-xs text-muted-foreground">
          <div className="flex items-center justify-center gap-2 text-center">
            <Lock className="h-3.5 w-3.5" />
            <span>Your direct messages are end-to-end encrypted</span>
          </div>
        </div>
      ) : null}

      {selectMode && (
        <div className="fixed left-0 right-0 bottom-[calc(56px+env(safe-area-inset-bottom))] z-30 border-t bg-card text-card-foreground">
          <div className="mx-auto flex max-w-xl items-center justify-between gap-3 px-4 py-2">
            <div className="text-sm text-muted-foreground">
              {selectedCount} selected
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  console.log(
                    "bulk archive",
                    Object.keys(selected).filter((k) => selected[k])
                  );
                  setSelectMode(false);
                  setSelected({});
                }}
              >
                Archive
              </Button>
              <Button
                variant="destructive"
                onClick={() => {
                  console.log(
                    "bulk delete",
                    Object.keys(selected).filter((k) => selected[k])
                  );
                  setSelectMode(false);
                  setSelected({});
                }}
              >
                Delete
              </Button>
              <Button
                variant="ghost"
                onClick={() => {
                  setSelectMode(false);
                  setSelected({});
                }}
              >
                Cancel
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
