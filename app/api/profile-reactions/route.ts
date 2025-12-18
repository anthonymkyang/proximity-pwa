import { createClient } from "@/utils/supabase/server";
import { NextRequest, NextResponse } from "next/server";

export const runtime = "edge";

// GET - Fetch current user's reaction for a specific profile
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const searchParams = request.nextUrl.searchParams;
  const toUserId = searchParams.get("to_user_id");

  if (!toUserId) {
    return NextResponse.json(
      { error: "to_user_id is required" },
      { status: 400 }
    );
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data, error } = await supabase
    .from("profile_reactions")
    .select("*")
    .eq("from_user_id", user.id)
    .eq("to_user_id", toUserId)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ reaction: data });
}

// POST - Create or update a profile reaction
export async function POST(request: NextRequest) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { to_user_id, reaction_type, context } = body;

  if (!to_user_id || !reaction_type) {
    return NextResponse.json(
      { error: "to_user_id and reaction_type are required" },
      { status: 400 }
    );
  }

  // Validate reaction type
  const validTypes = ["heart", "fire", "imp", "peeking"];
  if (!validTypes.includes(reaction_type)) {
    return NextResponse.json(
      { error: "Invalid reaction_type" },
      { status: 400 }
    );
  }

  // Upsert: update if exists, insert if not
  const { data, error } = await supabase
    .from("profile_reactions")
    .upsert(
      {
        from_user_id: user.id,
        to_user_id,
        reaction_type,
        context: context || "profile:react",
      },
      {
        onConflict: "from_user_id,to_user_id",
      }
    )
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ reaction: data });
}

// DELETE - Remove a profile reaction
export async function DELETE(request: NextRequest) {
  const supabase = await createClient();
  const searchParams = request.nextUrl.searchParams;
  const toUserId = searchParams.get("to_user_id");

  if (!toUserId) {
    return NextResponse.json(
      { error: "to_user_id is required" },
      { status: 400 }
    );
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { error } = await supabase
    .from("profile_reactions")
    .delete()
    .eq("from_user_id", user.id)
    .eq("to_user_id", toUserId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
