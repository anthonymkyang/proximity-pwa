"use server";

const buildTflUrl = (fromLat: string, fromLon: string, toLat: string, toLon: string, mode?: string) => {
  const base = `https://api.tfl.gov.uk/Journey/JourneyResults/${fromLat},${fromLon}/to/${toLat},${toLon}`;
  const url = new URL(base);
  url.searchParams.set("nationalSearch", "false");
  url.searchParams.set(
    "mode",
    mode ?? "tube,dlr,overground,bus,national-rail,walking"
  );
  const appId = process.env.NEXT_PUBLIC_TFL_APP_ID ?? process.env.TFL_APP_ID;
  const appKey = process.env.NEXT_PUBLIC_TFL_APP_KEY ?? process.env.TFL_APP_KEY;
  if (appId) url.searchParams.set("app_id", appId);
  if (appKey) url.searchParams.set("app_key", appKey);
  return url;
};

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const fromLat = searchParams.get("fromLat");
  const fromLon = searchParams.get("fromLon");
  const toLat = searchParams.get("toLat");
  const toLon = searchParams.get("toLon");
  const mode = searchParams.get("mode") ?? undefined;

  if (!fromLat || !fromLon || !toLat || !toLon) {
    return new Response(
      JSON.stringify({ error: "Missing coordinates" }),
      { status: 400, headers: { "content-type": "application/json" } }
    );
  }

  try {
    const url = buildTflUrl(fromLat, fromLon, toLat, toLon, mode);
    const res = await fetch(url.toString(), { cache: "no-store" });
    const text = await res.text();
    const contentType = res.headers.get("content-type") || "";
    if (!res.ok) {
      return new Response(text || "Failed to fetch directions", {
        status: res.status,
        headers: { "content-type": "text/plain" },
      });
    }
    if (contentType.includes("application/json")) {
      return new Response(text, {
        status: res.status,
        headers: { "content-type": "application/json" },
      });
    }
    return new Response(text, {
      status: res.status,
      headers: { "content-type": contentType || "text/plain" },
    });
  } catch (err: any) {
    return new Response(
      JSON.stringify({ error: err?.message ?? "Failed to fetch directions" }),
      { status: 500, headers: { "content-type": "application/json" } }
    );
  }
}
