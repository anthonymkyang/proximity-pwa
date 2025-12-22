"use client";

import Link from "next/link";
import NotificationsButton from "@/components/shadcn-studio/button/button-38";

type NotificationsProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export default function Notifications({
  open,
  onOpenChange,
}: NotificationsProps) {
  return (
    <Link
      href="/app/notifications"
      onClick={() => onOpenChange(false)}
      aria-label="Open notifications"
    >
      <NotificationsButton />
    </Link>
  );
}
