import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

// body: { requestId: string }
export async function POST(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { requestId } = await req.json();
  if (!requestId)
    return NextResponse.json({ error: "requestId required" }, { status: 400 });

  const { data: reqRow, error: rErr } = await supabase
    .from("age_verification_requests")
    .select("id,user_id,status")
    .eq("id", requestId)
    .maybeSingle();

  if (rErr) return NextResponse.json({ error: rErr.message }, { status: 400 });
  if (!reqRow || reqRow.user_id !== user.id)
    return NextResponse.json({ error: "Not found" }, { status: 404 });

  // (Optionally) ensure at least selfie present
  const { data: selfies } = await supabase
    .from("age_verification_media")
    .select("id")
    .eq("request_id", requestId)
    .eq("kind", "selfie");

  if (!selfies || selfies.length === 0) {
    return NextResponse.json({ error: "Selfie is required" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("age_verification_requests")
    .update({ status: "processing_ai" })
    .eq("id", requestId)
    .select("*")
    .single();

  if (error)
    return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ request: data });
}
