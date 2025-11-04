import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

export async function POST(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
    error: userErr,
  } = await supabase.auth.getUser();

  if (userErr || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { ids } = await req.json().catch(() => ({}));
  if (!Array.isArray(ids) || ids.length === 0) {
    return NextResponse.json({ error: "ids array required" }, { status: 400 });
  }

  // Fetch all of this user's photos (we need full set to reorder safely)
  const { data: rows, error: fetchErr } = await supabase
    .from("profile_photos_public")
    .select("id, position, is_main")
    .eq("user_id", user.id)
    .order("position", { ascending: true });

  if (fetchErr) {
    return NextResponse.json({ error: fetchErr.message }, { status: 400 });
  }

  const allIds = (rows ?? []).map((r) => r.id);
  const owned = new Set(allIds);

  // Validate every provided id belongs to the user
  for (const id of ids) {
    if (!owned.has(id)) {
      return NextResponse.json(
        { error: "One or more ids do not belong to the user" },
        { status: 400 }
      );
    }
  }

  // Ensure the ordered list includes all of the user's photos by
  // appending any that weren't in `ids` in their current order.
  const missing = allIds.filter((id) => !ids.includes(id));
  const finalOrder: string[] = [...ids, ...missing];

  try {
    // IMPORTANT: clear any existing main flag first to avoid partial-unique
    // index clashes (e.g., a unique index on (user_id) WHERE is_main is true).
    const clearMain = await supabase
      .from("profile_photos_public")
      .update({ is_main: false })
      .eq("user_id", user.id)
      .eq("is_main", true);

    if (clearMain.error) {
      return NextResponse.json(
        { error: clearMain.error.message },
        { status: 400 }
      );
    }

    // Move all current positions out of the way using distinct temporary values.
    // Using unique temps avoids (user_id, position) uniqueness violations.
    for (let i = 0; i < allIds.length; i++) {
      const id = allIds[i];
      const tmp = await supabase
        .from("profile_photos_public")
        .update({ position: 1000 + i })
        .eq("id", id)
        .eq("user_id", user.id);

      if (tmp.error) {
        return NextResponse.json({ error: tmp.error.message }, { status: 400 });
      }
    }

    // Apply final order: set new position and main flag (index 0)
    for (let i = 0; i < finalOrder.length; i++) {
      const id = finalOrder[i];
      const upd = await supabase
        .from("profile_photos_public")
        .update({ position: i, is_main: i === 0 })
        .eq("id", id)
        .eq("user_id", user.id);

      if (upd.error) {
        return NextResponse.json({ error: upd.error.message }, { status: 400 });
      }
    }

    return NextResponse.json({ ok: true, order: finalOrder });
  } catch (err: any) {
    return NextResponse.json(
      { error: String(err?.message || err) },
      { status: 400 }
    );
  }
}
