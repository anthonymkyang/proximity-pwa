import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
    const resolvedParams = await params;
try {
    // FIX: your server helper returns a Promise<SupabaseClient>
    const supabase = await createClient();

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

    // Fetch the row to get the object key and verify ownership
    const { data: row, error: selErr } = await supabase
      .from("profile_photos_private")
      .select("object_key")
      .eq("id", resolvedParams.id)
      .eq("user_id", user.id)
      .single();

    if (selErr) {
      return NextResponse.json({ error: selErr.message }, { status: 400 });
    }
    if (!row) {
      return NextResponse.json({ error: "Photo not found" }, { status: 404 });
    }

    // Delete DB row and storage object in parallel
    const delRow = supabase
      .from("profile_photos_private")
      .delete()
      .eq("id", resolvedParams.id)
      .eq("user_id", user.id);

    const delObj = supabase.storage
      .from("profile_private")
      .remove([row.object_key]);

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
