import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

export async function POST(req: Request) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { title } = await req.json();
  if (!title || typeof title !== "string")
    return NextResponse.json({ error: "title required" }, { status: 400 });

  const { data, error } = await supabase
    .from("photo_albums")
    .insert({ user_id: user.id, title })
    .select("*")
    .single();

  if (error)
    return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ album: data });
}
