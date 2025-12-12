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
import { usePresence, toUiPresence } from "@/components/providers/presence-context";

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
  profileId?: string | null;
  title: string;
  subtitle: string | null;
  secondary?: string | null;
  presence?: "online" | "away" | "recent" | null;
  distanceKm?: number | null;
  nearEligible?: boolean;
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

// Age helper
function calcAge(dobStr?: string | null): number | null {
  if (!dobStr) return null;
  const dob = new Date(dobStr);
  if (isNaN(dob.getTime())) return null;
  const today = new Date();
  let age = today.getFullYear() - dob.getFullYear();
  const m = today.getMonth() - dob.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < dob.getDate())) age--;
  return age;
}

function distanceKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const sinDLat = Math.sin(dLat / 2);
  const sinDLng = Math.sin(dLng / 2);
  const h =
    sinDLat * sinDLat +
    Math.cos(lat1) * Math.cos(lat2) * sinDLng * sinDLng;
  const c = 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
  return R * c;
}

export default function ConnectionsPage() {
  const [activeFilter, setActiveFilter] =
    useState<(typeof filters)[number]>("All");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rows, setRows] = useState<ConnectionRow[]>([]);
  const [query, setQuery] = useState("");
  const { presence, currentUserId } = usePresence();
  const myCoords = useMemo(() => {
    if (!currentUserId) return null;
    const me = presence[currentUserId];
    if (
      me &&
      typeof me.lat === "number" &&
      typeof me.lng === "number"
    ) {
      return { lat: me.lat, lng: me.lng };
    }
    return null;
  }, [presence, currentUserId]);

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
      const contactProfile = contact?.profiles || null;

      const pinnedProfile = pin?.pinned_profile || null;
      const profileId =
        (row.type === "pin"
          ? pin?.pinned_profile_id ||
            pinnedProfile?.id ||
            pin?.user_id ||
            pin?.pinned_user_id ||
            pin?.profile_id
          : contact?.profile_id ||
            contactProfile?.id ||
            contact?.user_id ||
            contact?.contact_user_id ||
            contact?.contact_profile_id ||
            contact?.contact_id ||
            null) || null;

      const avatarUrl = pinnedProfile?.avatar_url
        ? getAvatarProxyUrl(pinnedProfile.avatar_url)
        : contactProfile?.avatar_url
          ? getAvatarProxyUrl(contactProfile.avatar_url)
          : null;

      const title =
        pin?.nickname ||
        contact?.display_name ||
        pinnedProfile?.profile_title ||
        contactProfile?.profile_title ||
        row.title ||
        "Connection";

      const subtitle =
        (() => {
          const baseProfile =
            row.type === "pin" ? pinnedProfile : contactProfile;
          const age = calcAge(baseProfile?.date_of_birth);
          const position = baseProfile?.position?.label || null;
          const sexuality = baseProfile?.sexuality?.label || null;
          const parts = [
            age ? `${age}` : null,
            position,
            sexuality,
          ].filter(Boolean);
          return parts.join(" • ") || "";
        })();

      const secondary =
        row.type === "contact" ? contactProfile?.profile_title || null : null;

      const fallback = title.slice(0, 2).toUpperCase();

      return {
        id: row.id,
        type: row.type as "contact" | "pin",
        profileId,
        title,
        subtitle,
        secondary,
        avatarUrl,
        presence: (() => {
          return profileId ? toUiPresence(presence[profileId] as any) : null;
        })(),
        distanceKm: (() => {
          const pid = profileId;
          const coords = pid
            ? {
                lat: presence[pid]?.lat ?? null,
                lng: presence[pid]?.lng ?? null,
              }
            : null;
          const lastSeenStr = pid ? presence[pid]?.last_seen : null;
          if (lastSeenStr) {
            const lastSeen = Date.parse(lastSeenStr);
            if (Number.isFinite(lastSeen)) {
              const diffHours = (Date.now() - lastSeen) / 36e5;
              if (diffHours > 24) return null;
            }
          }
          if (!coords || !myCoords) return null;
          return distanceKm(myCoords, coords);
        })(),
        nearEligible: (() => {
          const pid = profileId;
          const coords =
            pid && typeof presence[pid]?.lat === "number" && typeof presence[pid]?.lng === "number"
              ? { lat: presence[pid]!.lat as number, lng: presence[pid]!.lng as number }
              : null;
          const lastSeenStr = pid ? presence[pid]?.last_seen : null;
          if (!coords) return false;
          if (lastSeenStr) {
            const lastSeen = Date.parse(lastSeenStr);
            if (Number.isFinite(lastSeen)) {
              const diffHours = (Date.now() - lastSeen) / 36e5;
              if (diffHours > 24) return false;
            }
          }
          return true;
        })(),
        fallback,
      };
    });
  }, [rows, presence, myCoords]);

  const filteredConnections = useMemo(() => {
    const q = query.trim().toLowerCase();
    let list = connections;

    if (activeFilter === "Contacts") {
      list = list.filter((c) => c.type === "contact");
    } else if (activeFilter === "Pins") {
      list = list.filter((c) => c.type === "pin");
    } else if (activeFilter === "Online") {
      list = list.filter((c) => c.presence === "online");
    } else if (activeFilter === "Nearby") {
      list = list
        .filter((c) => c.nearEligible)
        .sort((a, b) => (a.distanceKm ?? Infinity) - (b.distanceKm ?? Infinity));
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
                {activeFilter === "Contacts" ? (
                  <>
                    <EmptyTitle>No contacts yet</EmptyTitle>
                    <EmptyDescription>
                      Add people you’ve exchanged details with to see them here.
                    </EmptyDescription>
                  </>
                ) : activeFilter === "Pins" ? (
                  <>
                    <EmptyTitle>No pinned profiles</EmptyTitle>
                    <EmptyDescription>
                      Pin profiles you like to keep them handy.
                    </EmptyDescription>
                  </>
                ) : activeFilter === "Online" ? (
                  <>
                    <EmptyTitle>No one online right now</EmptyTitle>
                    <EmptyDescription>
                      Check back soon or pin more profiles to grow this list.
                    </EmptyDescription>
                  </>
                ) : activeFilter === "Nearby" ? (
                  <>
                    <EmptyTitle>No nearby connections</EmptyTitle>
                    <EmptyDescription>
                      Try again later or adjust your filters.
                    </EmptyDescription>
                  </>
                ) : (
                  <>
                    <EmptyTitle>No connections yet</EmptyTitle>
                    <EmptyDescription>
                      Pin profiles you like or add contacts after exchanging details.
                    </EmptyDescription>
                  </>
                )}
              </EmptyHeader>
            </Empty>
          </div>
        ) : (
          filteredConnections.map((c) => (
            <Link
              key={c.id}
              href={
                c.type === "contact" && c.id
                  ? `/app/connections/${c.id}`
                  : c.type === "pin" && c.profileId
                    ? `/app/profile/${c.profileId}`
                    : `/app/connections/${c.id}`
              }
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
                    <span
                      className={cn(
                        "absolute -bottom-0.5 -right-0.5 z-10 block h-2.5 w-2.5 rounded-full ring ring-background transition-all duration-200",
                        c.presence
                          ? "opacity-100 scale-100"
                          : "opacity-0 scale-75",
                        c.presence === "online"
                          ? "bg-green-500"
                          : c.presence === "recent"
                            ? "bg-muted-foreground"
                            : "bg-transparent"
                      )}
                    />
                  </div>
                }
                right={
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 space-y-0.5">
                      <div className="flex items-center gap-2">
                        <p className="truncate text-base font-semibold max-w-[60vw] sm:max-w-[70vw]">
                          <span className="truncate inline-block max-w-[48vw] align-middle">
                            {c.title}
                          </span>
                          {c.secondary ? (
                            <span className="pl-2 text-sm font-normal text-muted-foreground truncate inline-block max-w-[32vw] align-middle">
                              {c.secondary}
                            </span>
                          ) : null}
                        </p>
                      </div>
                      <div className="flex flex-wrap items-center gap-1 text-sm text-muted-foreground">
                        {c.subtitle ? (
                          <span className="truncate">{c.subtitle}</span>
                        ) : null}
                      </div>
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
