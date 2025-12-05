// app/api/groups/[id]/attendees/leave/route.ts
import { NextRequest, NextResponse } from "next/server";
import { leaveGroupWithMessage } from "@/lib/groups/attendees";

// POST /api/groups/:id/attendees/leave
export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const groupId = id;

    if (!groupId) {
      return NextResponse.json({ error: "Missing group id" }, { status: 400 });
    }

    const body = await req.json().catch(() => ({}));
    const rawMessage = typeof body?.message === "string" ? body.message : null;

    const message =
      rawMessage && rawMessage.trim().length > 0
        ? rawMessage.trim().slice(0, 1000)
        : null;

    const result = await leaveGroupWithMessage({ groupId, message });

    return NextResponse.json(
      {
        ok: true,
        group_id: result.group_id,
        user_id: result.user_id,
      },
      { status: 200 }
    );
  } catch (e: any) {
    console.error("[leaveGroupWithMessage] error", e);
    const msg =
      typeof e?.message === "string" ? e.message : "Failed to leave group";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
