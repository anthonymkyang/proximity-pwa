"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  Bell,
  Check,
  MessageCircle,
  Users,
  Calendar as CalendarIcon,
} from "lucide-react";

type NotificationsProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export default function Notifications({
  open,
  onOpenChange,
}: NotificationsProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetTrigger asChild>
        <Button
          variant="default"
          size="icon"
          className="relative rounded-full"
          aria-label="Notifications"
        >
          <Bell className="h-5 w-5" />
          <span className="absolute bottom-0 right-0 block h-2.5 w-2.5 rounded-full bg-red-500" />
        </Button>
      </SheetTrigger>

      <SheetContent
        side="right"
        className="h-full w-[80%] overflow-y-auto border-l bg-card text-card-foreground shadow-xl px-4"
      >
        <SheetHeader>
          <SheetTitle>Notifications</SheetTitle>
        </SheetHeader>

        <ul className="mt-4 space-y-2 px-1">
          {[
            {
              icon: MessageCircle,
              title: "New message from PupMax",
              subtitle: "Woof. You around?",
              time: "2m",
            },
            {
              icon: Users,
              title: "New member in Coffee Crew",
              subtitle: "Dax joined the group",
              time: "18m",
            },
            {
              icon: CalendarIcon,
              title: "Event reminder",
              subtitle: "Drag Trivia starts in 1h",
              time: "1h",
            },
            {
              icon: Check,
              title: "Match confirmed",
              subtitle: "You and DL Neighbor are now connected",
              time: "3h",
            },
          ].map((n, i) => (
            <li key={i} className="py-2">
              <div className="flex items-start gap-3">
                <div className="mt-0.5 h-8 w-8 rounded-full bg-muted flex items-center justify-center">
                  <n.icon className="h-4 w-4 text-muted-foreground" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium truncate">{n.title}</p>
                  <p className="text-xs text-muted-foreground truncate mt-0.5">
                    {n.subtitle}
                  </p>
                </div>
                <div className="text-[10px] text-muted-foreground shrink-0">
                  {n.time}
                </div>
              </div>
            </li>
          ))}
        </ul>
      </SheetContent>
    </Sheet>
  );
}
