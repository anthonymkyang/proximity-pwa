"use client";

import * as React from "react";

import TopBar from "@/components/nav/TopBar";
import { Button } from "@/components/ui/button";
import { MoreHorizontal, ChevronRight } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

// Sheet imports removed, now handled in Notifications component
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
// Notification icon imports removed, now handled in Notifications component
import Notifications from "@/components/activity/Notifications";
import Groups from "@/components/activity/Groups";
import Calendar from "@/components/activity/Calendar";
import Timeline from "@/components/activity/Timeline";
import Events from "@/components/activity/Events";

export default function ActivityPage() {
  const [activeTab, setActiveTab] = React.useState<
    "Groups" | "Calendar" | "Timeline" | "Events"
  >("Groups");
  const [notifOpen, setNotifOpen] = React.useState(false);

  return (
    <div
      className={`mx-auto w-full max-w-xl px-4 pb-[calc(72px+env(safe-area-inset-bottom))] transition-transform duration-300 ${
        notifOpen ? "-translate-x-[80vw]" : ""
      }`}
    >
      <TopBar
        leftContent={
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" aria-label="Menu">
                <MoreHorizontal className="h-5 w-5" />
              </Button>
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
      >
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
      </TopBar>

      {activeTab === "Groups" && <Groups />}

      {activeTab === "Calendar" && <Calendar />}

      {activeTab === "Timeline" && <Timeline />}

      {activeTab === "Events" && <Events />}
    </div>
  );
}
