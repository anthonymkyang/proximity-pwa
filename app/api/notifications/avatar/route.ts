import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";

export async function POST() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authErr,
    } = await supabase.auth.getUser();

    if (authErr || !user) {
      return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supabaseUrl || !serviceKey) {
      return NextResponse.json(
        { error: "missing service role key" },
        { status: 500 }
      );
    }

    const admin = createAdminClient(supabaseUrl, serviceKey);
    const [contactRes, pinRes] = await Promise.all([
      admin
        .from("connection_contacts")
        .select("connection_id, connections!inner(owner_id)")
        .eq("profile_id", user.id),
      admin
        .from("connection_pins")
        .select("connection_id, connections!inner(owner_id)")
        .eq("pinned_profile_id", user.id),
    ]);

    const recipients = new Set<string>();
    const collectOwnerId = (row: any) => {
      const owner =
        row?.connections?.owner_id || row?.connections?.[0]?.owner_id || null;
      if (owner && owner !== user.id) {
        recipients.add(String(owner));
      }
    };

    (contactRes.data || []).forEach(collectOwnerId);
    (pinRes.data || []).forEach(collectOwnerId);

    if (!recipients.size) {
      return NextResponse.json({ ok: true, notified: 0 });
    }

    const rows = Array.from(recipients).map((recipientId) => ({
      recipient_id: recipientId,
      actor_id: user.id,
      type: "profile_avatar_changed",
      entity_type: "profile",
      entity_id: user.id,
    }));

    const { error: insertErr } = await admin
      .from("notifications")
      .insert(rows);
    if (insertErr) {
      return NextResponse.json(
        { error: insertErr.message || "failed to insert notifications" },
        { status: 500 }
      );
    }

    return NextResponse.json({ ok: true, notified: rows.length });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || "failed to send notifications" },
      { status: 500 }
    );
  }
}
