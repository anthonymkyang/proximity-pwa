import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Find an active request, or create one
  const { data: existing, error: exErr } = await supabase
    .from("age_verification_requests")
    .select("*")
    .eq("user_id", user.id)
    .in("status", [
      "created",
      "collecting_media",
      "processing_ai",
      "manual_review",
    ])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (exErr)
    return NextResponse.json({ error: exErr.message }, { status: 400 });

  if (existing) return NextResponse.json({ request: existing });

  const sessionId = crypto.randomUUID();
  const { data, error } = await supabase
    .from("age_verification_requests")
    .insert({ user_id: user.id, session_id: sessionId, status: "created" })
    .select("*")
    .single();

  if (error)
    return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ request: data });
}
