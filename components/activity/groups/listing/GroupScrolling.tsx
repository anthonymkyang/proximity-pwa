"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";

type MyGroupCard = {
  id: string;
  title: string;
  name?: string;
  nextDate: string | null;
  cover_image_url?: string | null;
  host_id?: string | null;
  hostProfile?: {
    name: string | null;
    avatar_url: string | null;
  } | null;
  categoryName?: string | null;
};

interface GroupScrollingProps {
  groups: MyGroupCard[];
  avatarStacks?: Record<
    string,
    {
      avatars: { src?: string; name?: string; fallback?: string }[];
      extra: number;
    }
  >;
}

function resolveAvatarUrl(path?: string | null): string | undefined {
  if (!path) return undefined;
  const s = String(path);
  if (s.startsWith("http://") || s.startsWith("https://")) return s;
  return `/api/photos/avatars?path=${encodeURIComponent(s)}`;
}

function resolveGroupUrl(path?: string | null): string | undefined {
  if (!path) return undefined;
  const s = String(path);
  if (s.startsWith("http://") || s.startsWith("https://")) return s;
  return `/api/groups/storage?path=${encodeURIComponent(s.replace(/^\//, ""))}`;
}

function formatDateShort(dateStr?: string | null): string {
  if (!dateStr) return "Date TBC";
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return "Date TBC";
  return d.toLocaleDateString(undefined, {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

function formatTime(dateStr?: string | null): string {
  if (!dateStr) return "TBD";
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return "TBD";
  let h = d.getHours();
  const m = d.getMinutes();
  const ampm = h >= 12 ? "pm" : "am";
  h = h % 12;
  if (h === 0) h = 12;
  if (m === 0) return `${h}${ampm}`;
  return `${h}:${String(m).padStart(2, "0")}${ampm}`;
}

const CATEGORY_BADGE_COLORS: Record<string, string> = {
  social: "bg-sky-200 text-sky-900",
  sports: "bg-emerald-200 text-emerald-900",
  food: "bg-amber-200 text-amber-900",
  arts: "bg-violet-200 text-violet-900",
  gaming: "bg-fuchsia-200 text-fuchsia-900",
  learning: "bg-indigo-200 text-indigo-900",
};

function getCategoryBadgeClass(name?: string | null) {
  if (!name) return "bg-muted text-muted-foreground";
  const key = String(name).toLowerCase().replace(/\s+/g, "");
  return CATEGORY_BADGE_COLORS[key] || "bg-muted text-muted-foreground";
}

export function GroupScrolling({ groups, avatarStacks }: GroupScrollingProps) {
  const router = useRouter();

  return (
    <div className="-mx-4 flex gap-3 overflow-x-auto px-4 pb-2 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]{display:none;}">
      {groups.map((group) => {
        const groupName = group.title || group.name;
        const dateStr = group.nextDate;
        const coverUrl = resolveGroupUrl(group.cover_image_url);

        return (
          <div
            key={group.id}
            className="min-w-[60vw] max-w-[520px] rounded-xl sm:min-w-[380px] cursor-pointer"
            onClick={() => router.push(`/app/groups/${group.id}`)}
          >
            <div className="relative mb-3 aspect-14/9 w-full overflow-hidden rounded-xl bg-card/60">
              {coverUrl && (
                <img
                  src={coverUrl}
                  alt={groupName}
                  className="h-full w-full object-cover"
                  onError={(e) => {
                    (e.currentTarget as HTMLImageElement).style.display =
                      "none";
                  }}
                />
              )}
              <div className="absolute left-3 bottom-3">
                <Avatar className="size-12 border-2 border-background shadow-lg drop-shadow-lg">
                  {group.hostProfile?.avatar_url && (
                    <AvatarImage
                      src={resolveAvatarUrl(group.hostProfile.avatar_url)}
                      alt={group.hostProfile.name || groupName}
                    />
                  )}
                  <AvatarFallback className="text-[12px] font-semibold">
                    {(group.hostProfile?.name || groupName)
                      ?.slice(0, 2)
                      .toUpperCase()}
                  </AvatarFallback>
                </Avatar>
              </div>
            </div>
            <div className="relative px-1">
              <div className="text-sm font-semibold text-foreground pr-14 truncate">
                {groupName}
              </div>
              {group.categoryName && (
                <div className="mt-0.5 pr-14">
                  <Badge
                    className={`px-2 py-0.5 text-[10px] rounded-full ${getCategoryBadgeClass(
                      group.categoryName
                    )}`}
                  >
                    {group.categoryName}
                  </Badge>
                </div>
              )}
              <div className="mt-1 text-xs text-muted-foreground pr-14">
                {formatDateShort(dateStr)} · {formatTime(dateStr)}
              </div>
              {avatarStacks &&
              avatarStacks[group.id] &&
              avatarStacks[group.id].avatars.length > 0 ? (
                <div className="absolute right-1 top-1/2 -translate-y-1/2 flex -space-x-2">
                  {avatarStacks[group.id].avatars.map((a, idx) => (
                    <Avatar
                      key={`${group.id}-av-${idx}`}
                      className="h-7 w-7 ring-2 ring-background"
                    >
                      {a.src ? (
                        <img
                          src={a.src}
                          alt={a.name || "User"}
                          className="h-full w-full object-cover rounded-full"
                        />
                      ) : null}
                      {!a.src ? (
                        <AvatarFallback className="text-[10px]">
                          {a.fallback || ""}
                        </AvatarFallback>
                      ) : null}
                    </Avatar>
                  ))}
                  {avatarStacks[group.id].extra > 0 && (
                    <Avatar className="h-7 w-7 ring-2 ring-background">
                      <AvatarFallback className="text-[10px]">
                        +{avatarStacks[group.id].extra}
                      </AvatarFallback>
                    </Avatar>
                  )}
                </div>
              ) : null}
            </div>
          </div>
        );
      })}
    </div>
  );
}
