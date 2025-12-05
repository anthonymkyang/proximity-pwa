"use client";

import React, { useState } from "react";
import Link from "next/link";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
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
import { Badge } from "@/components/ui/badge";
import { Search } from "lucide-react";

// --- Mock data ---
const filters = ["All", "Nearby", "Online", "New"] as const;

type Connection = {
  id: string;
  name: string;
  fallback: string;
  tagline: string; // e.g. distance / status
  online?: boolean;
  unreadCount?: number;
  presence?: "online" | "away" | "recent" | null;
};

// Reusable row layout similar to Messages list
function ListItemRow({
  left,
  right,
  className = "",
}: {
  left: React.ReactNode;
  right: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`relative flex items-center gap-3 -mr-4 ${className}`}>
      <div className="relative h-12 w-12 grid place-items-center">{left}</div>
      <div className="min-w-0 flex-1 border-b border-b-muted py-3 pr-4">
        {right}
      </div>
    </div>
  );
}

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
  const [selectMode] = useState(false); // selection UI removed to mirror messages styling

  return (
    <>
      <div className="flex items-center gap-2 pb-2">
        <h1 className="flex-1 px-1 text-4xl font-extrabold tracking-tight">
          Connections
        </h1>
        {/* Actions moved to TopBar; leave space for layout if needed */}
      </div>

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

      {/* Connections list styled like Messages */}
      <div className="-mx-4">
        {connections.map((c) => (
          <Link
            key={c.id}
            href={`/app/connections/${c.id}`}
            className="block px-4"
          >
            <ListItemRow
              left={
                <div className="relative h-12 w-12">
                  <Avatar className="h-12 w-12">
                    <AvatarImage
                      src={undefined as unknown as string}
                      alt={c.name}
                    />
                    <AvatarFallback>{c.fallback}</AvatarFallback>
                  </Avatar>
                  {c.presence === "online" && (
                    <span className="absolute top-0 left-0 z-10 block h-2.5 w-2.5 rounded-full bg-green-500 ring ring-background" />
                  )}
                  {c.presence === "recent" && (
                    <span className="absolute top-0 left-0 z-10 block h-2.5 w-2.5 rounded-full bg-muted-foreground ring ring-background" />
                  )}
                </div>
              }
              right={
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 space-y-0.5">
                    <div className="flex items-center gap-2">
                      <p className="truncate text-base font-semibold">
                        {c.name}
                      </p>
                      {c.unreadCount && c.unreadCount > 0 ? (
                        <Badge variant="secondary" className="shrink-0">
                          {c.unreadCount}
                        </Badge>
                      ) : null}
                    </div>
                    <p className="truncate text-sm text-muted-foreground">
                      {c.tagline}
                    </p>
                  </div>
                  <div className="shrink-0 text-xs text-muted-foreground">
                    {c.tagline.split("•")[0]}
                  </div>
                </div>
              }
            />
          </Link>
        ))}
      </div>
    </>
  );
}
