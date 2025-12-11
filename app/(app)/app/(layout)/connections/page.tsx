"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group";
import { Skeleton } from "@/components/ui/skeleton";
import { Search, Plus } from "lucide-react";
import getAvatarProxyUrl from "@/lib/profiles/getAvatarProxyUrl";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Users } from "lucide-react";

const filters = ["All", "Contacts", "Pins", "Online", "Nearby", "+ Add"] as const;

type ConnectionRow = {
  id: string;
  type: "contact" | "pin";
  title: string;
  note?: string | null;
  connection_contacts?: any;
  connection_pins?: any;
  updated_at?: string | null;
};

type UIConnection = {
  id: string;
  type: "contact" | "pin";
  title: string;
  subtitle: string | null;
  presence?: "online" | "away" | "recent" | null;
  avatarUrl?: string | null;
  fallback: string;
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

export default function ConnectionsPage() {
  const [activeFilter, setActiveFilter] =
    useState<(typeof filters)[number]>("All");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rows, setRows] = useState<ConnectionRow[]>([]);
  const [query, setQuery] = useState("");

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);

    fetch("/api/connections")
      .then(async (res) => {
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body?.error || "Failed to load connections");
        }
        return res.json();
      })
      .then((body) => {
        if (!active) return;
        setRows(body?.connections || []);
      })
      .catch((err) => {
        if (!active) return;
        setError(err.message || "Failed to load connections");
      })
      .finally(() => active && setLoading(false));

    return () => {
      active = false;
    };
  }, []);

  const connections: UIConnection[] = useMemo(() => {
    return (rows || []).map((row) => {
      const contact = Array.isArray(row.connection_contacts)
        ? row.connection_contacts[0]
        : row.connection_contacts;
      const pin = Array.isArray(row.connection_pins)
        ? row.connection_pins[0]
        : row.connection_pins;

      const pinnedProfile = pin?.pinned_profile || null;
      const avatarUrl = pinnedProfile?.avatar_url
        ? getAvatarProxyUrl(pinnedProfile.avatar_url)
        : null;

      const title =
        pin?.nickname ||
        pinnedProfile?.profile_title ||
        contact?.display_name ||
        row.title ||
        "Connection";

      const subtitle =
        row.type === "pin"
          ? pinnedProfile?.username
            ? `Pinned • @${pinnedProfile.username}`
            : "Pinned profile"
          : contact?.handle
            ? `Contact • ${contact.handle}`
            : contact?.email
              ? `Contact • ${contact.email}`
              : "Contact";

      const fallback = title.slice(0, 2).toUpperCase();

      return {
        id: row.id,
        type: row.type as "contact" | "pin",
        title,
        subtitle,
        avatarUrl,
        presence: null,
        fallback,
      };
    });
  }, [rows]);

  const filteredConnections = useMemo(() => {
    const q = query.trim().toLowerCase();
    let list = connections;

    if (activeFilter === "Contacts") {
      list = list.filter((c) => c.type === "contact");
    } else if (activeFilter === "Pins") {
      list = list.filter((c) => c.type === "pin");
    }

    if (!q) return list;
    return list.filter(
      (c) =>
        c.title.toLowerCase().includes(q) ||
        (c.subtitle || "").toLowerCase().includes(q)
    );
  }, [connections, query, activeFilter]);

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
          <InputGroupInput
            placeholder="Search connections"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <InputGroupAddon>
            <Search className="h-4 w-4 text-muted-foreground" />
          </InputGroupAddon>
        </InputGroup>
      </div>

      {/* Filter chips */}
      <div className="flex gap-2 overflow-x-auto pb-3 -mx-4 px-4 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
        {filters.map((f) => {
          const isAdd = f === "+ Add";
          const isAll = f === "All";
          const isActive = activeFilter === f;
          return (
            <Button
              key={f}
              size="sm"
              variant={isActive ? "default" : "outline"}
              className={cn(
                "rounded-full",
                isActive && "border border-primary",
                isAll && "border-primary"
              )}
              onClick={() => setActiveFilter(f)}
            >
              {isAdd ? (
                <span className="flex items-center gap-1">
                  <Plus className="h-3.5 w-3.5" />
                  Add
                </span>
              ) : (
                f
              )}
            </Button>
          );
        })}
      </div>

      {/* Connections list styled like Messages */}
      <div className="-mx-4">
        {loading ? (
          <div className="space-y-3 px-4">
            {[...Array(4)].map((_, idx) => (
              <div key={idx} className="flex items-center gap-3">
                <Skeleton className="h-12 w-12 rounded-full" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-3 w-24" />
                </div>
              </div>
            ))}
          </div>
        ) : error ? (
          <div className="px-4 text-sm text-muted-foreground">{error}</div>
        ) : filteredConnections.length === 0 ? (
          <div className="pt-8">
            <Empty>
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <Users className="h-6 w-6" />
                </EmptyMedia>
                <EmptyTitle>No connections yet</EmptyTitle>
                <EmptyDescription>
                  Pin profiles you like or add contacts after exchanging details.
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          </div>
        ) : (
          filteredConnections.map((c) => (
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
                        src={c.avatarUrl || (undefined as unknown as string)}
                        alt={c.title}
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
                          {c.title}
                        </p>
                      </div>
                      <p className="truncate text-sm text-muted-foreground">
                        {c.subtitle ?? ""}
                      </p>
                    </div>
                  </div>
                }
              />
            </Link>
          ))
        )}
      </div>
    </>
  );
}
