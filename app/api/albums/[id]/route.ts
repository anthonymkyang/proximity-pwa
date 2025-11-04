import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

export async function GET(
  _req: Request,
  { params }: { params: { id: string } }
) {
  try {
    // FIX: your server helper returns a Promise<SupabaseClient>
    const supabase = await createClient();

    const { data, error } = await supabase
      .from("photo_albums")
      .select("*")
      .eq("id", params.id)
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ album: data });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || "Unexpected error" },
      { status: 500 }
    );
  }
}
