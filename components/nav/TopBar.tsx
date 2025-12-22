"use client";

import { ReactNode, useEffect, useMemo, useState } from "react";
import NotificationsButton from "@/components/ui/notifications-button";
import { createClient } from "@/utils/supabase/client";

export type TopBarProps = {
  leftContent?: ReactNode;
  rightContent?: ReactNode;
  showNotificationsButton?: boolean;
  children?: ReactNode; // Optional content below the top row (e.g., title, search, chips)
  className?: string;
};

export default function TopBar({
  leftContent,
  rightContent,
  showNotificationsButton = true,
  children,
  className,
}: TopBarProps) {
  const [hasUnread, setHasUnread] = useState(false);
  const showButton = showNotificationsButton && rightContent == null;

  useEffect(() => {
    if (!showButton) return;
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
        .channel(`notifications-topbar:${user.id}`)
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
  }, [showButton]);

  const resolvedRightContent = useMemo(() => {
    if (rightContent !== undefined) {
      return rightContent;
    }
    return showButton ? <NotificationsButton showDot={hasUnread} /> : null;
  }, [rightContent, showButton, hasUnread]);
  return (
    <div className={`bg-background pb-3 ${className ?? ""}`}>
      <div className="flex items-center justify-between pt-3">
        <div className="shrink-0 flex items-center gap-2">{leftContent}</div>
        <div className="shrink-0 flex items-center gap-2">
          {resolvedRightContent}
        </div>
      </div>
      {children}
    </div>
  );
}
