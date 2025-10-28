"use client";

import React, { useState } from "react";
import Link from "next/link";
import TopBar from "@/components/nav/TopBar";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Checkbox } from "@/components/ui/checkbox";
import { Search, Sparkles, UserPlus, MoreHorizontal } from "lucide-react";

// --- Mock data ---
const filters = ["All", "Nearby", "Online", "New"] as const;

type Connection = {
  id: string;
  name: string;
  fallback: string;
  tagline: string; // e.g. distance / status
  online?: boolean;
};

const connections: Connection[] = [
  {
    id: "c1",
    name: "Masc4Masc",
    fallback: "M4",
    tagline: "0.4 km • online",
    online: true,
  },
  {
    id: "c2",
    name: "Pump n Dump St Giles",
    fallback: "PD",
    tagline: "1.3 km • recently",
  },
  {
    id: "c3",
    name: "DL Neighbor",
    fallback: "DL",
    tagline: "500 m • online",
    online: true,
  },
  { id: "c4", name: "PupMax", fallback: "PM", tagline: "2.1 km • today" },
  { id: "c5", name: "TopDad", fallback: "TD", tagline: "3.8 km • this week" },
  {
    id: "c6",
    name: "VersInVauxhall",
    fallback: "VV",
    tagline: "0.9 km • recently",
  },
  {
    id: "c7",
    name: "SpiceBoy",
    fallback: "SB",
    tagline: "1.7 km • online",
    online: true,
  },
];

export default function ConnectionsPage() {
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
                onSelect={(e: any) => {
                  e.preventDefault();
                  setSelectMode(true);
                  setSelected({});
                }}
              >
                Select profiles
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
              aria-label="Add connection"
            >
              <UserPlus className="h-5 w-5" />
            </Button>
          </>
        }
      >
        {/* Title under top bar */}
        <h1 className="px-1 pb-2 text-4xl font-extrabold tracking-tight">
          Connections
        </h1>

        {/* Search */}
        <div className="pb-5">
          <InputGroup>
            <InputGroupInput placeholder="Search connections" />
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

      {/* List header separator */}
      <Separator className="-mx-4" />

      {/* Connections list */}
      <ul className="divide-y -mx-4">
        {connections.map((c) => (
          <li key={c.id}>
            <Link
              href={`/app/connections/${c.id}`}
              className={`relative flex items-center gap-3 py-3 px-4 ${
                selectMode ? "pl-14" : ""
              }`}
            >
              {selectMode && (
                <div className="absolute left-4 top-1/2 -translate-y-1/2 z-10">
                  <Checkbox
                    checked={!!selected[c.id]}
                    onCheckedChange={(v: any) =>
                      setSelected((s) => ({ ...s, [c.id]: !!v }))
                    }
                    className="rounded-full"
                    aria-label={`Select ${c.name}`}
                  />
                </div>
              )}

              <div className="relative h-12 w-12">
                <Avatar className="h-12 w-12">
                  <AvatarImage
                    src={undefined as unknown as string}
                    alt={c.name}
                  />
                  <AvatarFallback>{c.fallback}</AvatarFallback>
                </Avatar>
                {c.online && (
                  <span className="absolute top-0 left-0 z-10 block h-2.5 w-2.5 rounded-full bg-green-500 ring ring-background" />
                )}
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex items-baseline justify-between gap-3">
                  <p className="truncate text-base font-semibold">{c.name}</p>
                  <div className="shrink-0 text-xs text-muted-foreground">
                    {c.tagline.split("•")[0]}
                  </div>
                </div>
                <p className="mt-0.5 truncate text-sm text-muted-foreground">
                  {c.tagline}
                </p>
              </div>
            </Link>
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
                    "bulk connect",
                    Object.keys(selected).filter((k) => selected[k])
                  );
                  setSelectMode(false);
                  setSelected({});
                }}
              >
                Connect
              </Button>
              <Button
                variant="destructive"
                onClick={() => {
                  console.log(
                    "bulk remove",
                    Object.keys(selected).filter((k) => selected[k])
                  );
                  setSelectMode(false);
                  setSelected({});
                }}
              >
                Remove
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
