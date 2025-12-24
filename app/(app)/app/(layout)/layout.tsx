"use client";

import * as React from "react";
import { usePathname, useSearchParams } from "next/navigation";

import TopBar from "@/components/nav/TopBar";
import Notifications from "@/components/activity/Notifications";
import BackButton from "@/components/ui/back-button";
import HeaderButton from "@/components/ui/header-button";
import { MoreHorizontal } from "lucide-react";

export default function ShellLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [notifOpen, setNotifOpen] = React.useState(false);
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const rootPaths = ["/app/activity", "/app/messages", "/app/connections"];
  const isCreateGroup = pathname?.startsWith("/app/activity/groups/create");
  const stepParam = searchParams?.get("step");
  const currentStep = stepParam ? Number(stepParam) : 1;
  const showBack = !rootPaths.includes(pathname);
  const showBackButton =
    showBack && (!isCreateGroup || (Number.isFinite(currentStep) && currentStep <= 1));
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
              leftContent={
                showBackButton ? (
                  <BackButton />
                ) : pathname === "/app/messages" ? (
                  <HeaderButton
                    variant="secondary"
                    className="size-8"
                    aria-label="More options"
                    onClick={() => {
                      window.dispatchEvent(
                        new CustomEvent("messages:toggle-actions")
                      );
                    }}
                  >
                    <MoreHorizontal className="h-4 w-4" />
                  </HeaderButton>
                ) : (
                  <div />
                )
              }
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
