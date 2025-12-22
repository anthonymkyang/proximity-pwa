"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { createClient } from "@/utils/supabase/client";
import { Compass, Zap, Users, MessageCircle, User } from "lucide-react";

export default function AppBar() {
  const pathname = usePathname();
  const supabaseRef = useRef(createClient());
  const [hasUnread, setHasUnread] = useState(false);
  const [hasUnreadNotifications, setHasUnreadNotifications] = useState(false);

  useEffect(() => {
    let active = true;

    const refreshUnread = async () => {
      try {
        const supabase = supabaseRef.current;
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) {
          if (active) setHasUnread(false);
          return;
        }

        const { data: memberships } = await supabase
          .from("conversation_members")
          .select("conversation_id")
          .eq("user_id", user.id);
        const convoIds = (memberships ?? [])
          .map((m) => m.conversation_id)
          .filter(Boolean);
        if (convoIds.length === 0) {
          if (active) setHasUnread(false);
          return;
        }

        const { data: msgs } = await supabase
          .from("messages")
          .select("id")
          .in("conversation_id", convoIds)
          .neq("sender_id", user.id)
          .order("created_at", { ascending: false })
          .limit(200);

        const msgIds = (msgs ?? []).map((m) => m.id).filter(Boolean);
        if (msgIds.length === 0) {
          if (active) setHasUnread(false);
          return;
        }

        const { data: readRecs } = await supabase
          .from("message_receipts")
          .select("message_id")
          .in("message_id", msgIds)
          .eq("user_id", user.id)
          .not("read_at", "is", null);

        const readSet = new Set((readRecs ?? []).map((r) => r.message_id));
        const hasUnreadLocal = msgIds.some((id) => !readSet.has(id));
        if (active) setHasUnread(hasUnreadLocal);
      } catch {
        if (active) setHasUnread(false);
      }
    };

    const refreshNotificationsUnread = async () => {
      try {
        const supabase = supabaseRef.current;
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) {
          if (active) setHasUnreadNotifications(false);
          return;
        }
        const { count } = await supabase
          .from("notifications")
          .select("id", { count: "exact", head: true })
          .eq("recipient_id", user.id)
          .is("read_at", null);
        if (active) setHasUnreadNotifications((count ?? 0) > 0);
      } catch {
        if (active) setHasUnreadNotifications(false);
      }
    };

    refreshUnread();
    refreshNotificationsUnread();

    const supabase = supabaseRef.current;
    const channel = supabase.channel("appbar:unread");

    channel.on(
      "postgres_changes",
      { event: "INSERT", schema: "public", table: "messages" },
      async (payload: any) => {
        const senderId = payload?.new?.sender_id as string | undefined;
        const convoId = payload?.new?.conversation_id as string | undefined;
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user || !senderId || senderId === user.id) return;
        if (convoId) {
          const { data: memberRow } = await supabase
            .from("conversation_members")
            .select("conversation_id")
            .eq("conversation_id", convoId)
            .eq("user_id", user.id)
            .maybeSingle();
          if (!memberRow) return;
        }
        setHasUnread(true);
      }
    );

    channel.on(
      "postgres_changes",
      { event: "INSERT", schema: "public", table: "conversation_members" },
      async (payload: any) => {
        const row = payload?.new as {
          user_id?: string;
          conversation_id?: string;
        };
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user || row?.user_id !== user.id) return;
        refreshUnread();
      }
    );

    channel.on(
      "postgres_changes",
      { event: "*", schema: "public", table: "message_receipts" },
      async (payload: any) => {
        const row = (payload.new ?? payload.old) as {
          user_id?: string;
          read_at?: string | null;
        };
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user || row?.user_id !== user.id || !row.read_at) return;
        refreshUnread();
      }
    );

    channel.subscribe();

    let notifChannel: ReturnType<typeof supabase.channel> | null = null;
    const subscribeNotifications = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user || !active) return;
      notifChannel = supabase
        .channel(`appbar:notifications:${user.id}`)
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "notifications",
            filter: `recipient_id=eq.${user.id}`,
          },
          () => {
            refreshNotificationsUnread();
          }
        )
        .subscribe();
    };

    void subscribeNotifications();

    return () => {
      active = false;
      supabase.removeChannel(channel);
      if (notifChannel) {
        supabase.removeChannel(notifChannel);
      }
    };
  }, []);

  const navItems = [
    { name: "Explore", href: "/app", icon: Compass },
    { name: "Activity", href: "/app/activity", icon: Zap },
    { name: "Connections", href: "/app/connections", icon: Users },
    { name: "Messages", href: "/app/messages", icon: MessageCircle },
    { name: "Me", href: "/app/settings", icon: User },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-20 bg-card/95 backdrop-blur supports-backdrop-filter:bg-card/80 text-card-foreground">
      <ul className="flex justify-between items-center py-2">
        {navItems.map(({ name, href, icon: Icon }) => {
          const active = pathname === href;
          const showUnreadDot = name === "Messages" && hasUnread;
          const showNotificationsDot =
            name === "Activity" && hasUnreadNotifications;
          return (
            <li key={href} className="flex-1 text-center">
              <Link
                href={href}
                className={`flex flex-col items-center text-[10px] transition-colors ${
                  active
                    ? "text-primary"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <span className="relative mb-0.5 inline-flex">
                  <Icon className="h-5 w-5" />
                  {showUnreadDot || showNotificationsDot ? (
                    <span className="absolute -top-0.5 -right-1 h-2 w-2 rounded-full bg-destructive" />
                  ) : null}
                </span>
                {name}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
