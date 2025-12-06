import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const fromLat = searchParams.get("fromLat");
  const fromLon = searchParams.get("fromLon");
  const toLat = searchParams.get("toLat");
  const toLon = searchParams.get("toLon");
  const toName = searchParams.get("toName") ?? "Station";

  if (!fromLat || !fromLon || !toLat || !toLon) {
    return NextResponse.json(
      { error: "Missing coordinates" },
      { status: 400, headers: { "Access-Control-Allow-Origin": "*" } }
    );
  }

  const origin = `${fromLat},${fromLon}`;
  const destination = `${toLat},${toLon}`;
  const url = new URL(
    `https://api.tfl.gov.uk/Journey/JourneyResults/${origin}/to/${destination}`
  );
  url.searchParams.set("toName", toName);
  url.searchParams.set("timeIs", "departing");
  url.searchParams.set("nationalSearch", "false");
  url.searchParams.set("useRealTimeLiveArrivals", "true");

  try {
    const res = await fetch(url.toString(), { cache: "no-store" });
    if (!res.ok) {
      return NextResponse.json(
        { error: `TfL journey request failed ${res.status}` },
        { status: res.status, headers: { "Access-Control-Allow-Origin": "*" } }
      );
    }
    const data = await res.json();
    return NextResponse.json(data, {
      headers: {
        "Cache-Control": "public, max-age=60",
        "Access-Control-Allow-Origin": "*",
      },
    });
  } catch (e) {
    return NextResponse.json(
      { error: "TfL journey request failed" },
      { status: 503, headers: { "Access-Control-Allow-Origin": "*" } }
    );
  }
}
