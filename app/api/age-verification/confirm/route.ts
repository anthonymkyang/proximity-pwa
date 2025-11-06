import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

// body: { requestId: string, kind: 'selfie'|'document_front'|'document_back', objectKey: string }
export async function POST(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { requestId, kind, objectKey } = await req.json();
  if (!requestId || !kind || !objectKey)
    return NextResponse.json(
      { error: "requestId, kind, objectKey required" },
      { status: 400 }
    );

  // Check ownership
  const { data: reqRow, error: rErr } = await supabase
    .from("age_verification_requests")
    .select("id,user_id,status")
    .eq("id", requestId)
    .maybeSingle();

  if (rErr) return NextResponse.json({ error: rErr.message }, { status: 400 });
  if (!reqRow || reqRow.user_id !== user.id)
    return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Upsert unique per (request_id, kind)
  const { data, error } = await supabase
    .from("age_verification_media")
    .upsert(
      { request_id: requestId, kind, object_key: objectKey },
      { onConflict: "request_id,kind" }
    )
    .select("*")
    .single();

  if (error)
    return NextResponse.json({ error: error.message }, { status: 400 });

  // Move request to collecting_media if still 'created'
  if (reqRow.status === "created") {
    await supabase
      .from("age_verification_requests")
      .update({ status: "collecting_media" })
      .eq("id", requestId);
  }

  return NextResponse.json({ media: data });
}
