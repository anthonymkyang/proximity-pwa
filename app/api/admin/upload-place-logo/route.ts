import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const bucket = process.env.NEXT_PUBLIC_PLACE_LOGO_BUCKET || "place-logos";

if (!supabaseUrl || !serviceRoleKey) {
  // eslint-disable-next-line no-console
  console.error("[upload-place-logo] missing Supabase env vars");
}

const supabase = createClient(supabaseUrl, serviceRoleKey);

export async function POST(req: NextRequest) {
  try {
    if (!serviceRoleKey) {
      return NextResponse.json(
        { error: "Service role key not configured" },
        { status: 500 }
      );
    }

    const form = await req.formData();
    const file = form.get("file") as File | null;
    const slug = (form.get("slug") as string | null)?.trim();

    if (!file || !slug) {
      return NextResponse.json(
        { error: "file and slug are required" },
        { status: 400 }
      );
    }

    const finalPath = `places/${slug}/logo.png`;
    const arrayBuffer = await file.arrayBuffer();
    const inputBuffer = Buffer.from(arrayBuffer);

    // Resize server-side with sharp to 256x256 PNG if available; otherwise fallback to original
    let processedBuffer = inputBuffer;
    try {
      const sharp = (await import("sharp")).default;
      processedBuffer = await sharp(inputBuffer)
        .resize(256, 256, { fit: "cover" })
        .png()
        .toBuffer();
    } catch (err) {
      // eslint-disable-next-line no-console
      console.warn("[upload-place-logo] sharp unavailable, uploading original", err);
    }

    const { error: finalErr } = await supabase.storage
      .from(bucket)
      .upload(finalPath, processedBuffer, {
        contentType: "image/png",
        upsert: true,
      });
    if (finalErr) {
      return NextResponse.json({ error: finalErr.message }, { status: 500 });
    }

    const {
      data: { publicUrl },
    } = supabase.storage.from(bucket).getPublicUrl(finalPath);

    return NextResponse.json({ path: finalPath, publicUrl });
  } catch (e: any) {
    // eslint-disable-next-line no-console
    console.error("[upload-place-logo] error", e);
    return NextResponse.json(
        { error: e?.message ?? "Upload failed" },
        { status: 500 }
      );
  }
}
