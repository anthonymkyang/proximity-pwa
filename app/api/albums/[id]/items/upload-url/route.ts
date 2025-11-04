import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { createClient } from "@/utils/supabase/server";

export async function POST(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    // FIX: your server helper returns Promise<SupabaseClient>
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

    const { ext } = await req.json();
    if (!ext) {
      return NextResponse.json({ error: "ext required" }, { status: 400 });
    }

    // RLS ensures ownership/read access of album; we check existence for clearer errors
    const { data: album, error: albErr } = await supabase
      .from("photo_albums")
      .select("id, user_id")
      .eq("id", params.id)
      .single();

    if (albErr) {
      return NextResponse.json({ error: albErr.message }, { status: 400 });
    }
    if (!album) {
      return NextResponse.json({ error: "Album not found" }, { status: 404 });
    }
    // Optional: explicit owner check (RLS will also protect)
    if (album.user_id && album.user_id !== user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const objectKey = `${user.id}/${randomUUID()}.${String(ext).toLowerCase()}`;

    const { data, error } = await supabase.storage
      .from("albums")
      .createSignedUploadUrl(objectKey);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ uploadUrl: data.signedUrl, objectKey });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || "Unexpected error" },
      { status: 500 }
    );
  }
}
