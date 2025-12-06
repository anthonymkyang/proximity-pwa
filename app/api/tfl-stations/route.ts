import { NextResponse } from "next/server";

const TFL_URL =
  "https://api.tfl.gov.uk/StopPoint/Mode/tube,overground,dlr,national-rail";

const ALLOWED_STOP_TYPES = new Set([
  "NaptanMetroStation",
  "NaptanRailStation",
  "NaptanLightRailStation",
]);

const STOP_TYPE_PRIORITY = new Map([
  ["NaptanMetroStation", 3],
  ["NaptanRailStation", 2],
  ["NaptanLightRailStation", 2],
]);

type Feature = {
  type: "Feature";
  geometry: { type: "Point"; coordinates: [number, number] };
  properties: {
    id: string;
    name: string;
    displayName: string;
    modes: string[];
    lines: string[];
  };
};

type FeatureCollection = { type: "FeatureCollection"; features: Feature[] };

let cached: FeatureCollection | null = null;
let cachedAt = 0;
const CACHE_MS = 5 * 60 * 1000; // 5 minutes

async function fetchTflStations(): Promise<FeatureCollection> {
  const now = Date.now();
  if (cached && now - cachedAt < CACHE_MS) {
    return cached;
  }

  const all: any[] = [];
  for (let page = 1; page <= 20; page += 1) {
    const res = await fetch(`${TFL_URL}?page=${page}`, { cache: "no-store" });
    if (!res.ok) break;
    const json = await res.json();
    const stopPoints: any[] = json?.stopPoints ?? json ?? [];
    all.push(...stopPoints);
    if (stopPoints.length < 1000) break;
  }

  const bestByStation = new Map<string, any>();
  for (const sp of all) {
    const type = (sp?.stopType as string) ?? "";
    if (!ALLOWED_STOP_TYPES.has(type)) continue;
    const lat = Number(sp?.lat);
    const lon = Number(sp?.lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;
    sp.lat = lat;
    sp.lon = lon;

    const key = (sp.stationNaptan as string) || sp.id;
    const priority = STOP_TYPE_PRIORITY.get(type) ?? 0;
    const existing = bestByStation.get(key);
    const existingPriority = existing
      ? STOP_TYPE_PRIORITY.get(existing.stopType as string) ?? 0
      : -1;
    if (!existing || priority >= existingPriority) {
      bestByStation.set(key, sp);
    }
  }

  const stripSuffix = (name: string | null | undefined) => {
    if (!name) return "";
    return name
      .replace(/\s+(Underground|Rail|DLR|Overground)\s*Station.*$/i, "")
      .trim();
  };

  const features: Feature[] = Array.from(bestByStation.values()).map((sp) => ({
    type: "Feature",
    geometry: { type: "Point", coordinates: [sp.lon, sp.lat] },
    properties: {
      id: sp.id,
      name: sp.commonName,
      displayName: stripSuffix(sp.commonName),
      modes: sp.modes ?? [],
      lines: (sp.lines ?? []).map((l: any) => l?.name).filter(Boolean),
    },
  }));

  cached = { type: "FeatureCollection", features };
  cachedAt = now;
  return cached;
}

export async function GET() {
  try {
    const data = await fetchTflStations();
    return NextResponse.json(data, {
      headers: {
        "Cache-Control": "public, max-age=60",
        "Access-Control-Allow-Origin": "*",
      },
    });
  } catch (e) {
    console.warn("[api/tfl-stations] failed", e);
    if (cached) {
      return NextResponse.json(cached, {
        headers: {
          "Cache-Control": "public, max-age=30",
          "Access-Control-Allow-Origin": "*",
        },
      });
    }
    return NextResponse.json(
      { type: "FeatureCollection", features: [] },
      {
        status: 503,
        headers: { "Access-Control-Allow-Origin": "*" },
      }
    );
  }
}
