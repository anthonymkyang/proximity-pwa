"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  Bell,
  ChevronRight,
  EyeOff,
  Image as ImageIcon,
  Link as LinkIcon,
  Globe,
  MessageCircle,
  ShieldCheck,
  Timer,
  User,
  Users,
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import getAvatarProxyUrl from "@/lib/profiles/getAvatarProxyUrl";
import {
  usePresence,
  toUiPresence,
} from "@/components/providers/presence-context";
import { StatusBadge } from "@/components/status/Badge";
import { createClient } from "@/utils/supabase/client";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { ScrollArea } from "@/components/ui/scroll-area";

type ConnectionResponse = {
  connection: {
    id: string;
    type: "contact" | "pin";
    title: string;
    note?: string | null;
    connection_contacts?: any;
    connection_pins?: any;
  };
};

function resolveCoverUrl(path?: string | null): string | undefined {
  if (!path) return undefined;
  const s = String(path);
  if (s.startsWith("http://") || s.startsWith("https://")) return s;
  return `/api/groups/storage?path=${encodeURIComponent(s.replace(/^\//, ""))}`;
}

function getGroupCutoff(start?: Date | null, end?: Date | null): Date | null {
  if (!start) return null;
  const nextMidnight = new Date(start);
  nextMidnight.setHours(24, 0, 0, 0);
  if (end && end < nextMidnight) return end;
  return nextMidnight;
}

function isGroupInProgress(start?: string | null, end?: string | null): boolean {
  if (!start) return false;
  const startDate = new Date(start);
  const endDate = end ? new Date(end) : null;
  const cutoff = getGroupCutoff(startDate, endDate);
  if (!cutoff) return false;
  const now = Date.now();
  return now >= startDate.getTime() && now < cutoff.getTime();
}

function formatGroupWhen(start?: string | null, end?: string | null): string {
  if (!start) return "Date TBC";
  const startDate = new Date(start);
  const endDate = end ? new Date(end) : null;
  const now = new Date();
  const startDay = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate());
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);

  let dayLabel = startDate.toLocaleDateString("en-GB", {
    weekday: "long",
  });
  if (startDay.getTime() === today.getTime()) {
    dayLabel = "Today";
  } else if (startDay.getTime() === tomorrow.getTime()) {
    dayLabel = "Tomorrow";
  } else if (startDay.getTime() > tomorrow.getTime()) {
    dayLabel = startDate.toLocaleDateString("en-GB", {
      day: "numeric",
      month: "short",
    });
  }

  const formatTime = (date: Date) => {
    let t = date.toLocaleTimeString("en-GB", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
    t = t.replace(":00", "");
    t = t.replace(" AM", "am").replace(" PM", "pm");
    t = t.replace(" ", "");
    return t;
  };

  const startTime = formatTime(startDate);
  const endTime = endDate ? formatTime(endDate) : null;
  const timeLabel = endTime ? `${startTime} - ${endTime}` : `${startTime} onwards`;
  return `${dayLabel}, ${timeLabel}`;
}

