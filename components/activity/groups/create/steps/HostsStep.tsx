"use client";

import * as React from "react";
import { createClient } from "@/utils/supabase/client";
import { useForm } from "react-hook-form";
import { updateGroup } from "@/app/api/groups/actions";

import { Button } from "@/components/ui/button";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
  DrawerTrigger,
} from "@/components/ui/drawer";
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemMedia,
  ItemTitle,
} from "@/components/ui/item";
import {
  UserPlus,
  ChevronRight,
  Plus,
  Minus,
  X,
  ArrowRight,
  Loader2,
} from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import getAvatarPublicUrl from "@/lib/profiles/getAvatarPublicUrl";

type FormData = {
  cohost_ids: string[];
  max_attendees: number | null;
};

export default function HostsStep({
  groupId,
  onNext,
  onBack,
}: {
  groupId: string;
  onNext: () => void;
  onBack: () => void;
}) {
  const {
    register,
    handleSubmit,
    setValue,
    watch,
    getValues,
    formState: { isSubmitting },
  } = useForm<FormData>({
    shouldUnregister: false,
    mode: "onSubmit",
    defaultValues: {
      cohost_ids: [],
      max_attendees: null,
    },
  });

  // Ensure RHF tracks the array field
  React.useEffect(() => {
    register("cohost_ids");
  }, [register]);

  const [limitEnabled, setLimitEnabled] = React.useState<boolean>(false);

  type Person = { id: string; username: string; avatar_url?: string | null };
  const [suggestions, setSuggestions] = React.useState<Person[]>([]);
  const selectedIds = React.useRef<Set<string>>(new Set());
  const [selectedPeople, setSelectedPeople] = React.useState<Person[]>([]);

  // Load cohosts + max_attendees from DB
  React.useEffect(() => {
    let active = true;
    (async () => {
      try {
        const supabase = createClient();
        const { data, error } = await supabase
          .from("groups")
          .select("cohost_ids,max_attendees")
          .eq("id", groupId)
          .maybeSingle();
        if (error || !data || !active) return;

        const max = data.max_attendees ?? null;
        setLimitEnabled(max != null);
        setValue("max_attendees", max ?? null, { shouldDirty: false });

        const ids: string[] = Array.isArray(data.cohost_ids)
          ? data.cohost_ids
          : [];
        selectedIds.current = new Set(ids);
        setValue("cohost_ids", ids, { shouldDirty: false });

        if (ids.length) {
          const { data: profs } = await supabase
            .from("profiles")
            .select("id, username, avatar_url")
            .in("id", ids);
          const ordered = (profs || []).sort(
            (a, b) => ids.indexOf(a.id) - ids.indexOf(b.id)
          );
          setSelectedPeople(
            ordered.map((p: any) => ({
              id: p.id,
              username: p.username || "user",
              avatar_url: p.avatar_url || null,
            }))
          );
        } else {
          setSelectedPeople([]);
        }
      } catch {
        // noop
      }
    })();
    return () => {
      active = false;
    };
  }, [groupId, setValue]);

  // Suggestions: from conversations membership
  async function loadSuggestionsFromSupabase(): Promise<Person[]> {
    try {
      const supabase = createClient();
      const { data: auth } = await supabase.auth.getUser();
      const me = auth?.user?.id;
      if (!me) return [];

      const { data: myConvos } = await supabase
        .from("conversation_members")
        .select("conversation_id")
        .eq("user_id", me);

      const convIds = Array.from(
        new Set((myConvos || []).map((c: any) => c.conversation_id))
      );
      if (!convIds.length) return [];

      const { data: others } = await supabase
        .from("conversation_members")
        .select("user_id")
        .in("conversation_id", convIds)
        .neq("user_id", me);

      const otherIds = Array.from(
        new Set((others || []).map((m: any) => m.user_id))
      );
      if (!otherIds.length) return [];

      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, username, avatar_url")
        .in("id", otherIds);

      return (profiles || []).map((p: any) => ({
        id: p.id,
        username: p.username || "user",
        avatar_url: p.avatar_url || null,
      }));
    } catch {
      return [];
    }
  }

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const merged = await loadSuggestionsFromSupabase();
        if (!cancelled) setSuggestions(merged);
      } catch {
        if (!cancelled) setSuggestions([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  function removeCohost(id: string) {
    selectedIds.current.delete(id);
    setSelectedPeople((prev) => prev.filter((p) => p.id !== id));
    const next = Array.from(selectedIds.current);
    setValue("cohost_ids", next, {
      shouldDirty: true,
      shouldTouch: true,
      shouldValidate: true,
    });
  }

  function addCohost(p: Person) {
    if (selectedIds.current.has(p.id)) return;
    if (selectedIds.current.size >= 3) return;
    selectedIds.current.add(p.id);
    setSelectedPeople((prev) => [...prev, p]);
    const next = Array.from(selectedIds.current);
    setValue("cohost_ids", next, {
      shouldDirty: true,
      shouldTouch: true,
      shouldValidate: true,
    });
  }

  React.useEffect(() => {
    if (!limitEnabled) {
      setValue("max_attendees", null, {
        shouldDirty: true,
        shouldTouch: true,
        shouldValidate: true,
      });
    } else {
      const n = Number(watch("max_attendees") ?? NaN);
      if (!Number.isFinite(n) || n < 1) {
        setValue("max_attendees", 10, {
          shouldDirty: true,
          shouldTouch: true,
          shouldValidate: true,
        });
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [limitEnabled]);

  const onSubmit = async (raw: FormData) => {
    const ids = Array.isArray(raw.cohost_ids) ? raw.cohost_ids.slice(0, 3) : [];

    const max = limitEnabled ? Number(raw.max_attendees) : NaN;
    const maxOrNull = limitEnabled && Number.isFinite(max) ? max : null;

    try {
      await updateGroup(groupId, {
        // cohost_ids must be an array (NOT NULL in DB). Use [] when none selected.
        cohost_ids: ids,
        max_attendees: maxOrNull,
      });
      onNext();
    } catch (e) {
      console.error("Failed to update group hosts:", e);
    }
  };

  return (
    <>
      <h1 className="text-2xl font-semibold mb-4 px-1">
        Co-hosts and attendees
      </h1>
      <form noValidate onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div className="rounded-lg bg-card p-4 shadow-sm">
          <Drawer>
            <DrawerTrigger asChild>
              <Item className="cursor-pointer bg-white/5 backdrop-blur-xl border border-white/10 shadow-[inset_0_0_1px_rgba(255,255,255,0.4),0_0_8px_rgba(255,255,255,0.08),0_2px_10px_rgba(0,0,0,0.3)] hover:bg-white/10 transition-all duration-300">
                <ItemMedia variant="icon">
                  <UserPlus className="h-5 w-5" />
                </ItemMedia>
                <ItemContent>
                  <ItemTitle>Add co-hosts</ItemTitle>
                  <ItemDescription>Invite up to 3 co-hosts</ItemDescription>
                </ItemContent>
                <ItemActions>
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                </ItemActions>
              </Item>
            </DrawerTrigger>
            <DrawerContent>
              <DrawerHeader>
                <DrawerTitle>Add co-hosts</DrawerTitle>
                <DrawerDescription>
                  Select up to 3 people to help manage this group.
                </DrawerDescription>
              </DrawerHeader>
              <div className="px-4 pb-4">
                <div className="rounded-lg bg-card p-3 shadow-sm">
                  <ScrollArea className="h-64 rounded-md overflow-y-auto">
                    <ul className="divide-y">
                      {suggestions.map((p) => {
                        const already = selectedIds.current.has(p.id);
                        const disabled =
                          already || selectedIds.current.size >= 3;
                        return (
                          <li
                            key={p.id}
                            className="flex items-center justify-between gap-3 p-3"
                          >
                            <div className="flex items-center gap-3 min-w-0">
                              <Avatar className="h-8 w-8 shrink-0">
                                <AvatarImage
                                  src={
                                    p.avatar_url
                                      ? getAvatarPublicUrl(p.avatar_url) ||
                                        undefined
                                      : undefined
                                  }
                                  alt={p.username}
                                  className="object-cover"
                                />
                                <AvatarFallback>
                                  {p.username?.slice(0, 2)?.toUpperCase() ||
                                    "U"}
                                </AvatarFallback>
                              </Avatar>
                              <div className="truncate text-sm font-medium">
                                {p.username}
                              </div>
                            </div>
                            {already ? (
                              <Button
                                type="button"
                                size="icon"
                                variant="destructive"
                                className="rounded-full"
                                onClick={() => removeCohost(p.id)}
                                aria-label="Remove co-host"
                                title="Remove co-host"
                              >
                                <X className="h-4 w-4" />
                              </Button>
                            ) : (
                              <Button
                                type="button"
                                size="icon"
                                className="rounded-full"
                                onClick={() => addCohost(p)}
                                aria-label="Add co-host"
                                title="Add co-host"
                                disabled={disabled}
                              >
                                <Plus className="h-4 w-4" />
                              </Button>
                            )}
                          </li>
                        );
                      })}
                      {suggestions.length === 0 && (
                        <li className="p-3 text-sm text-muted-foreground">
                          No suggestions yet.
                        </li>
                      )}
                    </ul>
                  </ScrollArea>
                </div>
              </div>
            </DrawerContent>
          </Drawer>

          {selectedPeople.length > 0 ? (
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-2">
                {selectedPeople.map((p) => (
                  <Avatar key={p.id} className="h-8 w-8">
                    <AvatarImage
                      src={
                        p.avatar_url
                          ? getAvatarPublicUrl(p.avatar_url) || undefined
                          : undefined
                      }
                      alt={p.username}
                      className="object-cover"
                    />
                    <AvatarFallback>
                      {p.username?.slice(0, 2)?.toUpperCase() || "U"}
                    </AvatarFallback>
                  </Avatar>
                ))}
              </div>
              <span className="text-sm text-muted-foreground">
                {selectedPeople
                  .map((p) => p.username)
                  .filter(Boolean)
                  .join(", ")}
              </span>
            </div>
          ) : null}
        </div>

        <div className="rounded-lg bg-card p-4 shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <div className="text-sm font-medium">Limit number of attendees</div>
            <Switch
              checked={limitEnabled}
              onCheckedChange={(v) => setLimitEnabled(!!v)}
              aria-label="Limit number of attendees"
            />
          </div>

          {limitEnabled && (
            <div className="flex items-center justify-between">
              <div className="text-sm">Max number of attendees</div>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  size="icon"
                  variant="secondary"
                  className="h-7 w-7 rounded-full"
                  onClick={() => {
                    const n = Number(watch("max_attendees") ?? 0);
                    const next = Math.max(1, n - 1);
                    setValue("max_attendees", next, {
                      shouldDirty: true,
                      shouldTouch: true,
                      shouldValidate: true,
                    });
                  }}
                  aria-label="Decrease max attendees"
                >
                  <Minus className="h-3.5 w-3.5" />
                </Button>
                <div className="w-10 text-center tabular-nums">
                  {Number.isFinite(Number(watch("max_attendees")))
                    ? Number(watch("max_attendees"))
                    : 10}
                </div>
                <Button
                  type="button"
                  size="icon"
                  className="h-7 w-7 rounded-full"
                  onClick={() => {
                    const n = Number(watch("max_attendees") ?? 0);
                    const next = Math.min(999, n + 1);
                    setValue("max_attendees", next, {
                      shouldDirty: true,
                      shouldTouch: true,
                      shouldValidate: true,
                    });
                  }}
                  aria-label="Increase max attendees"
                >
                  <Plus className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          )}

          {/* Keep field in form state even if hidden */}
          <input
            type="hidden"
            {...register("max_attendees", { valueAsNumber: true })}
          />
        </div>

        <div className="flex justify-end">
          <Button
            type="submit"
            disabled={isSubmitting}
            size="lg"
            className="w-full rounded-md px-5"
            onClick={() => {
              // Nudge values so they are present before submit
              setValue("cohost_ids", getValues("cohost_ids") ?? [], {
                shouldTouch: true,
                shouldValidate: true,
              });
              if (limitEnabled) {
                const n = Number(getValues("max_attendees"));
                setValue("max_attendees", Number.isFinite(n) ? n : 10, {
                  shouldTouch: true,
                  shouldValidate: true,
                });
              }
            }}
            variant="default"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Continue
              </>
            ) : (
              <>Continue</>
            )}
          </Button>
        </div>
      </form>
    </>
  );
}
