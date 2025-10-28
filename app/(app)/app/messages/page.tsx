"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Search,
  Sparkles,
  Plus,
  MoreHorizontal,
  Pin,
  CheckCheck,
  Archive,
  Ghost,
  Trash2,
  User,
} from "lucide-react";
import {
  InputGroup,
  InputGroupInput,
  InputGroupAddon,
} from "@/components/ui/input-group";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import TopBar from "@/components/nav/TopBar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Checkbox } from "@/components/ui/checkbox";

// --- Mock data ---
const filters = ["All", "Unread", "Favourites", "Groups", "Cruising"] as const;

type Conversation = {
  id: string;
  name: string;
  avatar?: string;
  fallback: string;
  lastMessage: string;
  time: string; // e.g. "15:54" or "Saturday"
  unread?: boolean;
  pinned?: boolean;
  service?: string; // e.g. "(Sniffies)", "(Grindr)"
  seenChecks?: boolean; // double-checks icon
};

const conversations: Conversation[] = [
  {
    id: "1",
    name: "Masc4Masc",
    fallback: "M4",
    lastMessage: "You host? 5 mins away",
    time: "15:54",
    pinned: true,
  },
  {
    id: "2",
    name: "Pump n Dump St Giles",
    fallback: "PD",
    lastMessage: "Leg day done ✅ shower then?",
    time: "17:51",
    pinned: true,
  },
  {
    id: "3",
    name: "DL Neighbor",
    service: "(Grindr)",
    fallback: "DL",
    lastMessage: "Totally down. No pics here tho",
    time: "22:32",
    seenChecks: true,
  },
  {
    id: "4",
    name: "PupMax",
    service: "(Sniffies)",
    fallback: "PM",
    lastMessage: "mask on or off? 😈",
    time: "19:16",
  },
  {
    id: "5",
    name: "TopDad",
    service: "(Sniffies)",
    fallback: "TD",
    lastMessage: 'Reacted ❤️ to "Not bad thanks!"',
    time: "12:04",
  },
  {
    id: "6",
    name: "VersInVauxhall",
    service: "(Sniffies)",
    fallback: "VV",
    lastMessage: "that sauna was 🔥 when are you free",
    time: "Saturday",
  },
  {
    id: "7",
    name: "SpiceBoy",
    service: "(Sniffies)",
    fallback: "SB",
    lastMessage: "yep swing by, door’s open",
    time: "Friday",
  },
];