export default function ConnectionDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { presence, currentUserId } = usePresence();
  const supabaseRef = useRef(createClient());
  const isCreatingConversationRef = useRef(false);
  const sharedConversationIdsRef = useRef<string[]>([]);
  const checkUnreadRef = useRef<() => Promise<void>>(async () => {});
  const refreshSharedRef = useRef<() => Promise<void>>(async () => {});
  const connectionId = Array.isArray((params as any)?.id)
    ? (params as any)?.id[0]
    : (params as any)?.id;
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<ConnectionResponse["connection"] | null>(
    null
  );
  const [sharedConversationIds, setSharedConversationIds] = useState<string[]>(
    []
  );
  const [hasUnreadMessages, setHasUnreadMessages] = useState(false);
  const [privacyOpen, setPrivacyOpen] = useState(false);
  const [disappearingOpen, setDisappearingOpen] = useState(false);
  const [hideOnMap, setHideOnMap] = useState(false);
  const [hideOnlineStatus, setHideOnlineStatus] = useState(false);
  const [readReceipts, setReadReceipts] = useState(true);
  const [disappearingEnabled, setDisappearingEnabled] = useState(false);
  const [disappearAfter, setDisappearAfter] = useState("30 mins");
  const [groupsOpen, setGroupsOpen] = useState(false);
  const [sharedLinksOpen, setSharedLinksOpen] = useState(false);
  const [sharedLinksLoading, setSharedLinksLoading] = useState(false);
  const [sharedLinksError, setSharedLinksError] = useState<string | null>(null);
  const [sharedLinks, setSharedLinks] = useState<any[]>([]);
  const [groupsLoading, setGroupsLoading] = useState(false);
  const [groupsError, setGroupsError] = useState<string | null>(null);
  const [hostingGroups, setHostingGroups] = useState<any[]>([]);
  const [cohostingGroups, setCohostingGroups] = useState<any[]>([]);
  const [attendingGroups, setAttendingGroups] = useState<any[]>([]);

  useEffect(() => {
    if (!connectionId) return;
    let active = true;
    setLoading(true);
    setError(null);
    fetch(`/api/connections/${connectionId}`)
      .then(async (res) => {
        const body = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(body?.error || "Failed to load contact");
        return body as ConnectionResponse;
      })
      .then((body) => {
        if (!active) return;
        setData(body.connection);
      })
      .catch((err) => {
        if (!active) return;
        setError(err.message || "Failed to load contact");
      })
      .finally(() => active && setLoading(false));

    return () => {
      active = false;
    };
  }, [connectionId]);

  const contact = useMemo(() => {
    if (!data || data.type !== "contact") return null;
    return Array.isArray(data.connection_contacts)
      ? data.connection_contacts[0]
      : data.connection_contacts;
  }, [data]);

  const pinned = useMemo(() => {
    if (!data || data.type !== "pin") return null;
    return Array.isArray(data.connection_pins)
      ? data.connection_pins[0]
      : data.connection_pins;
  }, [data]);

  const avatarUrl = useMemo(() => {
    const raw =
      pinned?.pinned_profile?.avatar_url ??
      contact?.profiles?.avatar_url ??
      null;
    return raw ? getAvatarProxyUrl(raw) : null;
  }, [pinned, contact]);

  const title =
    data?.title ||
    contact?.display_name ||
    pinned?.nickname ||
    pinned?.pinned_profile?.profile_title ||
    "Connection";
  const profileTitle =
    contact?.profiles?.profile_title ||
    pinned?.pinned_profile?.profile_title ||
    null;

  const profile = contact?.profiles || pinned?.pinned_profile || null;
  const otherUserId =
    contact?.profile_id || profile?.id || pinned?.pinned_profile_id || null;

  const getAgeFromISODate = (iso: string | null | undefined): number | null => {
    if (!iso) return null;
    const [y, m, d] = iso.split("-").map((v) => parseInt(v, 10));
    if (!y || !m || !d) return null;
    const today = new Date();
    let age = today.getFullYear() - y;
    const monthDiff = today.getMonth() + 1 - m;
    const dayDiff = today.getDate() - d;
    if (monthDiff < 0 || (monthDiff === 0 && dayDiff < 0)) age--;
    return age >= 0 && Number.isFinite(age) ? age : null;
  };

  const statsLine = useMemo(() => {
    const parts: string[] = [];
    const age = getAgeFromISODate(profile?.date_of_birth);
    if (age != null) parts.push(String(age));
    if (profile?.position?.label) parts.push(profile.position.label);
    if (profile?.sexuality?.label) parts.push(profile.sexuality.label);
    return parts.join(" • ");
  }, [profile]);
  const presenceStatus = useMemo(() => {
    if (!profile?.id) return "offline";
    const uiPresence = toUiPresence(presence[profile.id]);
    if (uiPresence === "online") return "online";
    if (uiPresence === "away") return "away";
    return "offline";
  }, [presence, profile?.id]);

  const checkUnread = useCallback(async () => {
    const sharedIds = sharedConversationIdsRef.current;
    if (!currentUserId || !otherUserId || sharedIds.length === 0) {
      setHasUnreadMessages(false);
      return;
    }
    const supabase = supabaseRef.current;
    const { data: msgs, error: msgErr } = await supabase
      .from("messages")
      .select("id")
      .in("conversation_id", sharedIds)
      .eq("sender_id", otherUserId);
    if (msgErr || !Array.isArray(msgs) || msgs.length === 0) {
      setHasUnreadMessages(false);
      return;
    }
    const msgIds = msgs.map((m) => m.id).filter(Boolean);
    if (msgIds.length === 0) {
      setHasUnreadMessages(false);
      return;
    }
    const { data: receipts, error: recErr } = await supabase
      .from("message_receipts")
      .select("message_id, read_at")
      .in("message_id", msgIds)
      .eq("user_id", currentUserId)
      .not("read_at", "is", null);
    if (recErr) return;
    const readSet = new Set((receipts ?? []).map((r) => r.message_id));
    const hasUnreadLocal = msgIds.some((id) => !readSet.has(id));
    setHasUnreadMessages(hasUnreadLocal);
  }, [currentUserId, otherUserId]);

  const refreshSharedConversations = useCallback(async () => {
    if (!currentUserId || !otherUserId) {
      setSharedConversationIds([]);
      setHasUnreadMessages(false);
      return;
    }
    const supabase = supabaseRef.current;
    const { data: myMemberships, error: memErr } = await supabase
      .from("conversation_members")
      .select("conversation_id")
      .eq("user_id", currentUserId);
    if (
      memErr ||
      !Array.isArray(myMemberships) ||
      myMemberships.length === 0
    ) {
      setSharedConversationIds([]);
      setHasUnreadMessages(false);
      return;
    }
    const myConvoIds = myMemberships
      .map((m: any) => m?.conversation_id)
      .filter(Boolean);
    if (myConvoIds.length === 0) {
      setSharedConversationIds([]);
      setHasUnreadMessages(false);
      return;
    }
    const { data: directConvos, error: convoErr } = await supabase
      .from("conversations")
      .select("id")
      .in("id", myConvoIds)
      .eq("type", "direct");
    if (convoErr) throw convoErr;
    const directIds = (directConvos ?? [])
      .map((c: any) => c?.id)
      .filter(Boolean);
    if (directIds.length === 0) {
      setSharedConversationIds([]);
      setHasUnreadMessages(false);
      return;
    }
    const { data: shared, error: sharedErr } = await supabase
      .from("conversation_members")
      .select("conversation_id")
      .eq("user_id", otherUserId)
      .in("conversation_id", directIds);
    if (sharedErr || !Array.isArray(shared) || shared.length === 0) {
      setSharedConversationIds([]);
      setHasUnreadMessages(false);
      return;
    }
    const convoIds = shared
      .map((row: any) => row?.conversation_id)
      .filter(Boolean);
    setSharedConversationIds(convoIds);
  }, [currentUserId, otherUserId]);

  useEffect(() => {
    sharedConversationIdsRef.current = sharedConversationIds;
  }, [sharedConversationIds]);
  useEffect(() => {
    checkUnreadRef.current = checkUnread;
  }, [checkUnread]);
  useEffect(() => {
    refreshSharedRef.current = refreshSharedConversations;
  }, [refreshSharedConversations]);

  useEffect(() => {
    if (!sharedLinksOpen) return;
    let active = true;
    const loadLinks = async () => {
      setSharedLinksLoading(true);
      setSharedLinksError(null);
      const supabase = supabaseRef.current;
      const convoIds = sharedConversationIdsRef.current;
      if (!currentUserId || !otherUserId || convoIds.length === 0) {
        if (active) {
          setSharedLinks([]);
          setSharedLinksLoading(false);
        }
        return;
      }
      try {
        const { data, error } = await supabase
          .from("messages")
          .select("id, body, created_at, metadata, message_type")
          .in("conversation_id", convoIds)
          .eq("message_type", "link")
          .order("created_at", { ascending: false })
          .limit(50);
        if (error) throw error;
        if (!active) return;
        const rows = (data ?? []).map((row: any) => {
          const link = row?.metadata?.link ?? null;
          const url = link?.url || row?.body || "";
          let hostname = "";
          try {
            hostname = new URL(url).hostname.replace("www.", "");
          } catch {}
          return {
            id: row.id,
            url,
            title: link?.title || link?.siteName || hostname || url,
            description: link?.description || "",
            siteName: link?.siteName || hostname || "",
            image: link?.image || "",
            hostname,
          };
        });
        setSharedLinks(rows.filter((row: any) => row.url));
      } catch (err: any) {
        if (!active) return;
        setSharedLinksError(err?.message || "Failed to load shared links");
      } finally {
        if (active) setSharedLinksLoading(false);
      }
    };
    void loadLinks();
    return () => {
      active = false;
    };
  }, [currentUserId, otherUserId, sharedLinksOpen]);
  useEffect(() => {
    if (!groupsOpen || !otherUserId) return;
    let active = true;
    const loadGroups = async () => {
      setGroupsLoading(true);
      setGroupsError(null);
      const supabase = supabaseRef.current;
      try {
        const [hostingRes, cohostRes, attendingRes] = await Promise.all([
          supabase
            .from("groups")
            .select("id,title,start_time,end_time,cover_image_url")
            .eq("host_id", otherUserId)
            .order("start_time", { ascending: false }),
          supabase
            .from("groups")
            .select("id,title,start_time,end_time,cover_image_url,cohost_ids,host_id")
            .contains("cohost_ids", [otherUserId])
            .order("start_time", { ascending: false }),
          supabase
            .from("group_attendees")
            .select("group:groups(id,title,start_time,end_time,cover_image_url)")
            .eq("user_id", otherUserId)
            .in("status", ["accepted", "approved"]),
        ]);

        if (hostingRes.error) throw hostingRes.error;
        if (cohostRes.error) throw cohostRes.error;
        if (attendingRes.error) throw attendingRes.error;

        if (!active) return;
        const isGroupActive = (group: any) => {
          const start = group?.start_time ? new Date(group.start_time) : null;
          const end = group?.end_time ? new Date(group.end_time) : null;
          if (!start) return false;
          const nextMidnight = new Date(start);
          nextMidnight.setHours(24, 0, 0, 0);
          const cutoff = end && end < nextMidnight ? end : nextMidnight;
          return Date.now() < cutoff.getTime();
        };
        setHostingGroups((hostingRes.data ?? []).filter(isGroupActive));
        setCohostingGroups(
          (cohostRes.data ?? [])
            .filter((group: any) => group.host_id !== otherUserId)
            .filter(isGroupActive)
        );
        setAttendingGroups(
          (attendingRes.data ?? [])
            .map((row: any) => row.group)
            .filter(Boolean)
            .filter(isGroupActive)
        );
      } catch (err: any) {
        if (!active) return;
        setGroupsError(err?.message || "Failed to load groups");
      } finally {
        if (active) setGroupsLoading(false);
      }
    };

    void loadGroups();
    return () => {
      active = false;
    };
  }, [groupsOpen, otherUserId]);

  const handleOpenMessages = useCallback(async () => {
    if (!currentUserId || !otherUserId || isCreatingConversationRef.current) {
      return;
    }
    isCreatingConversationRef.current = true;
    try {
      const supabase = supabaseRef.current;
      const { data: myMemberships } = await supabase
        .from("conversation_members")
        .select("conversation_id")
        .eq("user_id", currentUserId);

      if (myMemberships && myMemberships.length > 0) {
        const conversationIds = myMemberships
          .map((m) => m.conversation_id)
          .filter(Boolean);

        if (conversationIds.length > 0) {
          const { data: directConvos } = await supabase
            .from("conversations")
            .select("id")
            .in("id", conversationIds)
            .eq("type", "direct");
          const directIds = (directConvos ?? [])
            .map((c: any) => c?.id)
            .filter(Boolean);
          if (directIds.length === 0) {
            // continue to creation
          } else {
          const { data: theirMemberships } = await supabase
            .from("conversation_members")
            .select("conversation_id")
            .eq("user_id", otherUserId)
            .in("conversation_id", directIds);

          if (theirMemberships && theirMemberships.length > 0) {
            router.push(
              `/app/messages/${theirMemberships[0].conversation_id}`
            );
            return;
          }
          }
        }
      }

      const res = await fetch("/api/messages/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ target_user_id: otherUserId }),
      });
      const data = await res.json();
      if (!res.ok || !data?.conversation_id) {
        throw new Error(data?.error || "Failed to create conversation");
      }

      router.push(`/app/messages/${data.conversation_id}`);
    } catch (err) {
      console.error("Open chat error:", err);
    } finally {
      isCreatingConversationRef.current = false;
    }
  }, [currentUserId, otherUserId, router]);

  useEffect(() => {
    let active = true;
    const load = async () => {
      await refreshSharedRef.current();
      if (active) {
        await checkUnreadRef.current();
      }
    };
    void load();
    return () => {
      active = false;
    };
  }, [currentUserId, otherUserId]);

  useEffect(() => {
    void checkUnreadRef.current();
  }, [sharedConversationIds]);

  useEffect(() => {
    if (!currentUserId || !otherUserId) return;
    const supabase = supabaseRef.current;
    const channel = supabase.channel(
      `connection-unread:${currentUserId}:${otherUserId}`
    );

    channel.on(
      "postgres_changes",
      { event: "INSERT", schema: "public", table: "messages" },
      (payload: any) => {
        const senderId = payload?.new?.sender_id as string | undefined;
        const convoId = payload?.new?.conversation_id as string | undefined;
        if (!senderId || senderId === currentUserId || !convoId) return;
        if (!sharedConversationIdsRef.current.includes(convoId)) return;
        setHasUnreadMessages(true);
        void checkUnreadRef.current();
      }
    );

    channel.on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "message_receipts",
        filter: `user_id=eq.${currentUserId}`,
      },
      () => {
        void checkUnreadRef.current();
      }
    );

    channel.on(
      "postgres_changes",
      {
        event: "INSERT",
        schema: "public",
        table: "conversation_members",
        filter: `user_id=eq.${currentUserId}`,
      },
      () => {
        void refreshSharedRef.current().then(() => checkUnreadRef.current());
      }
    );

    channel.subscribe();
    void checkUnreadRef.current();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentUserId, otherUserId]);

  return (
    <div className="space-y-4 px-4 pb-4 pt-0">
      {loading ? (
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <Skeleton className="h-14 w-14 rounded-full" />
            <div className="space-y-2">
              <Skeleton className="h-4 w-40" />
              <div className="flex gap-2">
                <Skeleton className="h-5 w-14 rounded-full" />
                <Skeleton className="h-5 w-16 rounded-full" />
                <Skeleton className="h-5 w-12 rounded-full" />
              </div>
            </div>
          </div>

          <div className="flex gap-2">
            <Skeleton className="h-16 flex-1 rounded-xl" />
            <Skeleton className="h-16 flex-1 rounded-xl" />
            <Skeleton className="h-16 flex-1 rounded-xl" />
          </div>

          <div className="space-y-3">
            <Skeleton className="h-3 w-32" />
            <div className="rounded-2xl bg-card/60">
              <div className="px-4 py-3 space-y-3">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-px w-full" />
                <Skeleton className="h-4 w-3/4" />
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <Skeleton className="h-3 w-24" />
            <div className="rounded-2xl bg-card/60">
              <div className="px-4 py-3 space-y-3">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-px w-full" />
                <Skeleton className="h-4 w-5/6" />
                <Skeleton className="h-px w-full" />
                <Skeleton className="h-4 w-4/6" />
              </div>
            </div>
          </div>
        </div>
      ) : error ? (
        <p className="text-sm text-muted-foreground">{error}</p>
      ) : !data ? (
        <p className="text-sm text-muted-foreground">Not found.</p>
      ) : (
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="relative h-14 w-14">
              <Avatar className="h-14 w-14">
                <AvatarImage
                  src={avatarUrl || (undefined as unknown as string)}
                  alt={title}
                />
                <AvatarFallback>
                  {title.slice(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <StatusBadge
                status={presenceStatus}
                size="sm"
                className="absolute bottom-0.5 right-0.5"
              />
            </div>
            <div className="min-w-0">
              <div className="flex items-baseline gap-2 min-w-0">
                <div className="text-lg font-semibold truncate">{title}</div>
                {profileTitle && profileTitle !== title ? (
                  <div className="text-sm text-muted-foreground truncate">
                    {profileTitle}
                  </div>
                ) : null}
              </div>
              {statsLine ? (
                <div className="flex flex-wrap gap-1.5">
                  {statsLine.split(" • ").map((part) => (
                    <span
                      key={part}
                      className="rounded-full bg-secondary/30 px-2.5 py-0.5 text-xs font-medium text-muted-foreground"
                    >
                      {part}
                    </span>
                  ))}
                </div>
              ) : null}
            </div>
          </div>

          <div className="flex gap-2">
            <button
              type="button"
              className="flex-1 rounded-xl bg-secondary/30 px-3 py-3 flex flex-col items-center gap-1 text-sm font-medium text-foreground"
              onClick={() => {
                if (otherUserId) router.push(`/app/profile/${otherUserId}`);
              }}
            >
              <User className="h-4 w-4 text-muted-foreground" />
              <span>Profile</span>
            </button>
            <button
              type="button"
              className="relative flex-1 rounded-xl bg-secondary/30 px-3 py-3 flex flex-col items-center gap-1 text-sm font-medium text-foreground"
              onClick={handleOpenMessages}
            >
              <span className="relative inline-flex">
                <MessageCircle className="h-4 w-4 text-muted-foreground" />
                {hasUnreadMessages ? (
                  <span className="absolute -top-1 -right-1 h-2 w-2 rounded-full bg-destructive" />
                ) : null}
              </span>
              <span>Messages</span>
            </button>
            <button
              type="button"
              className="flex-1 rounded-xl bg-secondary/30 px-3 py-3 flex flex-col items-center gap-1 text-sm font-medium text-foreground"
              onClick={() => setGroupsOpen(true)}
            >
              <Users className="h-4 w-4 text-muted-foreground" />
              <span>Groups</span>
            </button>
          </div>

          <div className="space-y-3">
            <div className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
              Shared between you
            </div>
            <div className="rounded-2xl bg-card/60">
              <div className="px-4">
                <div className="flex items-center gap-3 py-3 text-sm">
                  <ImageIcon className="h-4 w-4 text-muted-foreground" />
                  <span className="flex-1">Pictures &amp; albums</span>
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                </div>
                <div className="h-px bg-border/50" />
                <button
                  type="button"
                  className="flex w-full items-center gap-3 py-3 text-sm"
                  onClick={() => setSharedLinksOpen(true)}
                >
                  <LinkIcon className="h-4 w-4 text-muted-foreground" />
                  <span className="flex-1 text-left">Links</span>
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                </button>
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <div className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
              Settings
            </div>
            <div className="rounded-2xl bg-card/60">
              <div className="px-4">
                <button
                  type="button"
                  className="flex w-full items-center gap-3 py-3 text-sm"
                  onClick={() => setPrivacyOpen(true)}
                >
                  <ShieldCheck className="h-4 w-4 text-muted-foreground" />
                  <span className="flex-1 text-left">Privacy</span>
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                </button>
                <div className="h-px bg-border/50" />
                <button
                  type="button"
                  className="flex w-full items-center gap-3 py-3 text-sm"
                  onClick={() => setDisappearingOpen(true)}
                >
                  <Timer className="h-4 w-4 text-muted-foreground" />
                  <span className="flex-1 text-left">Disappearing messages</span>
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                </button>
              </div>
            </div>
          </div>

          <Drawer open={privacyOpen} onOpenChange={setPrivacyOpen}>
            <DrawerContent>
              <div className="mx-auto w-full max-w-xl p-4 pb-6 space-y-4">
                <DrawerHeader className="px-0 pt-0 pb-2">
                  <DrawerTitle>Privacy</DrawerTitle>
                  <DrawerDescription>
                    Manage what others can see about you.
                  </DrawerDescription>
                </DrawerHeader>
                <div className="space-y-2">
                  <div className="rounded-xl bg-secondary/30 px-4 py-3 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 text-sm font-medium">
                      <EyeOff className="h-4 w-4 text-muted-foreground" />
                      <span>Hide me on map</span>
                    </div>
                    <Switch
                      checked={hideOnMap}
                      onCheckedChange={setHideOnMap}
                      aria-label="Hide me on map"
                    />
                  </div>
                  <div className="rounded-xl bg-secondary/30 px-4 py-3 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 text-sm font-medium">
                      <EyeOff className="h-4 w-4 text-muted-foreground" />
                      <span>Hide my online status</span>
                    </div>
                    <Switch
                      checked={hideOnlineStatus}
                      onCheckedChange={setHideOnlineStatus}
                      aria-label="Hide my online status"
                    />
                  </div>
                  <div className="rounded-xl bg-secondary/30 px-4 py-3 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 text-sm font-medium">
                      <MessageCircle className="h-4 w-4 text-muted-foreground" />
                      <span>Read receipts</span>
                    </div>
                    <Switch
                      checked={readReceipts}
                      onCheckedChange={setReadReceipts}
                      aria-label="Read receipts"
                    />
                  </div>
                </div>
              </div>
            </DrawerContent>
          </Drawer>

          <Drawer open={disappearingOpen} onOpenChange={setDisappearingOpen}>
            <DrawerContent>
              <div className="mx-auto w-full max-w-xl p-4 pb-6 space-y-4">
                <DrawerHeader className="px-0 pt-0 pb-2">
                  <DrawerTitle>Disappearing messages</DrawerTitle>
                  <DrawerDescription>
                    Control how long messages are kept.
                  </DrawerDescription>
                </DrawerHeader>
                <div className="space-y-2">
                  <div className="rounded-xl bg-secondary/30 px-4 py-3 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 text-sm font-medium">
                      <Timer className="h-4 w-4 text-muted-foreground" />
                      <span>Disappearing messages</span>
                    </div>
                    <Switch
                      checked={disappearingEnabled}
                      onCheckedChange={setDisappearingEnabled}
                      aria-label="Disappearing messages"
                    />
                  </div>
                  {disappearingEnabled ? (
                    <div className="rounded-xl bg-secondary/30 px-4 py-3 flex items-center justify-between gap-3">
                      <div className="text-sm font-medium">
                        Disappears after
                      </div>
                      <Select
                        value={disappearAfter}
                        onValueChange={setDisappearAfter}
                      >
                        <SelectTrigger className="h-9 w-[150px]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="15 mins">15 mins</SelectItem>
                          <SelectItem value="30 mins">30 mins</SelectItem>
                          <SelectItem value="1 hour">1 hour</SelectItem>
                          <SelectItem value="4 hours">4 hours</SelectItem>
                          <SelectItem value="1 day">1 day</SelectItem>
                          <SelectItem value="14 days">14 days</SelectItem>
                          <SelectItem value="30 days">30 days</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  ) : null}
                </div>
              </div>
            </DrawerContent>
          </Drawer>

          <Drawer open={groupsOpen} onOpenChange={setGroupsOpen}>
            <DrawerContent>
              <div className="mx-auto w-full max-w-xl p-4 pb-6 space-y-4">
                <DrawerHeader className="px-0 pt-0 pb-2">
                  <DrawerTitle>Groups</DrawerTitle>
                  <DrawerDescription>
                    Groups this connection is involved in.
                  </DrawerDescription>
                </DrawerHeader>
                <ScrollArea className="h-[60vh] pr-2">
                  {groupsLoading ? (
                    <div className="space-y-2">
                      <div className="h-4 w-32 rounded bg-muted/40" />
                      <div className="h-9 rounded bg-muted/30" />
                      <div className="h-4 w-32 rounded bg-muted/40" />
                      <div className="h-9 rounded bg-muted/30" />
                    </div>
                  ) : groupsError ? (
                    <div className="text-sm text-muted-foreground">
                      {groupsError}
                    </div>
                  ) : hostingGroups.length === 0 &&
                    cohostingGroups.length === 0 &&
                    attendingGroups.length === 0 ? (
                    <div className="rounded-xl bg-secondary/30 px-4 py-4">
                      <Empty>
                        <EmptyHeader>
                          <EmptyMedia variant="icon">
                            <Users className="h-6 w-6" />
                          </EmptyMedia>
                          <EmptyTitle>Not in any groups</EmptyTitle>
                          <EmptyDescription>
                            They are not part of any groups right now.
                          </EmptyDescription>
                        </EmptyHeader>
                      </Empty>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {hostingGroups.length > 0 ? (
                        <div className="space-y-2">
                          <div className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
                            Hosting
                          </div>
                          <div className="space-y-2">
                            {hostingGroups.map((group: any) => {
                              const coverUrl = resolveCoverUrl(
                                group.cover_image_url
                              );
                              const whenLabel = formatGroupWhen(
                                group.start_time,
                                group.end_time
                              );
                              const inProgress = isGroupInProgress(
                                group.start_time,
                                group.end_time
                              );
                              return (
                                <Link
                                  key={group.id}
                                  href={`/app/activity/groups/${group.id}`}
                                  className="rounded-xl bg-secondary/30 px-4 py-3 text-sm font-medium text-foreground flex items-center gap-3"
                                >
                                  <div className="h-10 w-10 rounded-lg bg-muted/40 overflow-hidden shrink-0">
                                    {coverUrl ? (
                                      <img
                                        src={coverUrl}
                                        alt={group.title || "Group cover"}
                                        className="h-full w-full object-cover"
                                      />
                                    ) : null}
                                  </div>
                                  <div className="min-w-0">
                                    <div className="truncate">
                                      {group.title || "Untitled group"}
                                    </div>
                                    <div className="flex items-center gap-2 text-xs text-foreground truncate">
                                      <span className="truncate text-muted-foreground">
                                        {whenLabel}
                                      </span>
                                      {inProgress ? (
                                        <span className="rounded-full bg-destructive px-2 py-0.5 text-[10px] font-semibold text-destructive-foreground">
                                          In progress
                                        </span>
                                      ) : null}
                                    </div>
                                  </div>
                                </Link>
                              );
                            })}
                          </div>
                        </div>
                      ) : null}
                      {cohostingGroups.length > 0 ? (
                        <div className="space-y-2">
                          <div className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
                            Co-hosting
                          </div>
                          <div className="space-y-2">
                            {cohostingGroups.map((group: any) => {
                              const coverUrl = resolveCoverUrl(
                                group.cover_image_url
                              );
                              const whenLabel = formatGroupWhen(
                                group.start_time,
                                group.end_time
                              );
                              const inProgress = isGroupInProgress(
                                group.start_time,
                                group.end_time
                              );
                              return (
                                <Link
                                  key={group.id}
                                  href={`/app/activity/groups/${group.id}`}
                                  className="rounded-xl bg-secondary/30 px-4 py-3 text-sm font-medium text-foreground flex items-center gap-3"
                                >
                                  <div className="h-10 w-10 rounded-lg bg-muted/40 overflow-hidden shrink-0">
                                    {coverUrl ? (
                                      <img
                                        src={coverUrl}
                                        alt={group.title || "Group cover"}
                                        className="h-full w-full object-cover"
                                      />
                                    ) : null}
                                  </div>
                                  <div className="min-w-0">
                                    <div className="truncate">
                                      {group.title || "Untitled group"}
                                    </div>
                                    <div className="flex items-center gap-2 text-xs text-foreground truncate">
                                      <span className="truncate text-muted-foreground">
                                        {whenLabel}
                                      </span>
                                      {inProgress ? (
                                        <span className="rounded-full bg-destructive px-2 py-0.5 text-[10px] font-semibold text-destructive-foreground">
                                          In progress
                                        </span>
                                      ) : null}
                                    </div>
                                  </div>
                                </Link>
                              );
                            })}
                          </div>
                        </div>
                      ) : null}
                      {attendingGroups.length > 0 ? (
                        <div className="space-y-2">
                          <div className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
                            Attending
                          </div>
                          <div className="space-y-2">
                            {attendingGroups.map((group: any) => {
                              const coverUrl = resolveCoverUrl(
                                group.cover_image_url
                              );
                              const whenLabel = formatGroupWhen(
                                group.start_time,
                                group.end_time
                              );
                              const inProgress = isGroupInProgress(
                                group.start_time,
                                group.end_time
                              );
                              return (
                                <Link
                                  key={group.id}
                                  href={`/app/activity/groups/${group.id}`}
                                  className="rounded-xl bg-secondary/30 px-4 py-3 text-sm font-medium text-foreground flex items-center gap-3"
                                >
                                  <div className="h-10 w-10 rounded-lg bg-muted/40 overflow-hidden shrink-0">
                                    {coverUrl ? (
                                      <img
                                        src={coverUrl}
                                        alt={group.title || "Group cover"}
                                        className="h-full w-full object-cover"
                                      />
                                    ) : null}
                                  </div>
                                  <div className="min-w-0">
                                    <div className="truncate">
                                      {group.title || "Untitled group"}
                                    </div>
                                    <div className="flex items-center gap-2 text-xs text-foreground truncate">
                                      <span className="truncate text-muted-foreground">
                                        {whenLabel}
                                      </span>
                                      {inProgress ? (
                                        <span className="rounded-full bg-destructive px-2 py-0.5 text-[10px] font-semibold text-destructive-foreground">
                                          In progress
                                        </span>
                                      ) : null}
                                    </div>
                                  </div>
                                </Link>
                              );
                            })}
                          </div>
                        </div>
                      ) : null}
                    </div>
                  )}
                </ScrollArea>
              </div>
            </DrawerContent>
          </Drawer>

          <Drawer open={sharedLinksOpen} onOpenChange={setSharedLinksOpen}>
            <DrawerContent>
              <div className="mx-auto w-full max-w-xl p-4 pb-6 space-y-4">
                <DrawerHeader className="px-0 pt-0 pb-2">
                  <DrawerTitle>Shared links</DrawerTitle>
                </DrawerHeader>
                {sharedLinksLoading ? (
                  <div className="space-y-2">
                    {[1, 2, 3].map((i) => (
                      <div
                        key={`link-skeleton-${i}`}
                        className="rounded-xl bg-secondary/30 px-4 py-3"
                      >
                        <Skeleton className="h-4 w-3/4" />
                        <Skeleton className="h-3 w-1/2 mt-2" />
                      </div>
                    ))}
                  </div>
                ) : sharedLinksError ? (
                  <div className="text-sm text-muted-foreground">
                    {sharedLinksError}
                  </div>
                ) : sharedLinks.length === 0 ? (
                  <div className="rounded-xl bg-secondary/30 px-4 py-4">
                    <Empty>
                      <EmptyHeader>
                        <EmptyMedia variant="icon">
                          <LinkIcon className="h-6 w-6" />
                        </EmptyMedia>
                        <EmptyTitle>No shared links</EmptyTitle>
                        <EmptyDescription>
                          Links shared between you will show up here.
                        </EmptyDescription>
                      </EmptyHeader>
                    </Empty>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {sharedLinks.map((link: any) => (
                      <a
                        key={link.id}
                        href={link.url}
                        target="_blank"
                        rel="noreferrer"
                        className="rounded-xl bg-secondary/30 px-4 py-3 block"
                      >
                        <div className="flex items-center gap-3">
                          <div className="h-10 w-10 rounded-lg bg-muted/40 overflow-hidden shrink-0 flex items-center justify-center">
                            {link.image ? (
                              <img
                                src={link.image}
                                alt={link.title || "Link preview"}
                                className="h-full w-full object-cover"
                              />
                            ) : (
                              <Globe className="h-4 w-4 text-muted-foreground" />
                            )}
                          </div>
                          <div className="min-w-0">
                            <div className="text-sm font-medium text-foreground truncate">
                              {link.title}
                            </div>
                            {link.hostname ? (
                              <div className="text-xs text-muted-foreground truncate">
                                {link.hostname}
                              </div>
                            ) : null}
                          </div>
                        </div>
                      </a>
                    ))}
                  </div>
                )}
              </div>
            </DrawerContent>
          </Drawer>
        </div>
      )}
    </div>
  );
}
