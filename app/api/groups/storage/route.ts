import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || null;

const supa = createClient(SUPABASE_URL, SERVICE_ROLE_KEY ?? ANON_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const DEFAULT_BUCKET =
  process.env.NEXT_PUBLIC_SUPABASE_GROUP_MEDIA_BUCKET || "group-media";

// GET /api/groups/storage?path=covers/xyz.jpg
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const rawPath = searchParams.get("path");
    if (!rawPath) {
      return NextResponse.json({ error: "Missing path" }, { status: 400 });
    }

    // normalize: remove leading slashes and optional "<bucket>/" prefix
    let path = decodeURIComponent(rawPath).replace(/^\/+/, "");
    if (path.toLowerCase().startsWith(`${DEFAULT_BUCKET.toLowerCase()}/`)) {
      path = path.slice(DEFAULT_BUCKET.length + 1);
    }

    // Prefer signed URL if we have service role, works for private buckets.
    if (SERVICE_ROLE_KEY) {
      const { data, error } = await supa.storage
        .from(DEFAULT_BUCKET)
        .createSignedUrl(path, 60 * 60 * 24 * 30); // 30 days
      if (!error && data?.signedUrl) {
        return NextResponse.redirect(data.signedUrl, {
          status: 302,
          headers: { "Cache-Control": "public, max-age=300, s-maxage=300" },
        });
      }
      // fall through to public url if signing fails
    }

    // Public URL fallback (works if bucket/object is public)
    const pub = supa.storage.from(DEFAULT_BUCKET).getPublicUrl(path);
    if (pub?.data?.publicUrl) {
      return NextResponse.redirect(pub.data.publicUrl, {
        status: 302,
        headers: { "Cache-Control": "public, max-age=300, s-maxage=300" },
      });
    }

    return NextResponse.json({ error: "File not accessible" }, { status: 404 });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || "Unexpected error" },
      { status: 500 }
    );
  }
}
