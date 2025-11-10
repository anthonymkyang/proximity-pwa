"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/utils/supabase/server";

/**
 * Minimal row created for a new draft. No default title is set.
 * If a draft already exists for the current user, reuse it.
 */
export async function createDraftGroup() {
  const supabase = await createClient();
  const {
    data: { user },
    error: authErr,
  } = await supabase.auth.getUser();
  if (authErr || !user) throw new Error("Not signed in");

  // Reuse latest draft for this host if it exists
  const { data: existing } = await supabase
    .from("groups")
    .select("id, status")
    .eq("host_id", user.id)
    .eq("status", "draft")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existing?.id) return existing.id as string;

  const { data, error } = await supabase
    .from("groups")
    .insert({
      host_id: user.id,
      title: "", // keep empty until user types one
      status: "draft",
    })
    .select("id")
    .single();

  if (error) throw error;
  return data.id as string;
}

type UpdatableGroupFields = Partial<{
  title: string | null;
  category_id: string | null;
  description: string | null;
  start_time: string | Date | null;
  end_time: string | Date | null;
  location_text: string | null;
  location_lat: number | null;
  location_lng: number | null;
  postcode: string | null;
  house_rules: string[] | null;
  provided_items: string[] | null;
  max_attendees: number | null;
  is_public: boolean | null;
  cover_image_url: string | null;
  display_on_map: boolean | null;
  hide_address_on_listing: boolean | null;
  display_address_on_day: boolean | null;
  cohost_ids: string[] | null;
}>;

function coerceEmptyStringsToNull<T extends Record<string, any>>(obj: T): T {
  const out: Record<string, any> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (typeof v === "string") {
      out[k] = v.trim() === "" ? null : v;
    } else if (v instanceof Date) {
      out[k] = v.toISOString();
    } else {
      out[k] = v;
    }
  }
  return out as T;
}

/**
 * Patch a group row by id.
 */
export async function updateGroup(
  groupId: string,
  patch: UpdatableGroupFields
) {
  const cleanPatch = coerceEmptyStringsToNull(patch);

  const supabase = await createClient();

  const { data, error } = await supabase
    .from("groups")
    .update(cleanPatch)
    .eq("id", groupId)
    .select("id")
    .maybeSingle();

  if (error) throw error;
  if (!data) throw new Error("No group updated or you lack permission");

  // Revalidate wizard and summary routes
  revalidatePath("/app/activity/groups/create");
  revalidatePath(`/app/activity/groups/${groupId}`);
  revalidatePath("/app/activity/groups/manage");
  return { id: data.id };
}

/**
 * Update the group status. Use "active" to publish, "draft" to keep as draft.
 * This function intentionally only accepts those two states for safety.
 */
export async function publishGroup(
  groupId: string,
  nextStatus: "active" | "draft"
) {
  const supabase = await createClient();

  // If trying to activate, enforce start/end rules here to return a friendlier error than a DB constraint.
  if (nextStatus === "active") {
    const { data: g, error: fetchErr } = await supabase
      .from("groups")
      .select("start_time, end_time")
      .eq("id", groupId)
      .maybeSingle();

    if (fetchErr) throw fetchErr;

    const start = g?.start_time
      ? new Date(g.start_time as unknown as string)
      : null;
    const end = g?.end_time ? new Date(g.end_time as unknown as string) : null;

    if (!start) {
      throw new Error(
        "Publishing failed: start/finish time requirements are not met. Please set a start time."
      );
    }
    if (end && start && end.getTime() <= start.getTime()) {
      throw new Error(
        "Publishing failed: start/finish time requirements are not met. The finish time must be after the start time."
      );
    }
  }

  const { error } = await supabase
    .from("groups")
    .update({ status: nextStatus })
    .eq("id", groupId);

  if (error) throw error;

  revalidatePath(`/app/activity/groups/${groupId}`);
  revalidatePath("/app/activity/groups/manage");
  return { ok: true };
}

export type GroupSummary = {
  id: string;
  title: string | null;
  category_id: string | null;
  category_name: string | null;
  start_time: string | null;
  end_time: string | null;
  location_text: string | null;
  postcode: string | null;
  is_public: boolean | null;
  // extras helpful to downstream UIs
  location_lat?: number | null;
  location_lng?: number | null;
  cover_image_url?: string | null;
  display_on_map?: boolean | null;
  hide_address_on_listing?: boolean | null;
  display_address_on_day?: boolean | null;
};

/**
 * Fetch a compact summary for the Review/Visibility step.
 * Uses a FK from groups.category_id -> group_categories.id with column "name".
 * We read it as an object rather than an array for compatibility.
 */
export async function getGroupSummary(
  groupId: string
): Promise<{ data: GroupSummary | null; error: any }> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("groups")
    .select(
      `
      id,
      title,
      category_id,
      start_time,
      end_time,
      location_text,
      postcode,
      is_public,
      location_lat,
      location_lng,
      cover_image_url,
      display_on_map,
      hide_address_on_listing,
      display_address_on_day,
      group_categories(name)
    `
    )
    .eq("id", groupId)
    .maybeSingle();

  if (error) {
    return { data: null, error };
  }

  const category_name = (data as any)?.group_categories?.name ?? null;

  const summary: GroupSummary = {
    id: data?.id as string,
    title: data?.title ?? null,
    category_id: data?.category_id ?? null,
    category_name,
    start_time: (data as any)?.start_time ?? null,
    end_time: (data as any)?.end_time ?? null,
    location_text: (data as any)?.location_text ?? null,
    postcode: (data as any)?.postcode ?? null,
    is_public:
      typeof (data as any)?.is_public === "boolean"
        ? (data as any).is_public
        : null,
    location_lat: (data as any)?.location_lat ?? null,
    location_lng: (data as any)?.location_lng ?? null,
    cover_image_url: (data as any)?.cover_image_url ?? null,
    display_on_map: (data as any)?.display_on_map ?? null,
    hide_address_on_listing: (data as any)?.hide_address_on_listing ?? null,
    display_address_on_day: (data as any)?.display_address_on_day ?? null,
  };

  return { data: summary, error: null };
}