function SwipeableRow({
  children,
  onArchive,
  onDelete,
  onContact,
  disabled,
}: {
  children: React.ReactNode;
  onArchive?: () => void;
  onDelete?: () => void;
  onContact?: () => void;
  disabled?: boolean;
}) {
  const [offset, setOffset] = useState(0);
  const [startX, setStartX] = useState<number | null>(null);
  const [openSide, setOpenSide] = useState<"left" | "right" | null>(null);
  const MAX_LEFT = 128; // reveal Archive/Delete on the right (drag left)
  const MAX_RIGHT = 88; // reveal Contact on the left (drag right)
  const THRESHOLD = 56;

  function handlePointerDown(e: React.PointerEvent) {
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    setStartX(e.clientX);
  }

  function handlePointerMove(e: React.PointerEvent) {
    if (startX == null) return;
    const dx = e.clientX - startX;
    // when already open, bias starting position
    const base =
      openSide === "left" ? MAX_RIGHT : openSide === "right" ? -MAX_LEFT : 0;
    const next = Math.max(-MAX_LEFT, Math.min(MAX_RIGHT, base + dx));
    setOffset(next);
  }

  function handlePointerUp() {
    if (startX == null) return;
    // decide which side to open/close
    let side: "left" | "right" | null = null;
    if (offset >= THRESHOLD) side = "left"; // dragged right -> contact
    if (offset <= -THRESHOLD) side = "right"; // dragged left -> archive/delete

    setOpenSide(side);
    if (side === "left") setOffset(MAX_RIGHT);
    else if (side === "right") setOffset(-MAX_LEFT);
    else setOffset(0);
    setStartX(null);
  }

  function closeIfOpen() {
    if (openSide) {
      setOpenSide(null);
      setOffset(0);
    }
  }

  return (
    <div className="relative touch-pan-y select-none">
      {/* Left action (Contact) */}
      <div className="absolute inset-y-0 left-0 flex items-center pl-3 pr-2">
        <Button
          variant="outline"
          size="icon"
          className="rounded-full"
          onClick={(e) => {
            e.preventDefault();
            onContact?.();
            closeIfOpen();
          }}
          aria-label="Open contact"
        >
          <User className="h-4 w-4" />
        </Button>
      </div>

      {/* Right actions (Archive/Delete) */}
      <div className="absolute inset-y-0 right-0 flex items-center gap-2 pr-2 pl-4">
        <Button
          variant="outline"
          size="icon"
          className="rounded-full"
          onClick={(e) => {
            e.preventDefault();
            onArchive?.();
            closeIfOpen();
          }}
          aria-label="Archive"
        >
          <Archive className="h-4 w-4" />
        </Button>
        <Button
          variant="destructive"
          size="icon"
          className="rounded-full"
          onClick={(e) => {
            e.preventDefault();
            onDelete?.();
            closeIfOpen();
          }}
          aria-label="Delete"
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>

      {/* Foreground row */}
      <div
        role={!disabled ? "button" : undefined}
        onPointerDown={disabled ? undefined : handlePointerDown}
        onPointerMove={disabled ? undefined : handlePointerMove}
        onPointerUp={disabled ? undefined : handlePointerUp}
        onPointerCancel={disabled ? undefined : handlePointerUp}
        style={{
          transform: !disabled ? `translateX(${offset}px)` : undefined,
          transition: startX && !disabled ? "none" : "transform 200ms ease",
        }}
        className="bg-background"
      >
        {children}
      </div>
    </div>
  );
}

