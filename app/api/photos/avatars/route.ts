import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const BUCKET = "avatars";

if (!SUPABASE_URL) throw new Error("NEXT_PUBLIC_SUPABASE_URL is required.");
if (!SERVICE_ROLE_KEY)
  throw new Error("SUPABASE_SERVICE_ROLE_KEY is required.");

const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

async function proxyFetch(url: string) {
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) {
    return NextResponse.json(
      { error: `Upstream ${res.status}` },
      { status: res.status }
    );
  }
  const headers = new Headers();
  const ct = res.headers.get("content-type");
  if (ct) headers.set("content-type", ct);
  headers.set(
    "cache-control",
    res.headers.get("cache-control") || "private, max-age=60"
  );
  return new NextResponse(res.body, { status: 200, headers });
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const input = searchParams.get("path");
    if (!input)
      return NextResponse.json({ error: "Missing path" }, { status: 400 });

    let path = input.replace(/^\/+/, "");
    if (path.toLowerCase().startsWith(BUCKET + "/")) {
      path = path.slice(BUCKET.length + 1);
    }

    // Signed URL first, works for private buckets on device and simulator
    const { data: signed, error: signErr } = await admin.storage
      .from(BUCKET)
      .createSignedUrl(path, 60 * 60); // 1 hour

    if (!signErr && signed?.signedUrl) {
      return proxyFetch(signed.signedUrl);
    }

    // Fallback if the bucket or object is public
    const { data: pub } = admin.storage.from(BUCKET).getPublicUrl(path);
    if (pub?.publicUrl) {
      return proxyFetch(pub.publicUrl);
    }

    return NextResponse.json({ error: "Not found" }, { status: 404 });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || "Unexpected error" },
      { status: 500 }
    );
  }
}

export async function HEAD(req: NextRequest) {
  const res = await GET(req);
  return new NextResponse(null, { status: res.status, headers: res.headers });
}
