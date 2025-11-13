// app/api/groups/storage/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || null;

const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY ?? ANON_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const DEFAULT_BUCKET =
  process.env.NEXT_PUBLIC_SUPABASE_GROUP_MEDIA_BUCKET || "group-media";

function normalizePath(raw: string): { path?: string; absoluteUrl?: string } {
  if (!raw) return {};
  const s = decodeURIComponent(raw.trim());
  // If a full http(s) URL was passed, just proxy it
  if (/^https?:\/\//i.test(s)) {
    return { absoluteUrl: s };
  }
  // Strip any leading slashes
  let path = s.replace(/^\/+/, "");
  // If the path includes the bucket name, strip it
  if (path.toLowerCase().startsWith(`${DEFAULT_BUCKET.toLowerCase()}/`)) {
    path = path.slice(DEFAULT_BUCKET.length + 1);
  }
  return { path };
}

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
    res.headers.get("cache-control") || "public, max-age=300, s-maxage=300"
  );
  return new NextResponse(res.body, { status: 200, headers });
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const rawPath = searchParams.get("path");
    if (!rawPath) {
      return NextResponse.json({ error: "Missing path" }, { status: 400 });
    }

    const { path, absoluteUrl } = normalizePath(rawPath);

    // If a full URL was provided, proxy it as-is
    if (absoluteUrl) {
      return proxyFetch(absoluteUrl);
    }

    if (!path) {
      return NextResponse.json({ error: "Invalid path" }, { status: 400 });
    }

    // 1) Try direct byte download (best for private buckets, avoids extra redirect)
    try {
      const { data, error } = await admin.storage
        .from(DEFAULT_BUCKET)
        .download(path);
      if (!error && data) {
        // Stream bytes back with a sensible content-type (fallback to octet-stream)
        const type = (data as any)?.type || "application/octet-stream"; // Blob.type when available
        const headers = new Headers({
          "content-type": type,
          "cache-control": "public, max-age=300, s-maxage=300",
        });
        // In modern runtimes Blob has .stream()
        const body =
          typeof (data as any).stream === "function"
            ? (data as any).stream()
            : data;
        return new NextResponse(body as any, { status: 200, headers });
      }
      // fall through to signed/public proxy
    } catch {
      // ignore, try signed/public below
    }

    // 2) Signed URL (works for private buckets)
    const { data: signed, error: signErr } = await admin.storage
      .from(DEFAULT_BUCKET)
      .createSignedUrl(path, 60 * 60); // 1 hour
    if (!signErr && signed?.signedUrl) {
      return proxyFetch(signed.signedUrl);
    }

    // 3) Public URL (if bucket/object is public)
    const { data: pub } = admin.storage.from(DEFAULT_BUCKET).getPublicUrl(path);
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
