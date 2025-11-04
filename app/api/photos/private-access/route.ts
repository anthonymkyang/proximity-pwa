import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

export async function GET() {
  try {
    // FIX: await the Promise<SupabaseClient>
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

    const [mine, canView] = await Promise.all([
      supabase.from("private_photo_access").select("*").eq("owner_id", user.id),
      supabase
        .from("private_photo_access")
        .select("*")
        .eq("viewer_id", user.id),
    ]);

    if (mine.error) {
      return NextResponse.json({ error: mine.error.message }, { status: 400 });
    }
    if (canView.error) {
      return NextResponse.json(
        { error: canView.error.message },
        { status: 400 }
      );
    }

    return NextResponse.json({ myGrants: mine.data, canView: canView.data });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || "Unexpected error" },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    // FIX: await the Promise<SupabaseClient>
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

    const { viewer_id, grant = true, expires_at = null } = await req.json();
    if (!viewer_id) {
      return NextResponse.json(
        { error: "viewer_id required" },
        { status: 400 }
      );
    }

    if (grant) {
      const { data, error } = await supabase
        .from("private_photo_access")
        .upsert(
          { owner_id: user.id, viewer_id, expires_at },
          { onConflict: "owner_id,viewer_id" }
        )
        .select("*")
        .single();

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 400 });
      }
      return NextResponse.json({ grant: data });
    } else {
      const { error } = await supabase
        .from("private_photo_access")
        .delete()
        .eq("owner_id", user.id)
        .eq("viewer_id", viewer_id);

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 400 });
      }
      return NextResponse.json({ ok: true });
    }
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || "Unexpected error" },
      { status: 500 }
    );
  }
}
