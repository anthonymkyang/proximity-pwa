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
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";

type NotificationsProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export default function Notifications({
  open,
  onOpenChange,
}: NotificationsProps) {
  const todayNotifications = [
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
  ];

  const restNotifications = [
    {
      icon: Check,
      title: "Match confirmed",
      subtitle: "You and DL Neighbor are now connected",
      time: "3h",
    },
    {
      icon: MessageCircle,
      title: "New message from GymBro27",
      subtitle: "Leg day tomorrow?",
      time: "4h",
    },
    {
      icon: Users,
      title: "Invite accepted",
      subtitle: "PupMax joined your event",
      time: "5h",
    },
    {
      icon: CalendarIcon,
      title: "Upcoming group hike",
      subtitle: "Queer Hikers meet at 9 AM",
      time: "6h",
    },
    {
      icon: Check,
      title: "Connection approved",
      subtitle: "You and MuscleBear are now connected",
      time: "8h",
    },
    {
      icon: MessageCircle,
      title: "New message from Dax",
      subtitle: "Hey, want to grab a coffee later?",
      time: "12h",
    },
    {
      icon: CalendarIcon,
      title: "Event added to your calendar",
      subtitle: "Trivia Night @ Soho Pub",
      time: "3d",
    },
    {
      icon: Users,
      title: "New group nearby",
      subtitle: "Pride Cyclists just formed in your area",
      time: "4d",
    },
  ];

  const yesterdayNotifications = restNotifications.slice(0, 5);
  const olderNotifications = restNotifications.slice(5);

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
        className="h-full w-[90%] overflow-y-auto scrollbar-none border-l bg-card text-card-foreground shadow-xl px-4 pb-6"
      >
        <style>{`
          .scrollbar-none::-webkit-scrollbar {
            display: none;
          }
        `}</style>
        <SheetHeader>
          <SheetTitle>Notifications</SheetTitle>
        </SheetHeader>

        <ul className="space-y-0">
          <h3 className="text-xs font-semibold uppercase text-muted-foreground tracking-wide mb-1 px-1">
            Today
          </h3>
          {todayNotifications.map((n, i) => (
            <li
              key={`today-${i}`}
              className={`py-2 px-4 -mx-4 rounded-lg ${
                i < 4 ? "bg-muted/40" : ""
              }`}
            >
              <div className="flex items-start gap-3">
                <div className="relative mt-0.5 h-10 w-10 rounded-full bg-muted flex items-center justify-center">
                  <n.icon className="h-5 w-5 text-muted-foreground" />
                  <div className="absolute -bottom-1 -right-1 h-5 w-5 ring-2 ring-card">
                    <Avatar className="h-5 w-5">
                      <AvatarImage src="" alt="avatar" />
                      <AvatarFallback className="text-[8px] uppercase">
                        {String.fromCharCode(
                          65 + Math.floor(Math.random() * 26)
                        )}
                        {String.fromCharCode(
                          65 + Math.floor(Math.random() * 26)
                        )}
                      </AvatarFallback>
                    </Avatar>
                  </div>
                </div>
                <div className="min-w-0 flex-1 pt-1">
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

          <h3 className="text-xs font-semibold uppercase text-muted-foreground tracking-wide mb-1 mt-3 px-1">
            Yesterday
          </h3>
          {yesterdayNotifications.map((n, i) => (
            <li
              key={`yesterday-${i}`}
              className={`py-2 px-4 -mx-4 rounded-lg ${
                i === 0 ? "bg-muted/40" : ""
              }`}
            >
              <div className="flex items-start gap-3">
                <div className="relative mt-0.5 h-10 w-10 rounded-full bg-muted flex items-center justify-center">
                  <n.icon className="h-5 w-5 text-muted-foreground" />
                  <div className="absolute -bottom-1 -right-1 h-5 w-5 ring-2 ring-card">
                    <Avatar className="h-5 w-5">
                      <AvatarImage src="" alt="avatar" />
                      <AvatarFallback className="text-[8px] uppercase">
                        {String.fromCharCode(
                          65 + Math.floor(Math.random() * 26)
                        )}
                        {String.fromCharCode(
                          65 + Math.floor(Math.random() * 26)
                        )}
                      </AvatarFallback>
                    </Avatar>
                  </div>
                </div>
                <div className="min-w-0 flex-1 pt-1">
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

          <h3 className="text-xs font-semibold uppercase text-muted-foreground tracking-wide mb-1 mt-3 px-1">
            This week
          </h3>
          {olderNotifications.map((n, i) => (
            <li key={`rest-${i}`} className="py-2 rounded-lg">
              <div className="flex items-start gap-3">
                <div className="relative mt-0.5 h-10 w-10 rounded-full bg-muted flex items-center justify-center">
                  <n.icon className="h-5 w-5 text-muted-foreground" />
                  <div className="absolute -bottom-1 -right-1 h-5 w-5 ring-2 ring-card">
                    <Avatar className="h-5 w-5">
                      <AvatarImage src="" alt="avatar" />
                      <AvatarFallback className="text-[8px] uppercase">
                        {String.fromCharCode(
                          65 + Math.floor(Math.random() * 26)
                        )}
                        {String.fromCharCode(
                          65 + Math.floor(Math.random() * 26)
                        )}
                      </AvatarFallback>
                    </Avatar>
                  </div>
                </div>
                <div className="min-w-0 flex-1 pt-1">
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
        <div className="mb-4 flex justify-center">
          <Button variant="outline" size="sm" className="px-6">
            Load more
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
