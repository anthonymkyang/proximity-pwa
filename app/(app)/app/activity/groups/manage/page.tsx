import Link from "next/link";
import { createClient } from "@/utils/supabase/server";
import { Button } from "@/components/ui/button";
import {
  Item,
  ItemActions,
  ItemContent,
  ItemMedia,
  ItemTitle,
} from "@/components/ui/item";
import { Card } from "@/components/ui/card";
import {
  CalendarClock,
  Shield,
  Ellipsis,
  EllipsisVertical,
  Plus,
} from "lucide-react";
import TopBar from "@/components/nav/TopBar";
import GlassButton from "@/components/ui/header-button";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";

type GroupRow = {
  id: string;
  title: string | null;
  category_id: string | null;
  start_time: string | null;
  end_time: string | null;
  location_text: string | null;
  postcode: string | null;
  cover_image_url: string | null;
  is_public: boolean | null;
  attendee_count: number | null;
  status: string | null;
};

type CategoryRow = {
  id: string;
  name: string;
};

type Attendee = {
  id: string;
  name: string | null;
  username: string | null;
  avatar_url: string | null;
};

function initialsFrom(text?: string | null): string {
  if (!text) return "U";
  const parts = String(text).trim().split(/\s+/);
  const first = parts[0]?.[0] ?? "";
  const last = parts.length > 1 ? parts[parts.length - 1][0] ?? "" : "";
  return (first + last || first || "U").toUpperCase().slice(0, 2);
}

async function fetchAttendeesPreview(
  supabase: Awaited<ReturnType<typeof createClient>>,
  groupId: string,
  limit = 4
): Promise<Attendee[]> {
  // Try a common schema first: group_attendees { group_id, user_id, joined_at }
  const { data: joins } = await supabase
    .from("group_attendees")
    .select("user_id")
    .eq("group_id", groupId)
    .order("joined_at", { ascending: false })
    .limit(limit);

  const ids = (joins ?? []).map((j: any) => j.user_id).filter(Boolean);
  if (!ids.length) return [];

  const { data: profs } = await supabase
    .from("profiles")
    .select("id, profile_title, username, avatar_url")
    .in("id", ids);

  // Preserve order of ids
  const byId = new Map((profs ?? []).map((p: any) => [p.id, p]));
  return ids
    .map((id: string) => byId.get(id))
    .filter(Boolean)
    .map((p: any) => ({
      id: p.id,
      name: p.profile_title,
      username: p.username,
      avatar_url: p.avatar_url,
    }));
}

// --- helpers ---
function fmtWhen(start?: string | null, end?: string | null) {
  if (!start) return "—";
  const s = new Date(start);
  const e = end ? new Date(end) : null;

  const sameDay = e
    ? s.getFullYear() === e.getFullYear() &&
      s.getMonth() === e.getMonth() &&
      s.getDate() === e.getDate()
    : true;

  const d = s.toLocaleDateString(undefined, {
    day: "2-digit",
    month: "short",
  });
  const st = s
    .toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })
    .replace(":00", "");

  if (!e) return `${d}, ${st} onwards`;
  const et = e
    .toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })
    .replace(":00", "");
  if (sameDay) return `${d}, ${st} to ${et}`;
  const d2 = e.toLocaleDateString(undefined, {
    day: "2-digit",
    month: "short",
  });
  return `${d}, ${st} - ${d2} ${et}`;
}

