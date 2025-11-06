import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: reqRow, error } = await supabase
    .from("age_verification_requests")
    .select("id,status,session_id,created_at,updated_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error)
    return NextResponse.json({ error: error.message }, { status: 400 });

  if (!reqRow) return NextResponse.json({ request: null, media: [] });

  const { data: media } = await supabase
    .from("age_verification_media")
    .select("id,kind,object_key,created_at")
    .eq("request_id", reqRow.id);

  return NextResponse.json({ request: reqRow, media: media || [] });
}
