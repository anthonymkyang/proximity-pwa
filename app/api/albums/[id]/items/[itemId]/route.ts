import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

export async function DELETE(
  _req: Request,
  { params }: { params: { id: string; itemId: string } }
) {
  try {
    // Your server helper returns a Promise<SupabaseClient>, so await it
    const supabase = await createClient();

    // Require auth
    const {
      data: { user },
      error: userErr,
    } = await supabase.auth.getUser();
    if (userErr) {
      return NextResponse.json({ error: userErr.message }, { status: 401 });
    }
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Fetch the item we’re deleting (ensure it belongs to the album in the route)
    const { data: row, error: selErr } = await supabase
      .from("photo_album_items")
      .select("object_key, album_id, user_id")
      .eq("id", params.itemId)
      .single();

    if (selErr) {
      return NextResponse.json({ error: selErr.message }, { status: 400 });
    }
    if (!row) {
      return NextResponse.json({ error: "Item not found" }, { status: 404 });
    }
    if (row.album_id !== params.id) {
      // Route/row mismatch
      return NextResponse.json(
        { error: "Item does not belong to this album" },
        { status: 400 }
      );
    }

    // Optional owner check (RLS should already protect this, but this gives a clearer error)
    if (row.user_id !== user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Delete DB row and storage object in parallel
    const delRow = supabase
      .from("photo_album_items")
      .delete()
      .eq("id", params.itemId);

    const delObj = supabase.storage.from("albums").remove([row.object_key]);

    const [rowRes, objRes] = await Promise.all([delRow, delObj]);

    if (rowRes.error) {
      return NextResponse.json(
        { error: rowRes.error.message },
        { status: 400 }
      );
    }
    if (objRes.error) {
      return NextResponse.json(
        { error: objRes.error.message },
        { status: 400 }
      );
    }

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || "Unexpected error" },
      { status: 500 }
    );
  }
}