async function resolveCoverUrl(
  supabase: Awaited<ReturnType<typeof createClient>>,
  raw: string | null
): Promise<string | null> {
  try {
    if (!raw || typeof raw !== "string") return null;

    // If DB already stores a full URL, use it as-is.
    if (/^https?:\/\//i.test(raw)) return raw;

    // We store storage *paths* like "covers/<file>.jpg" in the "group-media" bucket.
    const bucket = "group-media";

    // Normalise path: strip any leading slashes and any accidental "<bucket>/" prefix.
    let path = raw.replace(/^\/+/, "");
    if (path.toLowerCase().startsWith(`${bucket}/`)) {
      path = path.slice(bucket.length + 1);
    }

    // Prefer a signed URL as it works regardless of bucket public/private settings.
    const { data: signed, error: signErr } = await supabase.storage
      .from(bucket)
      .createSignedUrl(path, 60 * 60 * 24 * 30); // 30 days

    if (!signErr && signed?.signedUrl) {
      return signed.signedUrl;
    }

    // Fallback to public URL if signing failed but bucket is public.
    const { data: pub } = supabase.storage.from(bucket).getPublicUrl(path);
    if (pub?.publicUrl) {
      return pub.publicUrl;
    }

    return null;
  } catch (e) {
    console.error("[groups/manage] resolveCoverUrl error", e);
    return null;
  }
}

export default async function ManageGroupsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  async function publishAction(formData: FormData) {
    "use server";
    const id = String(formData.get("id") || "");
    if (!id) return;
    const supa = await createClient();
    await supa.from("groups").update({ status: "active" }).eq("id", id);
  }

  if (!user) {
    // Lightweight gate
    return (
      <div className="mx-auto w-full max-w-xl px-4 pb-[calc(72px+env(safe-area-inset-bottom))]">
        <h1 className="px-1 pb-2 text-4xl font-extrabold tracking-tight">
          Manage groups
        </h1>
        <Card className="p-4">
          <p className="text-sm text-muted-foreground">
            You need to sign in to view and manage your groups.
          </p>
        </Card>
      </div>
    );
  }

  const { data: rows, error } = await supabase
    .from("groups")
    .select(
      "id, title, category_id, start_time, end_time, location_text, postcode, cover_image_url, is_public, attendee_count, status"
    )
    .eq("host_id", user.id)
    .is("deleted_at", null)
    .order("updated_at", { ascending: false })
    .returns<GroupRow[]>();

  const { data: categories } = await supabase
    .from("group_categories")
    .select("id, name")
    .returns<CategoryRow[]>();

  const catMap = new Map<string, string>(
    (categories ?? []).map((c: CategoryRow) => [c.id, c.name])
  );

  const groups = await Promise.all(
    (rows ?? []).map(async (g: GroupRow) => {
      const coverUrl = await resolveCoverUrl(supabase, g.cover_image_url);
      // Server-side log to show the raw DB value and the final resolved URL for each group
      console.log("[groups/manage] cover resolved", {
        id: g.id,
        raw: g.cover_image_url,
        resolved: coverUrl,
      });
      const attendees = await fetchAttendeesPreview(supabase, g.id, 4);
      const shown = attendees.length;
      const extra = Math.max(0, (g.attendee_count ?? 0) - shown);

      return {
        ...g,
        category_name: g.category_id ? catMap.get(g.category_id) ?? null : null,
        coverUrl,
        attendeesPreview: attendees,
        attendeesExtra: extra,
      } as GroupRow & {
        category_name: string | null;
        coverUrl: string | null;
        attendeesPreview: Attendee[];
        attendeesExtra: number;
      };
    })
  );

  return (
    <div className="mx-auto w-full max-w-xl px-4 pb-[calc(72px+env(safe-area-inset-bottom))]">
      <TopBar>
        <div className="flex items-center justify-between w-full">
          <GlassButton ariaLabel="More options">
            <Ellipsis className="h-5 w-5 text-white" />
          </GlassButton>
          <Link href="/app/activity/groups/create">
            <Button className="h-8 w-8 rounded-full p-0" size="sm">
              <Plus className="h-5 w-5" />
            </Button>
          </Link>
        </div>
      </TopBar>

      <div className="mt-4">
        <h1 className="px-1 pb-1 text-4xl font-extrabold tracking-tight">
          Manage groups
        </h1>
        <h2 className="px-1 pb-2 text-lg font-medium text-muted-foreground">
          Your groups
        </h2>
      </div>

      {!error && groups.length === 0 ? (
        <Card className="p-6">
          <p className="text-base font-semibold">You have no groups yet</p>
          <p className="text-sm text-muted-foreground mt-1">
            Create your first group and manage it here.
          </p>
          <Link href="/app/activity/groups/create">
            <Button className="mt-4">Create a group</Button>
          </Link>
        </Card>
      ) : null}

      <div className="space-y-3">
        {groups.map((g) => (
          <Item key={g.id} className="bg-card">
            <ItemMedia>
              {g.coverUrl && g.coverUrl.trim() !== "" ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={g.coverUrl}
                  alt={`${g.title || "Group"} cover`}
                  className="h-12 w-12 rounded-md object-cover"
                  loading="lazy"
                />
              ) : (
                <div className="h-12 w-12 rounded-md bg-muted grid place-items-center">
                  <Shield className="h-5 w-5 text-muted-foreground" />
                </div>
              )}
            </ItemMedia>
            <ItemContent>
              <ItemTitle className="flex items-center gap-2">
                <span className="truncate">{g.title || "Untitled"}</span>
              </ItemTitle>

              {/* Details block below kept out of ItemDescription to avoid div-in-p hydration issues */}
              <div className="text-sm text-muted-foreground">
                <div className="flex flex-col gap-1">
                  <div className="flex items-center gap-2">
                    <CalendarClock className="h-4 w-4 text-muted-foreground" />
                    <span>
                      {fmtWhen(g.start_time as any, g.end_time as any)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Attendees preview */}
              {g.attendeesPreview && g.attendeesPreview.length ? (
                <div className="mt-2 flex justify-end">
                  <div className="flex -space-x-2">
                    {g.attendeesPreview.map((a) => {
                      const raw = a.avatar_url;
                      const isUrl =
                        typeof raw === "string" && /^https?:\/\//i.test(raw);
                      // For storage keys like "avatars/userid/file.jpg", rely on public bucket config
                      // If your bucket is private, swap to signed URLs similar to resolveCoverUrl.
                      const src = isUrl
                        ? raw
                        : raw
                        ? `/api/storage/public/${encodeURIComponent(raw)}`
                        : null;
                      const name = a.name || a.username || "User";
                      const fallback = initialsFrom(name);

                      return (
                        <Avatar
                          key={a.id}
                          className="ring-2 ring-background h-6 w-6"
                        >
                          {src ? <AvatarImage src={src} alt={name} /> : null}
                          <AvatarFallback className="text-[10px]">
                            {fallback}
                          </AvatarFallback>
                        </Avatar>
                      );
                    })}
                    {g.attendeesExtra > 0 ? (
                      <Avatar className="ring-2 ring-background h-6 w-6">
                        <AvatarFallback className="text-[10px]">
                          +{g.attendeesExtra}
                        </AvatarFallback>
                      </Avatar>
                    ) : null}
                  </div>
                </div>
              ) : null}
            </ItemContent>
            <ItemActions>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    size="icon"
                    className="rounded-full h-8 w-8 p-0"
                    variant="outline"
                    aria-label="Open menu"
                  >
                    <EllipsisVertical className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  align="end"
                  sideOffset={8}
                  className="min-w-40"
                >
                  <DropdownMenuItem asChild>
                    <Link href={`/app/activity/groups/create?id=${g.id}`}>
                      Edit
                    </Link>
                  </DropdownMenuItem>
                  {g.status !== "active" ? (
                    <form action={publishAction}>
                      <input type="hidden" name="id" value={g.id} />
                      <DropdownMenuItem asChild>
                        <button type="submit">Publish</button>
                      </DropdownMenuItem>
                    </form>
                  ) : null}
                  <DropdownMenuItem asChild>
                    <Link href={`/app/activity/groups/${g.id}`}>View</Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    asChild
                    className="text-destructive focus:text-destructive"
                  >
                    <Link href={`/app/activity/groups/manage`}>Cancel</Link>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </ItemActions>
          </Item>
        ))}
      </div>
    </div>
  );
}
