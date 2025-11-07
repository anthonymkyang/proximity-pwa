"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import {
  Search,
  Sparkles,
  Plus,
  MoreHorizontal,
  Archive,
  Trash2,
  User,
  Inbox,
  AlertTriangle,
} from "lucide-react";
import { motion } from "framer-motion";
import {
  InputGroup,
  InputGroupInput,
  InputGroupAddon,
} from "@/components/ui/input-group";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import TopBar from "@/components/nav/TopBar";
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

// -----------------------------------------------------------------------------
// LOCAL MOCK
// -----------------------------------------------------------------------------
const filters = ["All", "Unread", "Favourites", "Groups", "Cruising"] as const;

// shape coming back from Supabase (normalised)
type DBConversation = {
  id: string;
  name: string;
  lastMessage: string | null;
  avatar?: string | null;
  updated_at?: string | null;
};

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

  const [rawRows, setRawRows] = useState<any[] | null>(null);
  const [showDebug, setShowDebug] = useState(false);

  // 👇 NEW: show what user the client thinks is logged in
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        const supabase = createClient();

        // 1) who am I?
        const {
          data: { user },
          error: userError,
        } = await supabase.auth.getUser();

        if (!user || userError) {
          setCurrentUserId(null);
          setUserConversations([]);
          setRawRows([]);
          setLoadError(userError ? userError.message : null);
          setLoading(false);
          return;
        }

        setCurrentUserId(user.id);

        // 2) my memberships (which conversations I'm in)
        const { data: myMemberships, error: myMembershipsError } =
          await supabase
            .from("conversation_members")
            .select("conversation_id, user_id, role, joined_at")
            .eq("user_id", user.id)
            .order("joined_at", { ascending: false });

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

        // 4) fetch ALL members for ALL those conversations (NO joins here!)
        const { data: allMembers, error: allMembersError } = await supabase
          .from("conversation_members")
          .select("conversation_id, user_id, role, joined_at")
          .in("conversation_id", convoIds);

        if (allMembersError) {
          setLoadError(allMembersError.message);
          setUserConversations([]);
          setLoading(false);
          return;
        }

        // 5) we ALSO need the conversation rows (to get name)
        const { data: convoRows, error: convoRowsError } = await supabase
          .from("conversations")
          .select("id, name")
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

        // 6) collect ALL user_ids from allMembers so we can fetch profiles separately
        const allUserIds = Array.from(
          new Set((allMembers ?? []).map((m) => m.user_id))
        );

        // 7) fetch profiles for those users
        // assumes public.profiles(id uuid pk, profile_title, avatar_url, ...)
        const { data: profiles, error: profilesError } = await supabase
          .from("profiles")
          .select("id, profile_title, avatar_url")
          .in("id", allUserIds);

        if (profilesError) {
          // non-fatal — we can still show conversations, just with fallbacks
          console.warn("profiles fetch failed", profilesError.message);
        }

        const profileById: Record<string, any> = {};
        for (const p of profiles ?? []) {
          profileById[p.id] = p;
        }

        // 8) group members by conversation
        const byConvo: Record<string, any[]> = {};
        for (const m of allMembers ?? []) {
          if (!byConvo[m.conversation_id]) byConvo[m.conversation_id] = [];
          byConvo[m.conversation_id].push(m);
        }

        // 9) build the final display list
        const displayConvos = convoIds.map((convoId) => {
          const myRow = myMemberships.find(
            (m) => m.conversation_id === convoId
          );
          const members = byConvo[convoId] ?? [];

          const convoRow = convoById[convoId] ?? null;

          const others = members.filter((m) => m.user_id !== user.id);

          // group if >2 members (we don't have is_group on this table)
          const isGroup = members.length > 2;

          let name: string;
          let avatar: string | null = null;

          if (isGroup) {
            // group: prefer conversation.name
            name =
              (convoRow && convoRow.name) ||
              (members.length
                ? `${members.length} people`
                : "Group conversation");
          } else {
            // 1:1: show the other participant's profile title, NOT their user_id
            const other = others[0];
            const otherProfile = other ? profileById[other.user_id] : null;
            name =
              (otherProfile && otherProfile.profile_title) || "Unknown user";
            avatar = otherProfile?.avatar_url ?? null;
          }

          return {
            id: convoId,
            name,
            avatar,
            lastMessage: null,
            updated_at: myRow?.joined_at ?? null,
          };
        });

        setUserConversations(displayConvos);
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

  const hasNoConvos =
    !loading && userConversations.length === 0 && !loadError && !!currentUserId;

  return (
    <div className="mx-auto w-full max-w-xl px-4 pb-[calc(72px+env(safe-area-inset-bottom))]">
      {/* Top bar */}
      <TopBar
        leftContent={
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <motion.button
                aria-label="Menu"
                whileTap={{ scale: 1.15 }}
                drag
                dragElastic={0.2}
                dragConstraints={{ top: 0, bottom: 0, left: 0, right: 0 }}
                className="h-10 w-10 flex items-center justify-center rounded-full bg-white/5 backdrop-blur-xl border border-white/20 shadow-[inset_0_0_0_0.5px_rgba(255,255,255,0.6),0_2px_10px_rgba(0,0,0,0.2)] hover:bg-white/10 transition-all duration-300 active:scale-110"
              >
                <MoreHorizontal className="h-6 w-6 text-white" />
              </motion.button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="start"
              sideOffset={8}
              className="min-w-56"
            >
              <DropdownMenuItem
                onSelect={(e) => {
                  e.preventDefault();
                  setSelectMode(true);
                  setSelected({});
                }}
              >
                Select conversations
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        }
        rightContent={
          <>
            <Button variant="ghost" size="icon" aria-label="Sparkles">
              <Sparkles className="h-5 w-5" />
            </Button>
            <Button
              variant="default"
              size="icon"
              className="rounded-full"
              aria-label="New chat"
            >
              <Plus className="h-5 w-5" />
            </Button>
          </>
        }
      ></TopBar>

      {/* Title under top bar */}
      <h1 className="px-1 pb-2 text-4xl font-extrabold tracking-tight">
        Messages
      </h1>

      {/* 👇 show who we are logged in as */}
      <div className="mb-4 rounded-lg border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
        {currentUserId ? (
          <span>
            Authenticated as:{" "}
            <code className="font-mono text-[11px]">{currentUserId}</code>
          </span>
        ) : (
          <span className="text-destructive">
            No Supabase user in this environment — messages will be empty.
          </span>
        )}
      </div>

      {/* debug: what did Supabase actually return for this user */}
      <div className="mb-4 rounded-lg border bg-muted/20 px-3 py-2 text-[11px] text-muted-foreground">
        <div className="flex items-center justify-between gap-2">
          <span>
            conversation_members for this user:{" "}
            <strong>{rawRows ? rawRows.length : 0}</strong>
          </span>
          <button
            type="button"
            onClick={() => setShowDebug((p) => !p)}
            className="text-xs text-primary underline-offset-2 hover:underline"
          >
            {showDebug ? "Hide" : "Show"} raw
          </button>
        </div>
        {showDebug ? (
          <pre className="mt-2 max-h-40 overflow-auto rounded bg-background/80 p-2 text-[10px] leading-tight">
            {JSON.stringify(rawRows, null, 2)}
          </pre>
        ) : null}
      </div>

      {!loading && currentUserId && (rawRows?.length ?? 0) === 0 ? (
        <p className="mt-1 text-[11px] text-amber-500">
          You are authenticated but got 0 rows. This almost always means RLS on
          <code className="mx-1 rounded bg-muted/60 px-1">
            conversation_members
          </code>
          isn’t letting this user read their own rows.
        </p>
      ) : null}

      {/* Search */}
      <div className="pb-5">
        <InputGroup>
          <InputGroupInput placeholder="Ask or search messages" />
          <InputGroupAddon>
            <Search className="h-4 w-4 text-muted-foreground" />
          </InputGroupAddon>
        </InputGroup>
      </div>

      {/* Filter chips */}
      <div className="flex gap-2 overflow-x-auto pb-3 -mx-4 px-4 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
        {filters.map((f) => (
          <Button
            key={f}
            size="sm"
            variant={activeFilter === f ? "default" : "outline"}
            className="rounded-full"
            onClick={() => setActiveFilter(f)}
          >
            {f}
          </Button>
        ))}
      </div>

      {/* Archived row */}
      <ListItemRow
        left={<Archive className="h-5 w-5 text-muted-foreground" />}
        right={
          <span className="truncate text-base font-semibold text-muted-foreground">
            Archived
          </span>
        }
      />

      {/* EMPTY STATE */}
      {hasNoConvos ? (
        <div className="pt-8">
          <Empty>
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <Inbox className="h-6 w-6" />
              </EmptyMedia>
              <EmptyTitle>No messages yet</EmptyTitle>
              <EmptyDescription>
                When you start chatting, your conversations will appear here.
              </EmptyDescription>
            </EmptyHeader>
            <EmptyContent>
              <div className="flex gap-2">
                <Button variant="outline">
                  <Plus className="mr-2 h-4 w-4" />
                  Start a chat
                </Button>
              </div>
            </EmptyContent>
          </Empty>
        </div>
      ) : (
        // CONVERSATION LIST
        <ul className="divide-y">
          {/* if there's an error, show it in-list */}
          {loadError ? (
            <li className="bg-destructive/5 px-4 py-3 flex items-start gap-3">
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

          {userConversations.map((c) => {
            const displayTime = c.updated_at
              ? new Date(c.updated_at).toLocaleTimeString(undefined, {
                  hour: "2-digit",
                  minute: "2-digit",
                })
              : "";

            const lastLine = c.lastMessage || "No messages yet";

            return (
              <li key={c.id}>
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
                        <div className="relative h-12 w-12">
                          <Avatar className="h-12 w-12">
                            <AvatarImage
                              src={c.avatar ?? undefined}
                              alt={c.name}
                            />
                            <AvatarFallback>
                              {c.name?.slice(0, 2).toUpperCase() || "??"}
                            </AvatarFallback>
                          </Avatar>
                        </div>
                      }
                      right={
                        <>
                          <div className="flex items-baseline justify-between gap-3">
                            <p className="truncate text-base font-semibold">
                              {c.name}
                            </p>
                            <div className="shrink-0 text-xs text-muted-foreground flex items-center gap-1">
                              {displayTime}
                            </div>
                          </div>
                          <div className="mt-0.5 flex items-center gap-1 text-sm text-muted-foreground">
                            <p className="truncate">{lastLine}</p>
                          </div>
                        </>
                      }
                    />
                  </Link>
                </SwipeableRow>
              </li>
            );
          })}
        </ul>
      )}

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
