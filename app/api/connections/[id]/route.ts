// app/api/connections/[id]/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

// GET /api/connections/:id -> fetch a single connection (owned by viewer)
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
    const resolvedParams = await params;
const connectionId = params?.id || req.url.split("/").pop();
  if (!connectionId) {
    return NextResponse.json(
      { error: "connection_id_required" },
      { status: 400 }
    );
  }

  const supabase = await createClient();
  const {
    data: { user },
    error: authErr,
  } = await supabase.auth.getUser();

  if (authErr || !user) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }

  const { data, error } = await supabase
    .from("connections")
    .select(
      `
        id,
        type,
        title,
        note,
        created_at,
        updated_at,
        last_interacted_at,
        connection_contacts:connection_contacts (
          profile_id,
          profiles:profiles!connection_contacts_profile_id_fkey (
            id,
            profile_title,
            avatar_url,
            username,
            date_of_birth,
            sexuality:sexualities!profiles_sexuality_id_fkey(label),
            position:positions!profiles_position_id_fkey(label)
          ),
          display_name,
          email,
          phone,
          handle,
          metadata
        ),
        connection_pins:connection_pins (
          pinned_profile_id,
          nickname,
          metadata,
          pinned_profile:profiles!connection_pins_pinned_profile_id_fkey (
            id,
            profile_title,
            avatar_url,
            username,
            date_of_birth,
            sexuality:sexualities!profiles_sexuality_id_fkey(label),
            position:positions!profiles_position_id_fkey(label)
          )
        )
      `
    )
    .eq("owner_id", user.id)
    .eq("id", connectionId)
    .maybeSingle();

  if (error) {
    return NextResponse.json(
      { error: "failed_to_load_connection", details: error.message },
      { status: 500 }
    );
  }

  if (!data) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  return NextResponse.json({ connection: data });
}

// DELETE /api/connections/:id -> remove a connection you own
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
    const resolvedParams = await params;
const connectionId = params?.id || req.url.split("/").pop();
  if (!connectionId) {
    return NextResponse.json(
      { error: "connection_id_required" },
      { status: 400 }
    );
  }

  const supabase = await createClient();
  const {
    data: { user },
    error: authErr,
  } = await supabase.auth.getUser();

  if (authErr || !user) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }

  const { error } = await supabase
    .from("connections")
    .delete()
    .eq("id", connectionId)
    .eq("owner_id", user.id);

  if (error) {
    return NextResponse.json(
      { error: "failed_to_delete_connection", details: error.message },
      { status: 500 }
    );
  }

  return NextResponse.json({ deleted: true });
}
