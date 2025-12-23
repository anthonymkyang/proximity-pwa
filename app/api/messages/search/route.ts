import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

export async function POST(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
    error: userErr,
  } = await supabase.auth.getUser();

  if (userErr || !user) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }

  const payload = await req.json();
  const tokenHashes = Array.isArray(payload?.token_hashes)
    ? payload.token_hashes.filter(
        (token: unknown) => typeof token === "string" && token.length > 0
      )
    : [];

  if (!tokenHashes.length) {
    return NextResponse.json({ hits: [] }, { status: 200 });
  }

  const { data: hits, error } = await supabase
    .from("message_search_tokens")
    .select("message_id, token_hash, messages(conversation_id)")
    .eq("user_id", user.id)
    .in("token_hash", tokenHashes)
    .limit(500);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ hits: hits ?? [] }, { status: 200 });
}
