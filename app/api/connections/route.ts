// app/api/connections/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

// GET /api/connections -> list connections for the authed user
// Optional query: ?target_profile_id=uuid to filter by pinned/contact profile
export async function GET(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
    error: authErr,
  } = await supabase.auth.getUser();

  if (authErr || !user) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }

  const url = new URL(req.url);
  const targetProfileId = url.searchParams.get("target_profile_id");

  let query = supabase
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
    .order("updated_at", { ascending: false });

  if (targetProfileId) {
    query = query.or(
      `connection_pins.pinned_profile_id.eq.${targetProfileId},connection_contacts.profile_id.eq.${targetProfileId}`
    );
  }

  const { data, error } = await query;

  if (error) {
    return NextResponse.json(
      { error: "failed_to_load_connections", details: error.message },
      { status: 500 }
    );
  }

  return NextResponse.json({ connections: data ?? [] });
}

// POST /api/connections -> create contact or pin
export async function POST(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
    error: authErr,
  } = await supabase.auth.getUser();

  if (authErr || !user) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const { type, target_profile_id, nickname, whatsapp, telegram } = body ?? {};

  if (type !== "contact" && type !== "pin") {
    return NextResponse.json(
      { error: "type must be contact or pin" },
      { status: 400 }
    );
  }

  if (!target_profile_id || typeof target_profile_id !== "string") {
    return NextResponse.json(
      { error: "target_profile_id required" },
      { status: 400 }
    );
  }

  if (type === "contact") {
    // avoid duplicate contacts for same profile
    const { data: existing } = await supabase
      .from("connections")
      .select("id")
      .eq("owner_id", user.id)
      .eq("type", "contact")
      .eq("connection_contacts.profile_id", target_profile_id)
      .maybeSingle();
    if (existing) {
      return NextResponse.json({ connection: existing }, { status: 200 });
    }

    const title = nickname?.trim() || "Contact";
    const { data: conn, error: connErr } = await supabase
      .from("connections")
      .insert({
        owner_id: user.id,
        type: "contact",
        title,
        note: null,
      })
      .select("id")
      .single();

    if (connErr || !conn) {
      return NextResponse.json(
        { error: connErr?.message || "failed_to_create_contact" },
        { status: 500 }
      );
    }

    const meta: Record<string, string> = {};
    if (whatsapp) meta.whatsapp = whatsapp;
    if (telegram) meta.telegram = telegram;

    const { error: detailErr } = await supabase
      .from("connection_contacts")
      .insert({
        connection_id: conn.id,
        profile_id: target_profile_id,
        display_name: title,
        handle: nickname?.trim() || null,
        metadata: meta,
      });

    if (detailErr) {
      return NextResponse.json(
        { error: detailErr.message || "failed_to_create_contact_detail" },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        connection: {
          id: conn.id,
          type: "contact",
          title,
          connection_contacts: [
            {
              profile_id: target_profile_id,
              display_name: title,
              handle: nickname?.trim() || null,
              metadata: meta,
            },
          ],
        },
      },
      { status: 201 }
    );
  }

  // pin
  // avoid duplicate pin for same profile
  const { data: existingPin } = await supabase
    .from("connections")
    .select("id")
    .eq("owner_id", user.id)
    .eq("type", "pin")
    .eq("connection_pins.pinned_profile_id", target_profile_id)
    .maybeSingle();
  if (existingPin) {
    return NextResponse.json({ connection: existingPin }, { status: 200 });
  }

  const title = nickname?.trim() || "Pinned profile";
  const { data: conn, error: connErr } = await supabase
    .from("connections")
    .insert({
      owner_id: user.id,
      type: "pin",
      title,
      note: null,
    })
    .select("id")
    .single();

  if (connErr || !conn) {
    return NextResponse.json(
      { error: connErr?.message || "failed_to_create_pin" },
      { status: 500 }
    );
  }

  const { error: detailErr } = await supabase
    .from("connection_pins")
    .insert({
      connection_id: conn.id,
      pinned_profile_id: target_profile_id,
      nickname: nickname?.trim() || null,
      metadata: {},
    });

  if (detailErr) {
    return NextResponse.json(
      { error: detailErr.message || "failed_to_create_pin_detail" },
      { status: 500 }
    );
  }

  return NextResponse.json(
    {
      connection: {
        id: conn.id,
        type: "pin",
        title,
        connection_pins: [
          {
            pinned_profile_id: target_profile_id,
            nickname: nickname?.trim() || null,
            metadata: {},
          },
        ],
      },
    },
    { status: 201 }
  );
}
