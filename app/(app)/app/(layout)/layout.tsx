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
  const hideTopBar = pathname?.startsWith("/app/messages/");
  const containerClasses = hideTopBar
    ? "flex h-svh w-full flex-col pb-[env(safe-area-inset-bottom,0px)] overflow-hidden"
    : "mx-auto flex h-svh w-full max-w-xl flex-col px-4 pb-[env(safe-area-inset-bottom,0px)] overflow-hidden";

  return (
    <div className={containerClasses}>
      <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden flex flex-col">
        {!hideTopBar && (
          <TopBar
            leftContent={showBack ? <BackButton /> : <div />}
            rightContent={
              <Notifications open={notifOpen} onOpenChange={setNotifOpen} />
            }
          />
        )}
        <div className="flex-1 min-h-0">{children}</div>
      </div>
    </div>
  );
}
