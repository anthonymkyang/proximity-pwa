"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import NotificationsButton from "@/components/ui/notifications-button";
import { createClient } from "@/utils/supabase/client";

type NotificationsProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export default function Notifications({
  open,
  onOpenChange,
}: NotificationsProps) {
  const [hasUnread, setHasUnread] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    let channel: ReturnType<typeof supabase.channel> | null = null;
    let mounted = true;

    const refreshUnread = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!mounted || !user) return;
      const { count } = await supabase
        .from("notifications")
        .select("id", { count: "exact", head: true })
        .eq("recipient_id", user.id)
        .is("read_at", null);
      if (!mounted) return;
      setHasUnread((count ?? 0) > 0);
    };

    const subscribe = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!mounted || !user) return;
      channel = supabase
        .channel(`notifications-button:${user.id}`)
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "notifications",
            filter: `recipient_id=eq.${user.id}`,
          },
          () => {
            void refreshUnread();
          }
        )
        .subscribe();
    };

    void refreshUnread();
    void subscribe();

    return () => {
      mounted = false;
      if (channel) supabase.removeChannel(channel);
    };
  }, []);

  return (
    <Link
      href="/app/notifications"
      onClick={() => onOpenChange(false)}
      aria-label="Open notifications"
    >
      <NotificationsButton showDot={hasUnread} />
    </Link>
  );
}
