"use client";

import * as React from "react";
import { usePathname } from "next/navigation";

import TopBar from "@/components/nav/TopBar";
import Notifications from "@/components/activity/Notifications";
import BackButton from "@/components/ui/back-button";

export default function ShellLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [notifOpen, setNotifOpen] = React.useState(false);
  const pathname = usePathname();

  const rootPaths = ["/app/activity", "/app/messages", "/app/connections"];
  const showBack = !rootPaths.includes(pathname);
  const hideTopBar =
    pathname?.startsWith("/app/messages/") ||
    pathname?.startsWith("/app/notifications") ||
    (pathname?.startsWith("/app/activity/groups/") &&
      !pathname?.includes("/manage") &&
      !pathname?.includes("/create") &&
      !pathname?.includes("/requests"));
  const removePadding =
    hideTopBar ||
    pathname?.startsWith("/app/connections") ||
    pathname === "/app/messages" ||
    pathname === "/app/activity" ||
    pathname === "/app/activity/groups" ||
    pathname?.startsWith("/app/activity/groups/manage") ||
    pathname?.startsWith("/app/activity/groups/create") ||
    (pathname?.startsWith("/app/activity/groups/") &&
      pathname?.includes("/requests"));
  const removeMaxWidth =
    pathname?.startsWith("/app/connections") ||
    pathname === "/app/messages" ||
    pathname === "/app/activity";
  const containerClasses = removePadding
    ? removeMaxWidth
      ? "flex h-svh w-full flex-col pb-[env(safe-area-inset-bottom,0px)] overflow-hidden"
      : "mx-auto flex h-svh w-full max-w-xl flex-col pb-[env(safe-area-inset-bottom,0px)] overflow-hidden"
    : "mx-auto flex h-svh w-full max-w-xl flex-col px-4 pb-[env(safe-area-inset-bottom,0px)] overflow-hidden";

  return (
    <div className={containerClasses}>
      <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden flex flex-col [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
        {!hideTopBar && (
          <div className={removePadding ? "px-4" : ""}>
            <TopBar
              leftContent={showBack ? <BackButton /> : <div />}
              rightContent={
                <Notifications open={notifOpen} onOpenChange={setNotifOpen} />
              }
            />
          </div>
        )}
        <div className="flex-1 min-h-0">{children}</div>
      </div>
    </div>
  );
}
