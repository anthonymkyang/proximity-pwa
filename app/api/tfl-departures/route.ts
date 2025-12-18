import { NextResponse } from "next/server";

type Departure = {
  lineId: string | null;
  lineName: string | null;
  destinationName: string | null;
  direction: string | null;
  expectedArrival: string | null;
  platformName: string | null;
  timeToStationSec: number | null;
};

type TrainEdge = {
  time: string; // HH:MM (24h)
  lineId: string | null;
  lineName: string | null;
  destinationName: string | null;
};

const TFL_BASE = "https://api.tfl.gov.uk";

function addTflKeys(url: URL) {
  const appId = process.env.NEXT_PUBLIC_TFL_APP_ID ?? process.env.TFL_APP_ID;
  const appKey = process.env.NEXT_PUBLIC_TFL_APP_KEY ?? process.env.TFL_APP_KEY;
  if (appId) url.searchParams.set("app_id", appId);
  if (appKey) url.searchParams.set("app_key", appKey);
}

function asTimeString(totalMinutes: number) {
  const hh = Math.floor(totalMinutes / 60);
  const mm = totalMinutes % 60;
  return `${hh.toString().padStart(2, "0")}:${mm.toString().padStart(2, "0")}`;
}

const NIGHT_ROLLOVER_MINUTES = 4 * 60; // treat 00:00–03:59 as "tonight" (after midnight)

function cleanDestinationName(name: string | null | undefined): string | null {
  if (!name || typeof name !== "string") return null;
  // Remove " Underground Station" suffix
  return name.replace(/\s+Underground Station\s*$/i, "").trim() || null;
}

function getDirection(value: any): string | null {
  if (!value || typeof value !== "object") return null;
  const candidates = [value.direction, value.towards, value.destination];
  for (const c of candidates) {
    if (typeof c === "string" && c.trim()) {
      const trimmed = c.trim();
      // Extract direction like "Eastbound", "Westbound", etc.
      const match = trimmed.match(
        /\b(Northbound|Southbound|Eastbound|Westbound)\b/i
      );
      if (match) return match[1];
      return trimmed;
    }
  }
  return null;
}

function normalizeDirection(
  lineName: string | null,
  rawDirection: string | null,
  _destination: string | null
): string | null {
  if (!rawDirection) return null;

  // Already a compass direction
  const compass = rawDirection.match(
    /\b(Northbound|Southbound|Eastbound|Westbound)\b/i
  );
  if (compass) return compass[1];

  const dir = rawDirection.toLowerCase();
  const line = (lineName ?? "").toLowerCase();

  const eastWestLines = [
    "piccadilly",
    "central",
    "district",
    "metropolitan",
    "hammersmith",
    "circle",
    "jubilee",
  ];
  const northSouthLines = ["victoria", "northern", "bakerloo"];

  if (dir === "inbound" || dir === "outbound") {
    // TfL inbound/outbound often reverses for compass; align so tabs match actual train flow
    if (eastWestLines.some((l) => line.includes(l))) {
      return dir === "inbound" ? "Westbound" : "Eastbound";
    }
    if (northSouthLines.some((l) => line.includes(l))) {
      return dir === "inbound" ? "Southbound" : "Northbound";
    }
  }

  return rawDirection;
}

function getDestinationHint(value: any): string | null {
  if (!value || typeof value !== "object") return null;
  const candidates = [
    value.destinationName,
    value.towards,
    value.destination,
    value.to,
    value.toStationName,
    value.routeName,
    value.name,
  ];
  for (const c of candidates) {
    if (typeof c === "string" && c.trim()) return c.trim();
  }
  return null;
}

function collectTimes(
  root: any,
  opts: { maxNodes: number }
): Array<{ minutes: number; destinationName: string | null }> {
  const out: Array<{ minutes: number; destinationName: string | null }> = [];
  const seen = new Set<string>();
  const seenObjects = new WeakSet<object>();

  const stack: Array<{ value: any; dest: string | null }> = [
    { value: root, dest: null },
  ];

  let visited = 0;
  while (stack.length > 0) {
    const next = stack.pop();
    if (!next) break;
    const { value } = next;
    let dest = next.dest;

    visited += 1;
    if (visited > opts.maxNodes) break;

    if (!value) continue;

    if (typeof value === "string") {
      const m = value.match(/^\s*(\d{1,2}):(\d{2})\s*$/);
      if (m) {
        const hour = Number(m[1]);
        const minute = Number(m[2]);
        if (
          Number.isInteger(hour) &&
          Number.isInteger(minute) &&
          hour >= 0 &&
          hour <= 23 &&
          minute >= 0 &&
          minute <= 59
        ) {
          const minutes = hour * 60 + minute;
          const key = `${minutes}|${dest ?? ""}`;
          if (!seen.has(key)) {
            seen.add(key);
            out.push({ minutes, destinationName: dest });
          }
        }
      }
      continue;
    }

    if (typeof value === "object") {
      if (seenObjects.has(value as object)) continue;
      seenObjects.add(value as object);

      const hinted = getDestinationHint(value);
      if (hinted) dest = hinted;

      const hour = (value as any).hour;
      const minute = (value as any).minute;
      if (
        Number.isInteger(hour) &&
        Number.isInteger(minute) &&
        hour >= 0 &&
        hour <= 23 &&
        minute >= 0 &&
        minute <= 59
      ) {
        const minutes = hour * 60 + minute;
        const key = `${minutes}|${dest ?? ""}`;
        if (!seen.has(key)) {
          seen.add(key);
          out.push({ minutes, destinationName: dest });
        }
      }

      if (Array.isArray(value)) {
        for (let i = 0; i < value.length; i += 1) {
          stack.push({ value: value[i], dest });
        }
      } else {
        for (const v of Object.values(value)) {
          stack.push({ value: v, dest });
        }
      }
    }
  }

  return out;
}

