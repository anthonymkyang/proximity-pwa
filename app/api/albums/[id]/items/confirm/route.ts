import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const resolvedParams = await params;
  try {
    // Your server helper returns a Promise<SupabaseClient>, so await it
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
      .from("photo_album_items")
      .insert({
        album_id: resolvedParams.id,
        user_id: user.id,
        object_key: objectKey,
        position: Number(position) || 0,
      })
      .select("*")
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ item: data });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || "Unexpected error" },
      { status: 500 }
    );
  }
}
