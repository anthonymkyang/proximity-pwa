import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const resolvedParams = await params;
  try {
    // FIX: await your server-side createClient()
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

    const { recipient_id, share = true, expires_at = null } = await req.json();
    if (!recipient_id) {
      return NextResponse.json(
        { error: "recipient_id required" },
        { status: 400 }
      );
    }

    // Ensure album exists (RLS already protects, this yields clearer errors)
    const { data: album, error: albErr } = await supabase
      .from("photo_albums")
      .select("id, user_id")
      .eq("id", resolvedParams.id)
      .single();

    if (albErr) {
      return NextResponse.json({ error: albErr.message }, { status: 400 });
    }
    if (!album) {
      return NextResponse.json({ error: "Album not found" }, { status: 404 });
    }
    // Optional owner check (RLS covers it but this is explicit)
    if (album.user_id && album.user_id !== user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    if (share) {
      const { data, error } = await supabase
        .from("album_shares")
        .upsert(
          {
            album_id: resolvedParams.id,
            owner_id: user.id,
            recipient_id,
            expires_at,
          },
          { onConflict: "album_id,recipient_id" }
        )
        .select("*")
        .single();

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 400 });
      }
      return NextResponse.json({ share: data });
    } else {
      const { error } = await supabase
        .from("album_shares")
        .delete()
        .eq("album_id", resolvedParams.id)
        .eq("owner_id", user.id)
        .eq("recipient_id", recipient_id);

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