function pickLastTonightAndFirstMorning(
  candidates: Array<{
    minutes: number;
    destinationName: string | null;
    lineId: string | null;
    lineName: string | null;
  }>
): { last: TrainEdge | null; first: TrainEdge | null } {
  if (candidates.length === 0) return { last: null, first: null };

  const adjusted = (m: number) =>
    m + (m < NIGHT_ROLLOVER_MINUTES ? 24 * 60 : 0);

  let lastIdx = 0;
  let bestLastAdj = adjusted(candidates[0].minutes);
  for (let i = 1; i < candidates.length; i += 1) {
    const adj = adjusted(candidates[i].minutes);
    if (adj > bestLastAdj) {
      bestLastAdj = adj;
      lastIdx = i;
    }
  }

  // First train "in the morning" = earliest scheduled time >= 04:00,
  // occurring after the last-train time (treat as next-day occurrence).
  let firstIdx: number | null = null;
  let bestFirstOcc = Number.POSITIVE_INFINITY;
  for (let i = 0; i < candidates.length; i += 1) {
    const m = candidates[i].minutes;
    if (m < NIGHT_ROLLOVER_MINUTES) continue;
    const occ = m + 24 * 60;
    if (occ > bestLastAdj && occ < bestFirstOcc) {
      bestFirstOcc = occ;
      firstIdx = i;
    }
  }

  const last = candidates[lastIdx];
  const first = firstIdx == null ? null : candidates[firstIdx];

  return {
    last: {
      time: asTimeString(last.minutes),
      lineId: last.lineId,
      lineName: last.lineName,
      destinationName: last.destinationName,
    },
    first: first
      ? {
          time: asTimeString(first.minutes),
          lineId: first.lineId,
          lineName: first.lineName,
          destinationName: first.destinationName,
        }
      : null,
  };
}

function extractStopPointIds(stopJson: any, fallbackId: string): string[] {
  const ids = new Set<string>();
  if (typeof fallbackId === "string" && fallbackId) ids.add(fallbackId);

  const pushIfString = (v: any) => {
    if (typeof v === "string" && v.trim()) ids.add(v.trim());
  };

  // children/platforms often live here
  const children: any[] = Array.isArray(stopJson?.children)
    ? stopJson.children
    : [];
  for (const c of children) {
    pushIfString(c?.id);
    pushIfString(c?.naptanId);
    pushIfString(c?.stationNaptan);
  }

  // keep it bounded
  return Array.from(ids).slice(0, 8);
}

