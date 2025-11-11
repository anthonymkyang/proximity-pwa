import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const user_id: string | null = body?.user_id ?? null;
    const rawStatus: unknown = body?.status;
    const lat: unknown = body?.lat;
    const lng: unknown = body?.lng;

    if (!user_id) {
      return NextResponse.json({ error: "Missing user_id" }, { status: 400 });
    }

    const str =
      typeof rawStatus === "string"
        ? rawStatus.toLowerCase().trim()
        : rawStatus === null
        ? null
        : undefined;

    // Match your DB enum: NULL | online | away | offline
    // "recent" (from UI) should be stored as "offline" in DB
    const status: "online" | "away" | "offline" | null =
      str === "online" || str === "away" || str === "offline"
        ? (str as any)
        : str === "recent"
        ? "offline"
        : null;

    const supa = await createClient();

    const row: Record<string, any> = {
      user_id,
      status,
      updated_at: new Date().toISOString(),
    };

    if (typeof lat === "number" && typeof lng === "number") {
      row.lat = lat;
      row.lng = lng;
    }

    const { data, error } = await supa
      .from("user_presence")
      .upsert(row, { onConflict: "user_id" })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ data });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || "Bad request" },
      { status: 400 }
    );
  }
}