export default function MessagesPage() {
  const [activeFilter, setActiveFilter] =
    useState<(typeof filters)[number]>("All");
  const [selectMode, setSelectMode] = useState(false);
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const selectedCount = Object.values(selected).filter(Boolean).length;

  return (
    <div className="mx-auto w-full max-w-xl px-4 pb-[calc(72px+env(safe-area-inset-bottom))]">
      {/* Top bar */}
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
              <DropdownMenuItem
                onSelect={(e) => {
                  e.preventDefault();
                  setSelectMode(true);
                  setSelected({});
                }}
              >
                Select conversations
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        }
        rightContent={
          <>
            <Button variant="ghost" size="icon" aria-label="Sparkles">
              <Sparkles className="h-5 w-5" />
            </Button>
            <Button
              variant="default"
              size="icon"
              className="rounded-full"
              aria-label="New chat"
            >
              <Plus className="h-5 w-5" />
            </Button>
          </>
        }
      >
        {/* Title under top bar */}
        <h1 className="px-1 pb-2 text-4xl font-extrabold tracking-tight">
          Messages
        </h1>

        {/* Search */}
        <div className="pb-5">
          <InputGroup>
            <InputGroupInput placeholder="Ask or search messages" />
            <InputGroupAddon>
              <Search className="h-4 w-4 text-muted-foreground" />
            </InputGroupAddon>
          </InputGroup>
        </div>

        {/* Filter chips */}
        <div className="flex gap-2 overflow-x-auto pb-3 -mx-4 px-4 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
          {filters.map((f) => (
            <Button
              key={f}
              size="sm"
              variant={activeFilter === f ? "default" : "outline"}
              className="rounded-full"
              onClick={() => setActiveFilter(f)}
            >
              {f}
            </Button>
          ))}
        </div>
      </TopBar>

      {/* Archived row */}
      <button className="flex w-full items-center gap-3 py-3 text-left">
        <Archive className="h-5 w-5 text-muted-foreground" />
        <span className="text-muted-foreground">Archived</span>
      </button>

      {/* Conversation list */}
      <ul className="divide-y -mx-4 border-t">
        {conversations.map((c) => (
          <li key={c.id}>
            <SwipeableRow
              onArchive={() => console.log("archive", c.id)}
              onDelete={() => console.log("delete", c.id)}
              onContact={() => console.log("contact", c.id)}
              disabled={selectMode}
            >
              <Link
                href={`/app/messages/${c.id}`}
                className={`relative flex items-center gap-3 py-3 px-4 ${
                  selectMode ? "pl-14" : ""
                }`}
              >
                {selectMode && (
                  <div className="absolute left-4 top-1/2 -translate-y-1/2 z-10">
                    <Checkbox
                      checked={!!selected[c.id]}
                      onCheckedChange={(v) =>
                        setSelected((s) => ({ ...s, [c.id]: !!v }))
                      }
                      className="rounded-full"
                      aria-label={`Select ${c.name}`}
                    />
                  </div>
                )}
                <div className="relative h-12 w-12">
                  <Avatar
                    className={`h-12 w-12 ${
                      c.name === "DL Neighbor" ? "ring-2 ring-blue-500" : ""
                    }`}
                  >
                    <AvatarImage src={c.avatar} alt={c.name} />
                    <AvatarFallback>{c.fallback}</AvatarFallback>
                  </Avatar>

                  {/* PupMax ghost badge */}
                  {c.name === "PupMax" && (
                    <div className="absolute -bottom-1 -right-1 z-10 bg-background rounded-full p-0.5 shadow-sm">
                      <Ghost className="h-3.5 w-3.5 text-muted-foreground" />
                    </div>
                  )}

                  {/* Online status dot */}
                  {(c.name === "Masc4Masc" ||
                    c.name === "Pump n Dump St Giles") && (
                    <span className="absolute top-0 left-0 z-10 block h-2.5 w-2.5 rounded-full bg-green-500 ring ring-background" />
                  )}

                  {/* Pump n Dump St Giles overlay mini avatar */}
                  {c.name === "Pump n Dump St Giles" && (
                    <Avatar className="absolute -bottom-1 -right-1 z-10 h-7 w-7 ring-2 ring-background">
                      {/* If you have a secondary image, put it here */}
                      <AvatarImage
                        src={undefined as unknown as string}
                        alt="GB alt"
                      />
                      <AvatarFallback className="text-[10px]">
                        GB
                      </AvatarFallback>
                    </Avatar>
                  )}
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-3">
                    <p className="truncate text-base font-semibold">
                      {c.name}{" "}
                      {c.service && (
                        <span className="font-normal text-muted-foreground">
                          {c.service}
                        </span>
                      )}
                    </p>
                    <div className="shrink-0 text-xs text-muted-foreground flex items-center gap-1">
                      {c.pinned && <Pin className="h-3.5 w-3.5" />}
                      <span>{c.time}</span>
                    </div>
                  </div>
                  <div className="mt-0.5 flex items-center gap-1 text-sm text-muted-foreground">
                    {c.seenChecks && <CheckCheck className="h-4 w-4" />}
                    <p className="truncate">{c.lastMessage}</p>
                  </div>
                </div>
              </Link>
            </SwipeableRow>
          </li>
        ))}
      </ul>

      {selectMode && (
        <div className="fixed left-0 right-0 bottom-[calc(56px+env(safe-area-inset-bottom))] z-30 border-t bg-card text-card-foreground">
          <div className="mx-auto flex max-w-xl items-center justify-between gap-3 px-4 py-2">
            <div className="text-sm text-muted-foreground">
              {selectedCount} selected
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  console.log(
                    "bulk archive",
                    Object.keys(selected).filter((k) => selected[k])
                  );
                  setSelectMode(false);
                  setSelected({});
                }}
              >
                Archive
              </Button>
              <Button
                variant="destructive"
                onClick={() => {
                  console.log(
                    "bulk delete",
                    Object.keys(selected).filter((k) => selected[k])
                  );
                  setSelectMode(false);
                  setSelected({});
                }}
              >
                Delete
              </Button>
              <Button
                variant="ghost"
                onClick={() => {
                  setSelectMode(false);
                  setSelected({});
                }}
              >
                Cancel
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
