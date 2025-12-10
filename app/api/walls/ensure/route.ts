import { NextResponse } from "next/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { createClient } from "@/utils/supabase/server";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  throw new Error("Missing Supabase env vars for wall ensure endpoint");
}

export async function POST(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return NextResponse.json({ error: "not_authenticated" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({} as any));
  const { owner_type, owner_id } = body ?? {};

  if (owner_type !== "place" && owner_type !== "cruising") {
    return NextResponse.json({ error: "invalid_owner_type" }, { status: 400 });
  }
  if (!owner_id || typeof owner_id !== "string") {
    return NextResponse.json({ error: "owner_id_required" }, { status: 400 });
  }

  const admin = createAdminClient(SUPABASE_URL, SERVICE_ROLE_KEY);
  const { data, error } = await admin
    .from("walls")
    .upsert(
      { owner_type, owner_id },
      { onConflict: "owner_type,owner_id" }
    )
    .select("id")
    .single();

  if (error || !data) {
    return NextResponse.json(
      { error: error?.message || "ensure_failed" },
      { status: 400 }
    );
  }

  return NextResponse.json({ id: data.id });
}
