import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

// body: { kind: 'selfie' | 'document_front' | 'document_back', ext?: 'webp'|'jpeg'|'png' }
export async function POST(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { kind, ext = "webp" } = await req.json();
  if (!kind)
    return NextResponse.json({ error: "kind required" }, { status: 400 });

  // Ensure an active request exists
  const { data: avr, error: reqErr } = await supabase
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

  if (reqErr)
    return NextResponse.json({ error: reqErr.message }, { status: 400 });
  if (!avr)
    return NextResponse.json({ error: "No active request" }, { status: 400 });

  const objectKey = `${user.id}/${avr.session_id}/${kind}.${ext}`;
  const { data, error } = await supabase.storage
    .from("age-verification")
    .createSignedUploadUrl(objectKey);

  if (error)
    return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({
    uploadUrl: data.signedUrl,
    objectKey,
    requestId: avr.id,
  });
}
