import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

type Row = { object_key: string };

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const resolvedParams = await params;
  try {
    // Your server helper returns a Promise<SupabaseClient>
    const supabase = await createClient();

    const { keys = null, expiresIn = 600 } = await req
      .json()
      .catch(() => ({} as any));

    // Select visible items (owner or recipient via RLS)
    const { data: items, error } = await supabase
      .from("photo_album_items")
      .select("object_key")
      .eq("album_id", resolvedParams.id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    const rows: Row[] = Array.isArray(items) ? (items as Row[]) : [];

    const toSign: string[] =
      Array.isArray(keys) && keys.length
        ? rows
            .filter((i: Row) => keys.includes(i.object_key))
            .map((i: Row) => i.object_key)
        : rows.map((i: Row) => i.object_key);

    if (!toSign.length) {
      return NextResponse.json({ urls: [] });
    }

    const ttl = Math.max(60, Math.min(3600, Number(expiresIn) || 600));

    const { data: signed, error: signErr } = await supabase.storage
      .from("albums")
      .createSignedUrls(toSign, ttl);

    if (signErr) {
      return NextResponse.json({ error: signErr.message }, { status: 400 });
    }

    return NextResponse.json({ urls: signed });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message ?? "Unexpected error" },
      { status: 500 }
    );
  }
}
