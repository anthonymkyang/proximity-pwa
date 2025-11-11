"use client";

import * as React from "react";

import TopBar from "@/components/nav/TopBar";
import HeaderButton from "@/components/ui/header-button";
import { MoreHorizontal, ChevronRight } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import Badge24 from "@/components/shadcn-studio/badge/badge-24";

// Notification icon imports removed, now handled in Notifications component
import Notifications from "@/components/activity/Notifications";
import { Button } from "@/components/ui/button";
import Groups from "@/components/activity/Groups";
import Calendar from "@/components/activity/Calendar";
import Timeline from "@/components/activity/Timeline";
import Events from "@/components/activity/Events";

import { createClient } from "@/utils/supabase/client";

type DebugUser = {
  id: string;
  name: string;
  initials: string;
  avatar: string | null;
  status: "online" | "away" | "recent" | null;
};

export default function ActivityPage() {
  const [activeTab, setActiveTab] = React.useState<
    "Groups" | "Calendar" | "Timeline" | "Events"
  >("Groups");
  const [users, setUsers] = React.useState<DebugUser[] | null>(null);
  const [notifOpen, setNotifOpen] = React.useState(false);

  React.useEffect(() => {
    let mounted = true;
    const supa = createClient();

    async function load() {
      try {
        // 1) Pull recent presence rows
        const { data: presenceRows, error: presErr } = await supa
          .from("user_presence")
          .select("user_id,status,updated_at")
          .order("updated_at", { ascending: false })
          .limit(20);
        // eslint-disable-next-line no-console
        console.log("[Activity] raw user_presence rows", presenceRows);
        if (presErr) {
          // eslint-disable-next-line no-console
          console.error("[Debug] presence fetch error", presErr);
          if (mounted) setUsers([]);
          return;
        }
        const ids = Array.from(
          new Set((presenceRows || []).map((r) => r.user_id))
        ).filter(Boolean);
        if (ids.length === 0) {
          if (mounted) setUsers([]);
          return;
        }
        // 2) Fetch matching profiles
        const { data: profilesRows, error: profErr } = await supa
          .from("profiles")
          .select("id, profile_title, avatar_url")
          .in("id", ids);
        if (profErr) {
          // eslint-disable-next-line no-console
          console.error("[Debug] profiles fetch error", profErr);
          if (mounted) setUsers([]);
          return;
        }
        const byId = new Map<string, any>();
        (profilesRows || []).forEach((p: any) => byId.set(p.id, p));

        const merged: DebugUser[] = (presenceRows || []).map((r: any) => {
          const p = byId.get(r.user_id) || {};
          const title: string = p.profile_title || "Unknown";
          const initials = title
            .split(" ")
            .map((w: string) => w.trim()[0])
            .filter(Boolean)
            .slice(0, 2)
            .join("")
            .toUpperCase();
          const raw =
            typeof r.status === "string" ? r.status.toLowerCase() : null;
          const status: DebugUser["status"] =
            raw === "online" || raw === "away" || raw === "recent" ? raw : null;
          return {
            id: r.user_id,
            name: title,
            initials: initials || "?",
            avatar: p.avatar_url || null,
            status,
          };
        });
        // eslint-disable-next-line no-console
        console.log("[Activity] merged presence data", merged);

        if (mounted) setUsers(merged);
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error("[Debug] load error", err);
        if (mounted) setUsers([]);
      }
    }

    load();
    return () => {
      mounted = false;
    };
  }, []);

  return (
    <div
      className={`mx-auto w-full max-w-xl px-4 pb-[calc(72px+env(safe-area-inset-bottom))] transition-transform duration-300 ${
        notifOpen ? "-translate-x-[90vw]" : ""
      }`}
    >
      <TopBar
        leftContent={
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <HeaderButton aria-label="Menu">
                <MoreHorizontal className="h-6 w-6 text-white" />
              </HeaderButton>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="start"
              sideOffset={8}
              className="min-w-56"
            >
              <DropdownMenuItem>Manage groups</DropdownMenuItem>
              <DropdownMenuItem>Manage calendar</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        }
        rightContent={
          <Notifications open={notifOpen} onOpenChange={setNotifOpen} />
        }
      ></TopBar>

      <h1 className="px-1 pb-2 text-4xl font-extrabold tracking-tight">
        Activity
      </h1>

      {/* Filter chips */}
      <div className="flex gap-2 overflow-x-auto pb-3 -mx-4 px-4 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
        {["Groups", "Calendar", "Timeline", "Events"].map((label) => (
          <Button
            key={label}
            size="sm"
            variant={activeTab === label ? "default" : "outline"}
            className="rounded-full whitespace-nowrap"
            onClick={() => setActiveTab(label as typeof activeTab)}
          >
            {label}
          </Button>
        ))}
      </div>
      {activeTab === "Groups" && <Groups />}

      {activeTab === "Calendar" && <Calendar />}

      {activeTab === "Timeline" && <Timeline />}

      {activeTab === "Events" && <Events />}
    </div>
  );
}
