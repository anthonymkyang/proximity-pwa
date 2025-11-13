// app/api/groups/[id]/attendees/request/route.ts
import { NextRequest, NextResponse } from "next/server";
import { requestToJoinGroup } from "@/lib/groups/attendees";

// POST /api/groups/:id/attendees/request
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const groupId = id;
    if (!groupId) {
      return NextResponse.json({ error: "Missing group id" }, { status: 400 });
    }

    const body = await req.json().catch(() => ({}));
    const message =
      typeof body?.message === "string" ? body.message.slice(0, 500) : null;

    const row = await requestToJoinGroup({ groupId, message });

    return NextResponse.json(
      {
        ok: true,
        group_id: row?.group_id,
        status: row?.status,
      },
      { status: 200 }
    );
  } catch (e: any) {
    console.error("[requestToJoinGroup] error", e);
    const msg =
      typeof e?.message === "string" ? e.message : "Failed to request to join";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
