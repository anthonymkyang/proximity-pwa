import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

type Row = { object_key: string };

export async function POST(req: Request) {
  try {
    // FIX: your server helper returns a Promise<SupabaseClient>
    const supabase = await createClient();

    const { owner_id, expiresIn = 600 } = await req.json();

    if (!owner_id) {
      return NextResponse.json({ error: "owner_id required" }, { status: 400 });
    }

    const { data: rows, error } = await supabase
      .from("profile_photos_private")
      .select("object_key")
      .eq("user_id", owner_id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    const list: Row[] = Array.isArray(rows) ? (rows as Row[]) : [];
    const keys: string[] = list.map((r: Row) => r.object_key);

    if (!keys.length) {
      return NextResponse.json({ urls: [] });
    }

    const ttl = Math.max(60, Math.min(3600, Number(expiresIn) || 600));

    const { data: signed, error: signErr } = await supabase.storage
      .from("profile_private")
      .createSignedUrls(keys, ttl);

    if (signErr) {
      return NextResponse.json({ error: signErr.message }, { status: 400 });
    }

    return NextResponse.json({ urls: signed });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || "Unexpected error" },
      { status: 500 }
    );
  }
}
