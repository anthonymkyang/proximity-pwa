import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

export async function POST(
  req: Request,
  { params }: { params: { id: string } }
) {
  const supabase = createClient();
  const { keys = null, expiresIn = 600 } = await req.json().catch(() => ({}));

  // Select visible items (owner or recipient via RLS)
  const { data: items, error } = await supabase
    .from("photo_album_items")
    .select("object_key")
    .eq("album_id", params.id);
  if (error)
    return NextResponse.json({ error: error.message }, { status: 400 });

  const toSign =
    Array.isArray(keys) && keys.length
      ? items
          .filter((i) => keys.includes(i.object_key))
          .map((i) => i.object_key)
      : items.map((i) => i.object_key);

  const { data: signed, error: signErr } = await supabase.storage
    .from("albums")
    .createSignedUrls(
      toSign,
      Math.max(60, Math.min(3600, Number(expiresIn) || 600))
    );
  if (signErr)
    return NextResponse.json({ error: signErr.message }, { status: 400 });

  return NextResponse.json({ urls: signed });
}