function extractScheduleCandidatesFromArrivals(arrivals: any[]): Array<{
  minutes: number;
  destinationName: string | null;
  lineId: string | null;
  lineName: string | null;
}> {
  const candidates: Array<{
    minutes: number;
    destinationName: string | null;
    lineId: string | null;
    lineName: string | null;
  }> = [];

  for (const a of arrivals) {
    if (!a || typeof a !== "object") continue;
    const lineId = typeof a.lineId === "string" ? a.lineId : null;
    const lineName = typeof a.lineName === "string" ? a.lineName : null;
    const destinationName =
      typeof a.destinationName === "string" ? a.destinationName : null;

    // Per TfL docs, schedule/timetable data may exist on arrivals.
    const roots = [
      a.timetable,
      a.timetableToStation,
      a.timetableToStation?.timetable,
      a.timetableToStation?.timetable?.entries,
      a?.timetable?.entries,
      a?.schedule,
    ].filter(Boolean);
    if (roots.length === 0) continue;

    for (const r of roots) {
      const times = collectTimes(r, { maxNodes: 9000 });
      for (const t of times) {
        candidates.push({
          minutes: t.minutes,
          destinationName: t.destinationName ?? destinationName,
          lineId,
          lineName,
        });
      }
    }
  }

  return candidates;
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const stopPointId = searchParams.get("stopPointId");

  if (!stopPointId) {
    return NextResponse.json({ error: "Missing stopPointId" }, { status: 400 });
  }

  try {
    const arrivalsUrl = new URL(
      `${TFL_BASE}/StopPoint/${encodeURIComponent(stopPointId)}/Arrivals`
    );
    addTflKeys(arrivalsUrl);

    const stopUrl = new URL(
      `${TFL_BASE}/StopPoint/${encodeURIComponent(stopPointId)}`
    );
    addTflKeys(stopUrl);

    const [arrivalsRes, stopRes] = await Promise.all([
      fetch(arrivalsUrl.toString(), { cache: "no-store" }),
      fetch(stopUrl.toString(), { cache: "no-store" }),
    ]);

    const arrivalsJson = arrivalsRes.ok ? await arrivalsRes.json() : [];
    const stopJson = stopRes.ok ? await stopRes.json() : null;

    const departures: Departure[] = Array.isArray(arrivalsJson)
      ? arrivalsJson
          .map((a: any): Departure => {
            const lineName =
              typeof a?.lineName === "string" ? a.lineName : null;
            const destinationName = cleanDestinationName(a?.destinationName);
            const rawDirection = getDirection(a);
            return {
              lineId: typeof a?.lineId === "string" ? a.lineId : null,
              lineName,
              destinationName,
              direction: normalizeDirection(
                lineName,
                rawDirection,
                destinationName
              ),
              expectedArrival:
                typeof a?.expectedArrival === "string"
                  ? a.expectedArrival
                  : null,
              platformName:
                typeof a?.platformName === "string" ? a.platformName : null,
              timeToStationSec:
                typeof a?.timeToStation === "number" &&
                Number.isFinite(a.timeToStation)
                  ? a.timeToStation
                  : null,
            };
          })
          .sort((a, b) => {
            const at = a.expectedArrival ? Date.parse(a.expectedArrival) : NaN;
            const bt = b.expectedArrival ? Date.parse(b.expectedArrival) : NaN;
            if (!Number.isFinite(at) && !Number.isFinite(bt)) return 0;
            if (!Number.isFinite(at)) return 1;
            if (!Number.isFinite(bt)) return -1;
            return at - bt;
          })
          .slice(0, 12)
      : [];

    // Compute "last train tonight" / "first train in the morning" from StopPoint arrivals
    // (direction inbound/outbound) and any timetable-like fields present in the response.
    const relatedStopIds = extractStopPointIds(stopJson, stopPointId);
    const directions: Array<"inbound" | "outbound"> = ["inbound", "outbound"];
    const scheduleArrivals: any[] = [];

    const scheduleFetches: Promise<void>[] = [];
    for (const spId of relatedStopIds) {
      for (const dir of directions) {
        scheduleFetches.push(
          (async () => {
            try {
              const url = new URL(
                `${TFL_BASE}/StopPoint/${encodeURIComponent(spId)}/Arrivals`
              );
              url.searchParams.set("direction", dir);
              addTflKeys(url);
              const res = await fetch(url.toString(), { cache: "no-store" });
              if (!res.ok) return;
              const json = await res.json();
              if (Array.isArray(json)) scheduleArrivals.push(...json);
            } catch {
              // ignore
            }
          })()
        );
      }
    }
    await Promise.allSettled(scheduleFetches);

    // TODO: first/last trains deferred

    // Fetch line statuses for involved lines
    const lineIds = Array.from(
      new Set(
        departures
          .map((d) => d.lineId)
          .filter((v): v is string => typeof v === "string" && v.trim())
      )
    ).slice(0, 8);

    const lineStatuses: Array<{
      lineId: string;
      lineName: string | null;
      status: string;
      reason?: string;
    }> = [];

    await Promise.allSettled(
      lineIds.map(async (id) => {
        try {
          const url = new URL(
            `${TFL_BASE}/Line/${encodeURIComponent(id)}/Status`
          );
          addTflKeys(url);
          const res = await fetch(url.toString(), { cache: "no-store" });
          if (!res.ok) return;
          const json = await res.json();
          if (!Array.isArray(json) || json.length === 0) return;
          const entry = json[0];
          const statusEntry = Array.isArray(entry?.lineStatuses)
            ? entry.lineStatuses[0]
            : null;
          const status =
            typeof statusEntry?.statusSeverityDescription === "string"
              ? statusEntry.statusSeverityDescription
              : "Status unavailable";
          const reason =
            typeof statusEntry?.reason === "string"
              ? statusEntry.reason
              : undefined;
          lineStatuses.push({
            lineId: id,
            lineName:
              typeof entry?.name === "string" ? entry.name : id.toUpperCase(),
            status,
            reason,
          });
        } catch {
          // ignore status fetch errors
        }
      })
    );

    return NextResponse.json(
      {
        stopPointId,
        departures,
        lastTrainToday: null,
        firstTrainAfterLast: null,
        lineStatuses,
      },
      {
        headers: {
          "Cache-Control": "public, max-age=20",
          "Access-Control-Allow-Origin": "*",
        },
      }
    );
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message ?? "Failed to fetch station board" },
      { status: 503 }
    );
  }
}
