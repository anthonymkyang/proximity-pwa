import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id } = await ctx.params; // ← await the params Promise
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const patch: Record<string, any> = {};
  if (typeof body.position === "number") patch.position = body.position;
  if (typeof body.is_main === "boolean") patch.is_main = body.is_main;

  // If setting a new main image, clear existing main (except this id)
  if (patch.is_main === true) {
    await supabase
      .from("profile_photos_public")
      .update({ is_main: false })
      .eq("user_id", user.id)
      .eq("is_main", true)
      .neq("id", id);
  }

  const { data, error } = await supabase
    .from("profile_photos_public")
    .update(patch)
    .eq("id", id)
    .eq("user_id", user.id)
    .select("*")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ photo: data });
}

export async function DELETE(
  _req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id } = await ctx.params; // ← await the params Promise
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Fetch row to get object_key
  const { data: row, error: selErr } = await supabase
    .from("profile_photos_public")
    .select("object_key")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();

  if (selErr) {
    return NextResponse.json({ error: selErr.message }, { status: 400 });
  }

  // Delete DB row and storage object in parallel
  const delRow = supabase
    .from("profile_photos_public")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);

  const delObj = supabase.storage
    .from("profile_public")
    .remove([row.object_key]);

  const [rowRes, objRes] = await Promise.all([delRow, delObj]);

  if (rowRes.error) {
    return NextResponse.json({ error: rowRes.error.message }, { status: 400 });
  }
  if (objRes.error) {
    return NextResponse.json({ error: objRes.error.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
