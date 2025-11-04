import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

export async function POST(req: Request) {
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

    const { objectKey, position = 0 } = await req.json();
    if (!objectKey) {
      return NextResponse.json(
        { error: "objectKey required" },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from("profile_photos_private")
      .insert({
        user_id: user.id,
        object_key: objectKey,
        position: Number(position) || 0,
      })
      .select("*")
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ photo: data });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || "Unexpected error" },
      { status: 500 }
    );
  }
}
