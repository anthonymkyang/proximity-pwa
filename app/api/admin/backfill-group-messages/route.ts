import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const GROUP_URL_RE = /\/app\/activity\/groups\/([^/?#]+)/i;

const detectAction = (text: string | null | undefined) => {
  const value = String(text || "").toLowerCase();
  if (!value) return "update";
  if (value.includes("approved")) return "approved";
  if (value.includes("removed")) return "removed";
  if (value.includes("declined")) return "declined";
  if (value.includes("request")) return "request";
  if (value.includes("left")) return "left";
  return "update";
};

export async function POST(req: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    return NextResponse.json(
      { error: "Missing environment variables" },
      { status: 500 }
    );
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);
  const limit = 200;
  let offset = 0;
  let updated = 0;

  while (true) {
    const { data: rows, error } = await supabase
      .from("messages")
      .select("id, body, metadata, message_type")
      .eq("message_type", "link")
      .ilike("body", "%/app/activity/groups/%")
      .range(offset, offset + limit - 1);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (!rows || rows.length === 0) break;

    for (const row of rows) {
      const body = typeof row.body === "string" ? row.body : "";
      const metadata = row.metadata as any;
      const link = metadata?.link;
      const url = typeof link?.url === "string" ? link.url : body;
      const match = url.match(GROUP_URL_RE);
      if (!match) continue;

      const groupId = match[1];
      const title =
        typeof link?.title === "string" && link.title.trim().length
          ? link.title.trim()
          : "Group";
      const description =
        typeof link?.description === "string" && link.description.trim().length
          ? link.description.trim()
          : null;
      const action = detectAction(description || body);
      const messageText = description || body || `Group update: ${title}`;

      const { error: updErr } = await supabase
        .from("messages")
        .update({
          message_type: "group",
          body: messageText,
          metadata: {
            group: {
              id: groupId,
              title,
              action,
              message: description || null,
            },
          },
        })
        .eq("id", row.id);

      if (!updErr) {
        updated += 1;
      }
    }

    offset += rows.length;
    if (rows.length < limit) break;
  }

  return NextResponse.json({ updated });
}
