"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldGroup,
  FieldLabel,
  FieldSet,
  FieldTitle,
} from "@/components/ui/field";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { createClient } from "@/utils/supabase/client";
import { Loader2, CheckCircle2, XCircle, MapPin } from "lucide-react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import getAvatarPublicUrl from "@/lib/profiles/getAvatarProxyUrl";

type Summary = {
  title: string | null;
  category_id: string | null;
  category_name: string | null;
  status: string | null;
  start_time: string | null;
  end_time: string | null;
  location_text: string | null;
  postcode: string | null;
  is_public: boolean | null;
  hide_address_on_listing: boolean | null;
  description: string | null;
  display_on_map: boolean | null;
  display_address_on_day: boolean | null;
  house_rules: string[] | null;
  provided_items: string[] | null;
  location_lat: number | null;
  location_lng: number | null;
  cohost_ids: string[] | null;
  cohosts: { id: string; name: string; avatar_url: string | null }[] | null;
};

function fmtDateTime(iso: string | null) {
  if (!iso) return "—";
  try {
    const d = new Date(iso);
    const date = d.toLocaleDateString(undefined, {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
    const time = d.toLocaleTimeString(undefined, {
      hour: "2-digit",
      minute: "2-digit",
    });
    return `${date}, ${time}`;
  } catch {
    return "—";
  }
}

function formatDay(d: Date) {
  const day = d.getDate();
  const month = d.toLocaleString(undefined, { month: "short" });
  return `${day} ${month}`;
}

function formatTime(d: Date) {
  const hours = d.getHours();
  const minutes = d.getMinutes();
  const h12 = ((hours + 11) % 12) + 1;
  const mm = minutes === 0 ? "" : `:${minutes.toString().padStart(2, "0")}`;
  const ampm = hours < 12 ? "am" : "pm";
  return `${h12}${mm}${ampm}`;
}

function fmtWhen(startISO: string | null, endISO: string | null) {
  if (!startISO) return "—";
  const start = new Date(startISO);
  if (!endISO) {
    return `${formatDay(start)}, ${formatTime(start)} onwards`;
  }
  const end = new Date(endISO);

  const sameDay =
    start.getFullYear() === end.getFullYear() &&
    start.getMonth() === end.getMonth() &&
    start.getDate() === end.getDate();

  if (sameDay) {
    return `${formatDay(start)}, ${formatTime(start)} to ${formatTime(end)}`;
  }

  return `${formatDay(start)}, ${formatTime(start)} - ${formatDay(
    end
  )} ${formatTime(end)}`;
}

export default function VisibilityStep({
  groupId,
  onNext = () => {},
  onBack = () => {},
}: {
  groupId: string;
  onNext?: () => void;
  onBack?: () => void;
}) {
  const router = useRouter();
  const [loading, setLoading] = React.useState(true);
  const [summary, setSummary] = React.useState<Summary>({
    title: null,
    category_id: null,
    category_name: null,
    status: null,
    start_time: null,
    end_time: null,
    location_text: null,
    postcode: null,
    is_public: true,
    hide_address_on_listing: null,
    description: null,
    display_on_map: null,
    display_address_on_day: null,
    house_rules: null,
    provided_items: null,
    location_lat: null,
    location_lng: null,
    cohost_ids: null,
    cohosts: null,
  });
  const [visibility, setVisibility] = React.useState<"public" | "private">(
    "public"
  );
  const [savingDraft, setSavingDraft] = React.useState(false);
  const [publishing, setPublishing] = React.useState(false);

  React.useEffect(() => {
    let active = true;
    (async () => {
      try {
        const supabase = createClient();
        // 1) fetch group row
        const { data: g, error } = await supabase
          .from("groups")
          .select(
            "title, category_id, status, start_time, end_time, location_text, postcode, is_public, hide_address_on_listing, description, display_on_map, display_address_on_day, house_rules, provided_items, location_lat, location_lng, cohost_ids"
          )
          .eq("id", groupId)
          .maybeSingle();

        if (error) {
          console.error("Failed to load group summary", error.message);
        }

        if (!active) return;

        if (g) {
          let category_name: string | null = null;
          if (g.category_id) {
            const { data: cat } = await supabase
              .from("group_categories")
              .select("name")
              .eq("id", g.category_id)
              .maybeSingle();
            category_name = cat?.name ?? null;
          }

          // Load cohost profiles if cohost_ids exist
          let cohosts:
            | { id: string; name: string; avatar_url: string | null }[]
            | null = null;
          if (
            Array.isArray((g as any)?.cohost_ids) &&
            (g as any).cohost_ids.length
          ) {
            const { data: profiles } = await supabase
              .from("profiles")
              .select("id, profile_title, avatar_url")
              .in("id", (g as any).cohost_ids as string[]);
            if (profiles) {
              cohosts = profiles.map((p: any) => ({
                id: p.id,
                name: p.profile_title || "Unknown",
                avatar_url: p.avatar_url || null,
              }));
            }
          }

          const next: Summary = {
            title: g.title ?? null,
            category_id: g.category_id ?? null,
            category_name,
            status:
              (g as any)?.status === "active"
                ? "published"
                : (g as any)?.status ?? null,
            start_time: g.start_time ?? null,
            end_time: g.end_time ?? null,
            location_text: g.location_text ?? null,
            postcode: g.postcode ?? null,
            is_public: typeof g.is_public === "boolean" ? g.is_public : true,
            hide_address_on_listing:
              (g as any)?.hide_address_on_listing ?? null,
            description: g.description ?? null,
            display_on_map: (g as any)?.display_on_map ?? null,
            display_address_on_day: (g as any)?.display_address_on_day ?? null,
            house_rules: (g as any)?.house_rules ?? null,
            provided_items: (g as any)?.provided_items ?? null,
            location_lat: (g as any)?.location_lat ?? null,
            location_lng: (g as any)?.location_lng ?? null,
            cohost_ids: (g as any)?.cohost_ids ?? null,
            cohosts,
          };
          setSummary(next);
          setVisibility(next.is_public ? "public" : "private");
        }
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [groupId]);

  function validateBeforePublish(s: Summary): string[] {
    const issues: string[] = [];

    // start is required and must parse
    if (!s.start_time) {
      issues.push("Add a start date and time on the Schedule step.");
      return issues;
    }
    const startMs = Date.parse(s.start_time);
    if (Number.isNaN(startMs)) {
      issues.push(
        "Start time looks invalid. Please reselect it on the Schedule step."
      );
      return issues;
    }

    // end is optional; if missing or invalid we don't block publishing
    if (!s.end_time) return issues;
    const endMs = Date.parse(s.end_time);
    if (Number.isNaN(endMs)) return issues;

    if (endMs <= startMs) {
      issues.push("Finish time must be after the start time.");
    }
    return issues;
  }

  async function applyStatus(nextStatus: "draft" | "published") {
    const supabase = createClient();

    // Always read the latest times from the DB to avoid stale UI state
    const { data: latest, error: latestErr } = await supabase
      .from("groups")
      .select("start_time, end_time, is_public")
      .eq("id", groupId)
      .maybeSingle();

    if (latestErr) {
      console.error("Failed to read current group row", latestErr.message);
      if (typeof window !== "undefined") {
        alert("Couldn't read the current group details. Please try again.");
      }
      throw latestErr;
    }

    const startISO = latest?.start_time as string | null;
    const endISO = latest?.end_time as string | null;

    // If publishing, ensure required fields are present using DB values
    if (nextStatus === "published") {
      const problems: string[] = [];
      if (!startISO) {
        problems.push("Add a start date and time on the Schedule step.");
      } else {
        const startMs = Date.parse(startISO);
        if (Number.isNaN(startMs)) {
          problems.push(
            "Start time looks invalid. Please reselect it on the Schedule step."
          );
        }
        if (endISO) {
          const endMs = Date.parse(endISO);
          if (
            !Number.isNaN(endMs) &&
            !Number.isNaN(startMs) &&
            endMs <= startMs
          ) {
            problems.push("Finish time must be after the start time.");
          }
        }
      }
      if (problems.length) {
        if (typeof window !== "undefined") {
          alert("Can't publish yet:\n• " + problems.join("\n• "));
        }
        throw new Error("Publish validation failed");
      }
    }

    // Map app statuses to enum in DB
    const statusValue = nextStatus === "draft" ? "draft" : "active";
    const nextUiStatus = nextStatus === "draft" ? "draft" : "published";

    const { error } = await supabase
      .from("groups")
      .update({
        is_public: visibility === "public",
        status: statusValue as any,
      })
      .eq("id", groupId);

    if (error) {
      const msg =
        (error as any)?.code === "23514"
          ? "Publishing failed: start/finish time requirements are not met. Please set a start time (and ensure finish is after start)."
          : `Failed to update status: ${error.message}`;
      console.error(msg);
      if (typeof window !== "undefined") {
        alert(msg);
      }
      throw error;
    }

    setSummary((prev) => ({
      ...prev,
      status: nextUiStatus,
    }));

    router.push("/app/activity/groups/manage");
  }

  return (
    <div className="space-y-4">
      <h1 className="px-1 pb-2 text-2xl font-bold tracking-tight">
        Review {summary.title ? summary.title : "group"}
      </h1>
      <Card className="p-4 border-0 shadow-none">
        <div className="space-y-3">
          <div className="flex items-start justify-between gap-3">
            <div className="text-sm text-muted-foreground">Type of group</div>
            <div className="text-right min-w-0">
              {loading ? (
                "…"
              ) : (
                <Badge
                  variant="secondary"
                  className="px-2 py-0.5 text-xs rounded-full"
                >
                  {summary.category_name || "—"}
                </Badge>
              )}
            </div>
          </div>
          <Separator className="bg-border/40" />
          <div className="flex items-start justify-between gap-3">
            <div className="text-sm text-muted-foreground">When</div>
            <div className="text-right min-w-0">
              {loading ? (
                "…"
              ) : (
                <Badge
                  variant="secondary"
                  className="px-2 py-0.5 text-xs rounded-full"
                >
                  {fmtWhen(summary.start_time, summary.end_time)}
                </Badge>
              )}
            </div>
          </div>
          <Separator className="bg-border/40" />
          <div className="flex items-start justify-between gap-3">
            <div className="text-sm text-muted-foreground">Co-hosts</div>
            <div className="min-w-0 text-right">
              {loading ? (
                "…"
              ) : summary.cohosts && summary.cohosts.length ? (
                <div className="flex items-center justify-end gap-2">
                  {summary.cohosts.slice(0, 5).map((h) => {
                    const url = h.avatar_url
                      ? getAvatarPublicUrl(h.avatar_url) || undefined
                      : undefined;
                    const initials = h.name
                      ? h.name.slice(0, 2).toUpperCase()
                      : "??";
                    return (
                      <Avatar key={h.id} className="h-7 w-7">
                        <AvatarImage
                          src={url || undefined}
                          alt={h.name}
                          className="object-cover"
                        />
                        <AvatarFallback>{initials}</AvatarFallback>
                      </Avatar>
                    );
                  })}
                </div>
              ) : (
                "—"
              )}
            </div>
          </div>
          <Separator className="bg-border/40" />
          {/* Location (moved under “When”) */}
          <div className="space-y-2">
            <div className="text-sm text-muted-foreground">Location</div>
            <div className="rounded-lg bg-card overflow-hidden shadow-sm">
              <div
                className="relative w-full flex items-center justify-center text-sm bg-muted"
                style={{ minHeight: "16rem", height: "16rem" }}
              >
                <div className="text-center space-y-2">
                  <div className="inline-flex items-center gap-2 rounded-md border bg-background px-2 py-1 text-xs">
                    <MapPin className="h-4 w-4" />
                    <span>
                      {typeof summary.location_lat === "number" &&
                      typeof summary.location_lng === "number"
                        ? `${summary.location_lat.toFixed(
                            5
                          )}, ${summary.location_lng.toFixed(5)}`
                        : "No coordinates"}
                    </span>
                  </div>
                  {!loading && (summary.location_text || summary.postcode) ? (
                    <div className="text-xs text-muted-foreground">
                      {summary.location_text || summary.postcode}
                    </div>
                  ) : null}
                  <div className="text-xs text-muted-foreground">
                    Map preview coming soon
                  </div>
                </div>
              </div>
            </div>
          </div>
          <Separator className="bg-border/40" />
          {/* Location settings (no title, more space between items) */}
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm text-muted-foreground">
                Display location on the map
              </span>
              <span className="font-medium">
                {loading ? (
                  "…"
                ) : summary.display_on_map ? (
                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                ) : (
                  <XCircle className="h-4 w-4 text-destructive" />
                )}
              </span>
            </div>

            <div className="flex items-center justify-between gap-3">
              <span className="text-sm text-muted-foreground">
                Hide address/postcode on the listing
              </span>
              <span className="font-medium">
                {loading ? (
                  "…"
                ) : summary.hide_address_on_listing ? (
                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                ) : (
                  <XCircle className="h-4 w-4 text-destructive" />
                )}
              </span>
            </div>

            <div className="flex items-center justify-between gap-3">
              <span className="text-sm text-muted-foreground">
                Show address/postcode on the day
              </span>
              <span className="font-medium">
                {loading ? (
                  "…"
                ) : summary.display_address_on_day ? (
                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                ) : (
                  <XCircle className="h-4 w-4 text-destructive" />
                )}
              </span>
            </div>
          </div>
          <Separator className="bg-border/40" />
          <div className="flex items-start justify-between gap-3">
            <div className="text-sm text-muted-foreground">Description</div>
            <div className="text-left text-sm min-w-0">
              {loading ? (
                "…"
              ) : summary.description ? (
                <div className="whitespace-pre-wrap wrap-break-word">
                  {summary.description.replace(/\r\n/g, "\n")}
                </div>
              ) : (
                "—"
              )}
            </div>
          </div>
          <Separator className="bg-border/40" />
          <Separator className="bg-border/40" />
          <div className="space-y-2">
            <div className="text-sm text-muted-foreground">
              Rules and provided
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <div className="text-xs text-muted-foreground mb-1">
                  House rules
                </div>
                {loading ? (
                  "…"
                ) : summary.house_rules && summary.house_rules.length ? (
                  <div className="flex flex-wrap gap-1.5">
                    {summary.house_rules.map((r, i) => (
                      <Badge
                        key={i}
                        variant="secondary"
                        className="rounded-full px-2 py-0.5 text-xs"
                      >
                        {r}
                      </Badge>
                    ))}
                  </div>
                ) : (
                  <div className="text-xs text-muted-foreground">—</div>
                )}
              </div>
              <div>
                <div className="text-xs text-muted-foreground mb-1">
                  Provided
                </div>
                {loading ? (
                  "…"
                ) : summary.provided_items && summary.provided_items.length ? (
                  <div className="flex flex-wrap gap-1.5">
                    {summary.provided_items.map((p, i) => (
                      <Badge
                        key={i}
                        variant="secondary"
                        className="rounded-full px-2 py-0.5 text-xs"
                      >
                        {p}
                      </Badge>
                    ))}
                  </div>
                ) : (
                  <div className="text-xs text-muted-foreground">—</div>
                )}
              </div>
            </div>
          </div>
        </div>
      </Card>

      <Card className="p-4 bg-card border-0 shadow-none">
        <h2 className="text-lg font-semibold mb-0">Visibility</h2>
        <FieldGroup>
          <FieldSet>
            <FieldDescription>
              Choose who can find and request to join this group.
            </FieldDescription>
            <RadioGroup
              id="visibility-choice"
              value={visibility}
              onValueChange={(v) =>
                setVisibility(v === "private" ? "private" : "public")
              }
            >
              <FieldLabel htmlFor="vis-public">
                <Field orientation="horizontal">
                  <FieldContent>
                    <FieldTitle>Public</FieldTitle>
                    <FieldDescription>
                      Anyone can discover and request to join. Details like
                      exact address may still be hidden by your settings.
                    </FieldDescription>
                  </FieldContent>
                  <RadioGroupItem value="public" id="vis-public" />
                </Field>
              </FieldLabel>

              <FieldLabel htmlFor="vis-private">
                <Field orientation="horizontal">
                  <FieldContent>
                    <FieldTitle>Private</FieldTitle>
                    <FieldDescription>
                      Only people with a direct invite link can see and request
                      to join.
                    </FieldDescription>
                  </FieldContent>
                  <RadioGroupItem value="private" id="vis-private" />
                </Field>
              </FieldLabel>
            </RadioGroup>
          </FieldSet>
        </FieldGroup>
      </Card>

      <div className="space-y-3 pt-2">
        <Button
          type="button"
          variant="outline"
          size="lg"
          className="w-full rounded-md"
          disabled={loading || savingDraft || publishing}
          onClick={async () => {
            try {
              setSavingDraft(true);
              await applyStatus("draft");
            } catch (e) {
              // handled above
            } finally {
              setSavingDraft(false);
            }
          }}
        >
          {savingDraft ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              {summary.status === "published" ? "Setting as draft" : "Saving draft"}
            </>
          ) : (
            <>{summary.status === "published" ? "Set as draft" : "Save draft"}</>
          )}
        </Button>

        <Button
          type="button"
          size="lg"
          className="w-full rounded-md"
          disabled={loading || publishing || savingDraft}
          onClick={async () => {
            try {
              setPublishing(true);
              await applyStatus("published");
            } catch (e) {
              // handled in applyStatus
            } finally {
              setPublishing(false);
            }
          }}
        >
          {publishing ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              {summary.status === "published" ? "Saving changes" : "Publishing"}
            </>
          ) : (
            <>{summary.status === "published" ? "Edit post" : "Publish"}</>
          )}
        </Button>
      </div>
    </div>
  );
}
