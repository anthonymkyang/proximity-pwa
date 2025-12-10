import { NextResponse } from "next/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { createClient } from "@/utils/supabase/server";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  throw new Error("Missing Supabase env vars for wall messages endpoint");
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
  const { wall_id } = body ?? {};

  if (!wall_id || (typeof wall_id !== "string" && typeof wall_id !== "number")) {
    return NextResponse.json({ error: "wall_id_required" }, { status: 400 });
  }

  const admin = createAdminClient(SUPABASE_URL, SERVICE_ROLE_KEY);
  const { data, error } = await admin
    .from("wall_messages")
    .select("id,body,created_at,author_id")
    .eq("wall_id", wall_id)
    .order("created_at", { ascending: true });

  if (error || !data) {
    return NextResponse.json(
      { error: error?.message || "messages_load_failed" },
      { status: 400 }
    );
  }

  return NextResponse.json({ messages: data });
}
