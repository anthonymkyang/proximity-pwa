"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import {
  Users,
  UserPlus,
  CalendarClock,
  MapPin,
  Clock,
  Info,
  ShieldCheck,
  CheckCircle2,
  ChevronRight,
  ChevronLeft,
  MoreVertical,
} from "lucide-react";
import TopBar from "@/components/nav/TopBar";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

export default function GroupPage() {
  const [requesting, setRequesting] = React.useState(false);
  const [requested, setRequested] = React.useState(false);
  const [attendeesOpen, setAttendeesOpen] = React.useState(false);

  const handleRequest = async () => {
    setRequesting(true);
    // simulate request
    setTimeout(() => {
      setRequested(true);
      setRequesting(false);
    }, 800);
  };

  return (
    <>
      <TopBar
        leftContent={
          <Button variant="ghost" size="icon" aria-label="Back">
            <ChevronLeft className="h-5 w-5" />
          </Button>
        }
        rightContent={
          <Button variant="ghost" size="icon" aria-label="More options">
            <MoreVertical className="h-5 w-5" />
          </Button>
        }
      />
      <div
        className={`mx-auto w-full max-w-xl px-4 pb-[calc(88px+env(safe-area-inset-bottom))] transition-transform duration-300 ${
          attendeesOpen ? "-translate-x-[90vw]" : ""
        }`}
      >
        {/* Title */}
        <header className="pt-2 pb-3">
          <h1 className="text-3xl font-extrabold tracking-tight">
            Weekend Hikers
          </h1>
          <div className="mt-1 inline-block px-2.5 py-0.5 rounded-full bg-primary/10 text-primary text-xs font-medium">
            Pump n dump
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Casual Saturday hikes around London with friendly guys. All levels
            welcome.
          </p>
        </header>

        {/* Group image placeholder */}
        <div className="mt-4 w-full aspect-video rounded-xl bg-muted flex items-center justify-center text-sm text-muted-foreground">
          Image placeholder
        </div>

        {/* Host & Co-hosts */}
        <section className="mt-4">
          <h2 className="text-xs font-semibold tracking-wider text-muted-foreground uppercase mb-2">
            Hosting & co-hosts
          </h2>
          <div className="px-1">
            <div className="flex items-center gap-3">
              {/* Host */}
              <div className="flex items-center gap-2">
                <Avatar className="h-9 w-9">
                  <AvatarImage src="" alt="Host" />
                  <AvatarFallback className="text-[10px]">HM</AvatarFallback>
                </Avatar>
                <div>
                  <p className="text-sm font-medium leading-tight">Hudson M</p>
                  <p className="text-[11px] text-muted-foreground">Host</p>
                </div>
              </div>
              <Separator orientation="vertical" className="mx-2 h-8" />
              {/* Co-hosts */}
              <div className="flex items-center gap-3">
                {["JS", "AR"].map((ii, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <Avatar className="h-8 w-8">
                      <AvatarImage src="" alt="Co-host" />
                      <AvatarFallback className="text-[10px]">
                        {ii}
                      </AvatarFallback>
                    </Avatar>
                  </div>
                ))}
                <span className="text-xs text-muted-foreground">Co‑hosts</span>
              </div>
            </div>
          </div>
        </section>

        {/* Attendees */}
        <section className="mt-6">
          <h2 className="text-xs font-semibold tracking-wider text-muted-foreground uppercase mb-2">
            Attendees
          </h2>
          <div className="px-1">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="flex -space-x-2">
                  {["PM", "DL", "GB", "CC", "AH", "SF"].map((label, i) => (
                    <Avatar key={i} className="h-8 w-8 ring-2 ring-card">
                      <AvatarImage src="" alt="" />
                      <AvatarFallback className="text-[10px]">
                        {label}
                      </AvatarFallback>
                    </Avatar>
                  ))}
                </div>
                <span className="text-sm text-muted-foreground">+24</span>
              </div>
              <Sheet open={attendeesOpen} onOpenChange={setAttendeesOpen}>
                <SheetTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 px-3 text-xs font-medium"
                  >
                    View all
                  </Button>
                </SheetTrigger>
                <SheetContent
                  side="right"
                  className="h-full w-[90%] overflow-y-auto overflow-x-hidden border-l bg-card text-card-foreground shadow-xl px-4 pb-6"
                >
                  <SheetHeader>
                    <SheetTitle>All attending</SheetTitle>
                  </SheetHeader>

                  {/* Attendees list */}
                  <ul className="space-y-4 px-1">
                    <p className="text-sm font-semibold mb-2 px-1">
                      24 attending
                    </p>
                    <li>
                      <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 px-1">
                        Host
                      </h3>
                      <ul className="space-y-3">
                        {[
                          { name: "Hudson M", subtitle: "24, bi-curious, top" },
                        ].map(({ name, subtitle }) => (
                          <li
                            key={name}
                            className="flex items-center gap-3 py-2"
                          >
                            <Avatar className="h-9 w-9 ring-2 ring-card">
                              <AvatarImage src="" alt="" />
                              <AvatarFallback className="text-[10px]">
                                {name
                                  .split(" ")
                                  .map((w) => w[0])
                                  .join("")
                                  .slice(0, 2)
                                  .toUpperCase()}
                              </AvatarFallback>
                            </Avatar>
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-medium truncate">
                                {name}
                              </p>
                              <p className="text-xs text-muted-foreground truncate">
                                {subtitle}
                              </p>
                            </div>
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-8 px-3 text-xs"
                            >
                              View
                            </Button>
                          </li>
                        ))}
                      </ul>
                    </li>

                    <li>
                      <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 px-1">
                        Co-hosts
                      </h3>
                      <ul className="space-y-3">
                        {[
                          { name: "Jordan S", subtitle: "19, gay, vers top" },
                          { name: "Alex R", subtitle: "32, bisexual" },
                        ].map(({ name, subtitle }) => (
                          <li
                            key={name}
                            className="flex items-center gap-3 py-2"
                          >
                            <Avatar className="h-9 w-9 ring-2 ring-card">
                              <AvatarImage src="" alt="" />
                              <AvatarFallback className="text-[10px]">
                                {name
                                  .split(" ")
                                  .map((w) => w[0])
                                  .join("")
                                  .slice(0, 2)
                                  .toUpperCase()}
                              </AvatarFallback>
                            </Avatar>
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-medium truncate">
                                {name}
                              </p>
                              <p className="text-xs text-muted-foreground truncate">
                                {subtitle}
                              </p>
                            </div>
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-8 px-3 text-xs"
                            >
                              View
                            </Button>
                          </li>
                        ))}
                      </ul>
                    </li>

                    <li>
                      <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 px-1">
                        Attending (24)
                      </h3>
                      <ul className="space-y-3">
                        {[
                          { name: "PupMax", subtitle: "28, gay, vers" },
                          {
                            name: "DL Neighbor",
                            subtitle: "35, straight-curious",
                          },
                          {
                            name: "Gym Buddies",
                            subtitle: "27, pansexual, bottom",
                          },
                          { name: "Coffee Crew", subtitle: "22, gay" },
                          {
                            name: "After Hours",
                            subtitle: "31, bi-curious, dom top",
                          },
                          {
                            name: "Sunday Funday",
                            subtitle: "26, vers bottom",
                          },
                          { name: "East End Runners", subtitle: "29" },
                          { name: "Shoreditch Crew", subtitle: "24, gay, top" },
                          {
                            name: "Vauxhall Night Owls",
                            subtitle: "33, bisexual, vers",
                          },
                          {
                            name: "Pride Film Club",
                            subtitle: "21, gay, sub bottom",
                          },
                        ].map(({ name, subtitle }, index) => (
                          <li
                            key={name}
                            className="flex items-center gap-3 py-2"
                          >
                            <Avatar
                              className={`h-9 w-9 ring-2 ${
                                [0, 1, 2, 3].includes(index)
                                  ? "ring-blue-500"
                                  : "ring-card"
                              }`}
                            >
                              <AvatarImage src="" alt="" />
                              <AvatarFallback className="text-[10px]">
                                {name
                                  .split(" ")
                                  .map((w) => w[0])
                                  .join("")
                                  .slice(0, 2)
                                  .toUpperCase()}
                              </AvatarFallback>
                            </Avatar>
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-medium truncate">
                                {name}
                              </p>
                              <p className="text-xs text-muted-foreground truncate">
                                {subtitle}
                              </p>
                            </div>
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-8 px-3 text-xs"
                            >
                              View
                            </Button>
                          </li>
                        ))}
                      </ul>
                    </li>
                  </ul>
                </SheetContent>
              </Sheet>
            </div>
          </div>
        </section>

        {/* When & Where */}
        <section className="mt-6 grid grid-cols-1 gap-3">
          <div className="px-1">
            <div className="flex items-center gap-3">
              <CalendarClock className="h-5 w-5 text-muted-foreground" />
              <div className="min-w-0">
                <p className="text-sm font-medium">Saturday, 12 Apr 2026</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Start <span className="font-medium">10:00</span> — End{" "}
                  <span className="font-medium">14:00</span>
                </p>
              </div>
            </div>
          </div>
          <div className="rounded-xl bg-card text-card-foreground p-3">
            <div className="flex items-start gap-3">
              <MapPin className="h-5 w-5 text-muted-foreground mt-0.5" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">Hampstead Heath, London</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Meet at Parliament Hill Viewpoint
                </p>
                <div className="mt-3 h-32 w-full rounded-lg bg-muted" />
              </div>
            </div>
          </div>
        </section>

        {/* Provided */}
        <section className="mt-6">
          <h2 className="text-xs font-semibold tracking-wider text-muted-foreground uppercase mb-2">
            Provided
          </h2>
          <div className="px-1">
            <ul className="flex flex-wrap gap-2 text-xs">
              {["Water", "Energy bars", "Basic first-aid", "Spare towels"].map(
                (t) => (
                  <li
                    key={t}
                    className="px-2.5 py-1 rounded-full bg-muted text-foreground/90"
                  >
                    {t}
                  </li>
                )
              )}
            </ul>
          </div>
        </section>

        {/* House rules */}
        <section className="mt-6">
          <h2 className="text-xs font-semibold tracking-wider text-muted-foreground uppercase mb-2">
            House rules
          </h2>
          <div className="px-1">
            <ul className="space-y-2 text-sm">
              {[
                "Be respectful and on time",
                "No littering — pack out what you pack in",
                "Stay with the group on the main route",
                "Message a host if you’re running late",
              ].map((rule) => (
                <li key={rule} className="flex items-start gap-2">
                  <CheckCircle2 className="h-4 w-4 text-green-600 mt-0.5" />
                  <span>{rule}</span>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* About / Description (more detail) */}
        <section className="mt-6">
          <h2 className="text-xs font-semibold tracking-wider text-muted-foreground uppercase mb-2">
            Description
          </h2>
          <div className="px-1">
            <p className="text-sm leading-6">
              We alternate gentle and moderate routes weekly. Wear comfortable
              shoes and bring a light jacket — British weather can surprise you!
              Beginners welcome; we take regular breaks.
            </p>
          </div>
        </section>

        {/* Sticky request to join */}
        <div className="fixed bottom-[72px] left-0 right-0 z-20 px-4 pb-[env(safe-area-inset-bottom)]">
          <div className="mx-auto w-full max-w-xl flex justify-center">
            <Button
              size="lg"
              className="rounded-full"
              onClick={handleRequest}
              disabled={requesting || requested}
            >
              {requested ? (
                <span className="inline-flex items-center gap-2">
                  <CheckCircle2 className="h-5 w-5" /> Request sent
                </span>
              ) : requesting ? (
                "Sending…"
              ) : (
                <span className="inline-flex items-center gap-2">
                  <UserPlus className="h-5 w-5" /> Request to join
                </span>
              )}
            </Button>
          </div>
        </div>
      </div>
    </>
  );
}
