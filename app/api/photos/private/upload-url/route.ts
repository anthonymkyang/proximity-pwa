import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { createClient } from "@/utils/supabase/server";

export async function POST(req: Request) {
  try {
    // FIX: await Promise<SupabaseClient>
    const supabase = await createClient();

    const {
      data: { user },
      error: userErr,
    } = await supabase.auth.getUser();

    if (userErr) {
      return NextResponse.json({ error: userErr.message }, { status: 401 });
    }
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { ext } = await req.json();
    if (!ext) {
      return NextResponse.json({ error: "ext required" }, { status: 400 });
    }

    const objectKey = `${user.id}/${randomUUID()}.${String(ext).toLowerCase()}`;

    const { data, error } = await supabase.storage
      .from("profile_private")
      .createSignedUploadUrl(objectKey);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ uploadUrl: data.signedUrl, objectKey });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || "Unexpected error" },
      { status: 500 }
    );
  }
}
