"use client";

import React, { useEffect, useRef, useState } from "react";
import maplibregl, {
  type GeoJSONSource,
  type Map as MaplibreMap,
  type StyleSpecification,
} from "maplibre-gl";
import {
  Clock,
  BusFront,
  Compass,
  AlertCircle,
  Footprints,
  Grid,
  Minus,
  Plus,
  Globe,
  TrainFront,
  TrainFrontTunnel,
  Navigation,
  MessageCircle,
  User as UserIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import MapWeather from "./MapWeather";
import MapAvatar from "./MapAvatar";
import MapPlace from "./MapPlace";
import MapGroup from "./MapGroup";
import MapFiltering from "./MapFiltering";
import { createRoot, type Root } from "react-dom/client";
import { createClient } from "@/utils/supabase/client";
import { cn } from "@/lib/utils";

const LINE_COLORS: Record<string, string> = {
  bakerloo: "#B36305",
  central: "#E32017",
  circle: "#FFD300",
  district: "#00782A",
  "hammersmith & city": "#F3A9BB",
  jubilee: "#A0A5A9",
  metropolitan: "#9B0056",
  northern: "#000000",
  piccadilly: "#003688",
  victoria: "#0098D4",
  "waterloo & city": "#95CDBA",
  dlr: "#00AFAD",
  "elizabeth line": "#6950A1",
  "london overground": "#EE7C0E",
  overground: "#EE7C0E",
  tram: "#66CC00",
};

const getLineColor = (name: string) => {
  const key = name.trim().toLowerCase();
  return LINE_COLORS[key] ?? "#374151";
};

const getContrastingText = (color: string) => {
  const hex = color.replace("#", "");
  const normalized =
    hex.length === 3
      ? hex
          .split("")
          .map((c) => c + c)
          .join("")
      : hex;
  if (normalized.length !== 6) return "#0b0b0b";
  const r = parseInt(normalized.slice(0, 2), 16);
  const g = parseInt(normalized.slice(2, 4), 16);
  const b = parseInt(normalized.slice(4, 6), 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.7 ? "#0b0b0b" : "#ffffff";
};

const OPENFREEMAP_STYLE = "https://tiles.openfreemap.org/styles/positron";
const LOCAL_STYLE_PATH = "/maps/proximity-dark.json"; // place your Maputnik JSON here
const FALLBACK_VIEW = { lng: -0.1276, lat: 51.5074, zoom: 15 }; // London
const REQUESTED_ZOOM = 15;
const MAP_PITCH = 35;
const BUILDING_SOURCE_ID = "openfreemap-buildings";
const MAP_PADDING = { top: 16, right: 16, bottom: 96, left: 16 };
const TFL_STATIONS_URL = "/api/tfl-stations";
const TFL_DIRECT_URL =
  "https://api.tfl.gov.uk/StopPoint/Mode/tube,overground,dlr,national-rail";
const TFL_FALLBACK_URL = "/maps/tfl-fallback.geojson";
const EMPTY_FEATURE_COLLECTION: GeoJSON.FeatureCollection = {
  type: "FeatureCollection",
  features: [],
};
const cleanStationName = (name: string | null | undefined) => {
  if (!name) return "";
  return name
    .replace(/\s+(Underground|Railway|Rail|DLR|Overground)\s+Station.*$/i, "")
    .trim();
};

const formatTime = (timeStr: string | null | undefined) => {
  if (!timeStr) return "";
  const [hh, mm] = timeStr.split(":");
  const hours = Number(hh);
  const minutes = Number(mm);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return timeStr;
  const suffix = hours >= 12 ? "pm" : "am";
  const hour12 = hours % 12 === 0 ? 12 : hours % 12;
  if (minutes === 0) return `${hour12}${suffix}`;
  const paddedMinutes = minutes.toString().padStart(2, "0");
  return `${hour12}:${paddedMinutes}${suffix}`;
};
const sanitizeFeatures = (
  fc: GeoJSON.FeatureCollection
): GeoJSON.FeatureCollection => {
  if (!fc?.features) return EMPTY_FEATURE_COLLECTION;
  const features = fc.features
    .map((f) => {
      if (f?.geometry?.type !== "Point") return null;
      const coords = f.geometry.coordinates as any[];
      if (!Array.isArray(coords) || coords.length < 2) return null;
      const [lon, lat] = coords;
      if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
      const displayName = cleanStationName(
        (f.properties as any)?.displayName ?? (f.properties as any)?.name
      );
      return {
        type: "Feature",
        geometry: {
          type: "Point",
          coordinates: [lon, lat] as [number, number],
        },
        properties: {
          ...(f.properties as Record<string, unknown>),
          displayName,
        },
      } as GeoJSON.Feature;
    })
    .filter(Boolean) as GeoJSON.Feature[];
  return { type: "FeatureCollection", features };
};

const isPointGeometry = (
  geometry: GeoJSON.Geometry | null | undefined
): geometry is GeoJSON.Point => {
  if (!geometry) return false;
  return geometry.type === "Point" && Array.isArray(geometry.coordinates);
};

const hasRefToken = (field: unknown) => {
  if (typeof field === "string") return field.includes("{ref}");
  if (Array.isArray(field)) return JSON.stringify(field).includes('"ref"');
  return false;
};

const hideRoadNumbers = (map: MaplibreMap) => {
  const layers = map.getStyle().layers;
  if (!layers) return;
  layers.forEach((layer) => {
    if (layer.type !== "symbol" || !layer.layout) return;
    const textField = layer.layout["text-field"] as unknown;
    if (hasRefToken(textField)) {
      map.setLayoutProperty(layer.id, "visibility", "none");
    }
  });
};

const addBuildingExtrusions = (map: MaplibreMap) => {
  if (map.getSource(BUILDING_SOURCE_ID)) return;

  const labelLayerId = map
    .getStyle()
    .layers?.find(
      (layer) =>
        layer.type === "symbol" &&
        (layer.layout as { "text-field"?: unknown } | undefined)?.["text-field"]
    )?.id;

  map.addSource(BUILDING_SOURCE_ID, {
    url: "https://tiles.openfreemap.org/planet",
    type: "vector",
  });

  map.addLayer(
    {
      id: "3d-buildings",
      source: BUILDING_SOURCE_ID,
      "source-layer": "building",
      type: "fill-extrusion",
      minzoom: 15,
      filter: ["!=", ["get", "hide_3d"], true],
      paint: {
        "fill-extrusion-color": [
          "interpolate",
          ["linear"],
          ["get", "render_height"],
          0,
          "#0f1113",
          120,
          "#13171b",
          300,
          "#161b20",
        ],
        "fill-extrusion-height": [
          "interpolate",
          ["linear"],
          ["zoom"],
          15,
          0,
          16,
          ["get", "render_height"],
        ],
        "fill-extrusion-base": [
          "step",
          ["zoom"],
          0,
          16,
          ["coalesce", ["get", "render_min_height"], 0],
        ],
        "fill-extrusion-opacity": 0.4,
      },
    },
    labelLayerId
  );
};

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

const MODE_PRIORITY: Record<string, number> = {
  walking: 1,
  walk: 1,
  bicycle: 2,
  cycle: 2,
  bus: 3,
  coach: 3,
  tram: 3,
  dlr: 4,
  tube: 4,
  "london-overground": 4,
  overground: 4,
  "elizabeth-line": 4,
  rail: 5,
  train: 5,
  "national-rail": 5,
};

const normalizeMode = (mode: string) => mode.toLowerCase().replace(/\s+/g, "-");

const formatModeLabel = (mode: string) => {
  const normalized = normalizeMode(mode);
  switch (normalized) {
    case "walking":
    case "walk":
      return "Walk";
    case "bus":
      return "Bus";
    case "tube":
      return "Tube";
    case "dlr":
      return "DLR";
    case "london-overground":
    case "overground":
      return "Overground";
    case "elizabeth-line":
      return "Elizabeth line";
    case "tram":
      return "Tram";
    case "rail":
    case "train":
    case "national-rail":
      return "Train";
    case "bicycle":
    case "cycle":
      return "Cycle";
    case "coach":
      return "Coach";
    default:
      return mode || "Route";
  }
};

const getModeIcon = (normalizedMode: string) => {
  switch (normalizedMode) {
    case "walking":
    case "walk":
      return <Footprints className="h-4 w-4" />;
    case "bus":
    case "coach":
      return <BusFront className="h-4 w-4" />;
    case "tube":
    case "dlr":
    case "tram":
    case "london-overground":
    case "overground":
    case "elizabeth-line":
      return <TrainFrontTunnel className="h-4 w-4" />;
    case "rail":
    case "train":
    case "national-rail":
      return <TrainFront className="h-4 w-4" />;
    default:
      return null;
  }
};

const formatDuration = (minutes: number | undefined | null) => {
  if (!minutes || Number.isNaN(minutes)) return "";
  if (minutes < 60) return `${minutes} min`;
  const hrs = Math.floor(minutes / 60);
  const mins = Math.round(minutes % 60);
  if (mins === 0) return `${hrs} hr${hrs > 1 ? "s" : ""}`;
  return `${hrs} hr ${mins} min`;
};

const normalizeCssColor = (
  input: string | null | undefined,
  fallback: string
) => {
  if (typeof window === "undefined") return fallback;
  const canvas = document.createElement("canvas");
  canvas.width = 1;
  canvas.height = 1;
  const ctx = canvas.getContext("2d");
  if (!ctx) return fallback;
  ctx.fillStyle = fallback;
  ctx.fillRect(0, 0, 1, 1);

  if (input) {
    ctx.fillStyle = input;
    ctx.fillRect(0, 0, 1, 1);
  }

  const [r, g, b, a] = Array.from(ctx.getImageData(0, 0, 1, 1).data);
  const alpha = a / 255;
  if (alpha >= 1) {
    return `rgb(${r}, ${g}, ${b})`;
  }
  return `rgba(${r}, ${g}, ${b}, ${Number(alpha.toFixed(3))})`;
};

const resolveCssVarColor = (varName: string, fallback: string) => {
  if (typeof window === "undefined") return fallback;
  const raw = getComputedStyle(document.documentElement)
    .getPropertyValue(varName)
    .trim();
  if (!raw) return fallback;
  return normalizeCssColor(raw, fallback);
};

type JourneyLeg = {
  mode: string;
  normalizedMode: string;
  summary: string;
  duration?: number;
};

const InstructionWithLineBadges = ({ text }: { text: string }) => {
  if (!text) return null;
  const result: React.ReactNode[] = [];
  const tokenRegex =
    /(\b[A-Za-z]+ line\b)|(\b(?:[NC]?\d{1,3}[A-Z]?|[A-Z]\d{1,2})\b)/gi;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = tokenRegex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      result.push(text.slice(lastIndex, match.index));
    }
    const [full, lineMatch, busMatch] = match;
    if (lineMatch) {
      const lineName = lineMatch.replace(/ line/i, "").trim();
      const bg = getLineColor(lineName);
      const fg = getContrastingText(bg);
      result.push(
        <span
          key={`${lineMatch}-${match.index}`}
          className="inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold align-middle"
          style={{ backgroundColor: bg, color: fg }}
        >
          {lineMatch}
        </span>
      );
    } else if (busMatch) {
      result.push(
        <span
          key={`${busMatch}-${match.index}`}
          className="inline-flex items-center rounded-full bg-red-600 px-2 py-0.5 text-[11px] font-semibold text-white align-middle"
        >
          {busMatch}
        </span>
      );
    } else {
      result.push(full);
    }
    lastIndex = tokenRegex.lastIndex;
  }

  if (lastIndex < text.length) {
    result.push(text.slice(lastIndex));
  }

  return (
    <span className="whitespace-pre-wrap leading-relaxed">
      {result.map((node, idx) => (
        <React.Fragment key={idx}>{node}</React.Fragment>
      ))}
    </span>
  );
};

const addRoundelIcons = async (map: MaplibreMap) => {
  const ROUNDEL_BASE_DISPLAY_PX = 28;
  const ROUNDEL_PIXEL_RATIO = 2;
  const OUTLINE_COLOR = resolveCssVarColor(
    "--muted-foreground",
    "rgba(220,224,227,0.95)"
  );

  const loadSvg = async (id: string, url: string) => {
    if (map.hasImage(id)) return;
    const res = await fetch(url);
    const svg = await res.blob();

    const img = new Image();
    img.decoding = "async";
    const urlObj = URL.createObjectURL(svg);

    await new Promise((resolve, reject) => {
      img.onload = () => {
        const naturalWidth = img.naturalWidth || img.width || 1;
        const naturalHeight = img.naturalHeight || img.height || 1;
        const maxDim = Math.max(naturalWidth, naturalHeight) || 1;
        const targetMaxPx = ROUNDEL_BASE_DISPLAY_PX * ROUNDEL_PIXEL_RATIO;
        const scale = targetMaxPx / maxDim;
        const drawWidth = Math.max(1, Math.round(naturalWidth * scale));
        const drawHeight = Math.max(1, Math.round(naturalHeight * scale));

        const outlinePx = 4;
        const paddingPx = outlinePx + 2;

        const canvasWidth = drawWidth + paddingPx * 2;
        const canvasHeight = drawHeight + paddingPx * 2;

        const canvas = document.createElement("canvas");
        canvas.width = canvasWidth;
        canvas.height = canvasHeight;
        const ctx = canvas.getContext("2d");
        if (ctx) {
          const maskCanvas = document.createElement("canvas");
          maskCanvas.width = canvasWidth;
          maskCanvas.height = canvasHeight;
          const mctx = maskCanvas.getContext("2d");

          if (mctx) {
            for (let dx = -outlinePx; dx <= outlinePx; dx += 1) {
              for (let dy = -outlinePx; dy <= outlinePx; dy += 1) {
                if (dx === 0 && dy === 0) continue;
                const dist = Math.hypot(dx, dy);
                if (dist > outlinePx + 0.01) continue;
                mctx.drawImage(
                  img,
                  paddingPx + dx,
                  paddingPx + dy,
                  drawWidth,
                  drawHeight
                );
              }
            }
            mctx.globalCompositeOperation = "source-in";
            mctx.fillStyle = OUTLINE_COLOR;
            mctx.fillRect(0, 0, canvasWidth, canvasHeight);
            ctx.drawImage(maskCanvas, 0, 0);
          }

          ctx.drawImage(img, paddingPx, paddingPx, drawWidth, drawHeight);
          const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
          map.addImage(
            id,
            {
              width: canvas.width,
              height: canvas.height,
              data: imageData.data,
            },
            { pixelRatio: ROUNDEL_PIXEL_RATIO }
          );
        } else {
          map.addImage(id, img, { pixelRatio: ROUNDEL_PIXEL_RATIO });
        }
        URL.revokeObjectURL(urlObj);
        resolve(null);
      };
      img.onerror = reject;
      img.src = urlObj;
    });
  };

  await Promise.allSettled([
    loadSvg("roundel-tube", "/icons/tube.svg"),
    loadSvg("roundel-overground", "/icons/overground.svg"),
    loadSvg("roundel-dlr", "/icons/dlr.svg"),
    loadSvg("roundel-rail", "/icons/national_rail.svg"),
  ]);
};

const fetchStopsFromUrl = async (
  baseUrl: string
): Promise<GeoJSON.FeatureCollection> => {
  try {
    // eslint-disable-next-line no-console
    console.log("[map] fetching TfL stations from", baseUrl);
    const all: any[] = [];
    for (let page = 1; page <= 20; page += 1) {
      const res = await fetch(`${baseUrl}?page=${page}`, {
        cache: "no-store",
      });
      if (!res.ok) break;
      const json = await res.json();
      const stopPointsRaw = json?.stopPoints ?? json ?? [];
      const stopPoints: any[] = Array.isArray(stopPointsRaw)
        ? stopPointsRaw
        : [];
      all.push(...stopPoints);
      if (stopPoints.length < 1000) break; // pagination ends
    }

    const bestByStation = new Map<string, any>();
    for (const sp of all) {
      const type = (sp?.stopType as string) ?? "";
      if (!ALLOWED_STOP_TYPES.has(type)) continue;
      if (sp?.lat == null || sp?.lon == null) continue;
      const lat = Number(sp.lat);
      const lon = Number(sp.lon);
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

    type StationFeature = GeoJSON.Feature<
      GeoJSON.Point,
      Record<string, unknown>
    >;

    const toStationFeature = (sp: any): StationFeature => ({
      type: "Feature",
      geometry: {
        type: "Point",
        coordinates: [Number(sp.lon), Number(sp.lat)] as [number, number],
      },
      properties: {
        id: sp.id,
        name: sp.commonName,
        modes: sp.modes,
        lines: (sp.lines ?? []).map((l: any) => l?.name).filter(Boolean),
      },
    });

    let features: StationFeature[] = Array.from(bestByStation.values()).map(
      toStationFeature
    );

    // if filtering left us empty, fall back to any stop with coords
    if (features.length === 0) {
      features = all
        .filter(
          (sp) =>
            sp?.lat != null &&
            sp?.lon != null &&
            Number.isFinite(Number(sp.lat)) &&
            Number.isFinite(Number(sp.lon))
        )
        .map(toStationFeature);
      // eslint-disable-next-line no-console
      console.log("[map] fallback to unfiltered TfL stops", features.length);
    }
    const fc = sanitizeFeatures({ type: "FeatureCollection", features });
    // eslint-disable-next-line no-console
    console.log("[map] TfL stations fetched", fc.features.length);
    return fc;
  } catch (e) {
    // eslint-disable-next-line no-console
    console.warn("[map] tfl stations fetch failed", e);
    return EMPTY_FEATURE_COLLECTION;
  }
};

const fetchTflStations = async (): Promise<GeoJSON.FeatureCollection> => {
  const viaApi = await fetchStopsFromUrl(TFL_STATIONS_URL);
  if (viaApi.features.length > 0) return viaApi;

  const direct = await fetchStopsFromUrl(TFL_DIRECT_URL);
  if (direct.features.length > 0) return direct;

  const fallback = sanitizeFeatures(
    await fetch(TFL_FALLBACK_URL).then((r) => r.json())
  );
  // eslint-disable-next-line no-console
  console.log("[map] using fallback TfL stations", fallback?.features?.length);
  return fallback;
};

const addTflStations = async (map: MaplibreMap) => {
  try {
    const existing = map.getSource("tfl-stations") as GeoJSONSource | undefined;
    if (!existing) {
      map.addSource("tfl-stations", {
        type: "geojson",
        data: EMPTY_FEATURE_COLLECTION,
      });

      map.addLayer({
        id: "tfl-stations-label",
        type: "symbol",
        source: "tfl-stations",
        minzoom: 14,
        layout: {
          "text-field": ["coalesce", ["get", "displayName"], ["get", "name"]],
          "text-font": ["Quicksand Bold"],
          "text-size": ["interpolate", ["linear"], ["zoom"], 12, 10.5, 16, 13],
          "text-anchor": "top",
          "text-offset": [0, 0.9],
          "text-allow-overlap": true,
          "text-optional": true,
          "symbol-placement": "point",
        },
        paint: {
          "text-color": "#e8ecef",
          "text-halo-color": "rgba(0,0,0,0.85)",
          "text-halo-width": 1.5,
          "text-opacity": 0,
          "text-opacity-transition": { duration: 400, delay: 0 },
        },
      });

      map.addLayer({
        id: "tfl-stations-icon",
        type: "symbol",
        source: "tfl-stations",
        minzoom: 13,
        layout: {
          "icon-image": [
            "case",
            ["in", "tube", ["get", "modes"]],
            "roundel-tube",
            ["in", "overground", ["get", "modes"]],
            "roundel-overground",
            ["in", "dlr", ["get", "modes"]],
            "roundel-dlr",
            ["in", "national-rail", ["get", "modes"]],
            "roundel-rail",
            "roundel-rail",
          ],
          "icon-size": [
            "interpolate",
            ["linear"],
            ["zoom"],
            11,
            0.34,
            16,
            0.48,
          ],
          "icon-anchor": "center",
          "icon-allow-overlap": true,
          "text-allow-overlap": false,
          "symbol-placement": "point",
        },
        paint: {
          "icon-opacity": 0,
          "icon-opacity-transition": { duration: 400, delay: 0 },
        },
      });
    }

    const geojson = sanitizeFeatures(await fetchTflStations());
    const source = map.getSource("tfl-stations") as GeoJSONSource | undefined;
    source?.setData(geojson);
    if (geojson.features.length > 0) {
      map.setPaintProperty("tfl-stations-label", "text-opacity", 0.85);
      map.setPaintProperty("tfl-stations-icon", "icon-opacity", 0.95);
    }
    return geojson;
  } catch {
    // swallow errors to keep map rendering
    return EMPTY_FEATURE_COLLECTION;
  }
};

export default function MapCanvas() {
  const mapRef = useRef<MaplibreMap | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [bearing, setBearing] = useState(0);
  const [locationError, setLocationError] = useState(false);
  const [userLocation, setUserLocation] = useState<[number, number] | null>(
    null
  );
  const [selectedStation, setSelectedStation] = useState<{
    name: string;
    displayName?: string;
    modes?: string[];
    lines?: string[];
    coordinates?: [number, number];
    distanceKm?: number;
  } | null>(null);
  const [directions, setDirections] = useState<
    | { status: "idle" }
    | { status: "loading" }
    | { status: "error"; message: string }
    | {
        status: "ready";
        journeys: {
          id: string;
          durationMins: number;
          legs: {
            mode: string;
            normalizedMode: string;
            summary: string;
            duration?: number;
          }[];
        }[];
      }
  >({ status: "idle" });
  const instructionsRef = useRef<HTMLDivElement | null>(null);
  const [showScrollFadeBottom, setShowScrollFadeBottom] = useState(false);
  const [showScrollFadeTop, setShowScrollFadeTop] = useState(false);
  const friendMarkerRef = useRef<maplibregl.Marker | null>(null);
  const friendMarkerRootRef = useRef<Root | null>(null);
  const friendMarker2Ref = useRef<maplibregl.Marker | null>(null);
  const friendMarker2RootRef = useRef<Root | null>(null);
  const friendMarker3Ref = useRef<maplibregl.Marker | null>(null);
  const friendMarker3RootRef = useRef<Root | null>(null);
  const friendMarker4Ref = useRef<maplibregl.Marker | null>(null);
  const friendMarker4RootRef = useRef<Root | null>(null);
  const friendMarker5Ref = useRef<maplibregl.Marker | null>(null);
  const friendMarker5RootRef = useRef<Root | null>(null);
  const friendMarker6Ref = useRef<maplibregl.Marker | null>(null);
  const friendMarker6RootRef = useRef<Root | null>(null);
  const groupMarkerRef = useRef<maplibregl.Marker | null>(null);
  const groupMarkerRootRef = useRef<Root | null>(null);
  const placeMarkersRef = useRef<{ marker: maplibregl.Marker; root: Root }[]>(
    []
  );
  const stationsRef = useRef<GeoJSON.FeatureCollection | null>(null);
  const [profileName, setProfileName] = useState<string | null>(null);
  const [selectedPerson, setSelectedPerson] = useState<{
    name: string;
    presence: "online" | "away" | "offline";
    location?: [number, number];
  } | null>(null);
  const [places, setPlaces] = useState<
    {
      id: string;
      name: string;
      lat: number;
      lng: number;
      tz?: string | null;
      logo_url?: string | null;
      website?: string | null;
      category?: { name?: string | null; slug?: string | null } | null;
    }[]
  >([]);
  const [selectedPlace, setSelectedPlace] = useState<{
    id: string;
    name: string;
    lat: number;
    lng: number;
    tz?: string | null;
    logo_url?: string | null;
    website?: string | null;
    category?: { name?: string | null; slug?: string | null } | null;
  } | null>(null);
  const [placeHours, setPlaceHours] = useState<
    {
      day_of_week: number;
      open_time: string;
      close_time: string;
      is_closed?: boolean | null;
      is_24h?: boolean | null;
    }[]
  >([]);
  const [placeHoursByPlace, setPlaceHoursByPlace] = useState<
    Record<
      string,
      { day_of_week: number; open_time: string; close_time: string; is_24h?: boolean | null }[]
    >
  >({});
  const computePlaceStatusFor = (
    placeId: string,
    tz: string | null | undefined
  ) => {
    const tzName = tz || "UTC";
    const now = new Date();
    const tzNow = new Date(now.toLocaleString("en-US", { timeZone: tzName }));
    const minutesNow = tzNow.getHours() * 60 + tzNow.getMinutes();
    const day = tzNow.getDay();
    const entries = placeHoursByPlace[placeId];
    if (!entries || entries.length === 0) return null;
    const entry = entries.find((h) => h.day_of_week === day);
    if (!entry) return null;
    if (entry.is_24h) return "open" as const;
    const parseMinutes = (t: string) => {
      const [hh, mm] = t.split(":");
      const h = Number(hh);
      const m = Number(mm);
      if (!Number.isFinite(h) || !Number.isFinite(m)) return NaN;
      return h * 60 + m;
    };
    const openMins = parseMinutes(entry.open_time);
    const closeMins = parseMinutes(entry.close_time);
    if (!Number.isFinite(openMins) || !Number.isFinite(closeMins)) return null;

    const crossesMidnight = closeMins <= openMins;
    const isOpen = crossesMidnight
      ? minutesNow >= openMins || minutesNow < closeMins
      : minutesNow >= openMins && minutesNow < closeMins;

    if (isOpen) {
      const untilClose = crossesMidnight
        ? minutesNow >= openMins
          ? 24 * 60 - minutesNow + closeMins
          : closeMins - minutesNow
        : closeMins - minutesNow;
      return untilClose <= 60 ? ("closing" as const) : ("open" as const);
    }
    return "closed" as const;
  };
  const [placeHoursLoading, setPlaceHoursLoading] = useState(false);
  const [showDirectionsDrawer, setShowDirectionsDrawer] = useState(false);
  const [showStationDrawer, setShowStationDrawer] = useState(false);
  const [directionsTitle, setDirectionsTitle] = useState<string | null>(null);
  const [showPlaceDrawer, setShowPlaceDrawer] = useState(false);
  const [showGroupDrawer, setShowGroupDrawer] = useState(false);
  const [showGridDrawer, setShowGridDrawer] = useState(false);
  const gridScrollRef = useRef<HTMLDivElement | null>(null);
  const [gridTopFade, setGridTopFade] = useState(false);
  const [gridBottomFade, setGridBottomFade] = useState(false);

  const findNearestStation = (
    coords: [number, number]
  ):
    | {
        name: string;
        displayName: string;
        coordinates: [number, number];
        lines?: string[];
        modes?: string[];
        distanceKm?: number;
      }
    | null => {
    const stations = stationsRef.current?.features ?? [];
    if (!coords || stations.length === 0) return null;

    const toRad = (deg: number) => (deg * Math.PI) / 180;
    const [lon1, lat1] = coords;
    let nearest: {
      name: string;
      displayName: string;
      coordinates: [number, number];
      lines?: string[];
      modes?: string[];
      distanceKm?: number;
    } | null = null;
    let best = Number.POSITIVE_INFINITY;

    for (const feature of stations) {
      if (
        feature.geometry?.type !== "Point" ||
        !Array.isArray(feature.geometry.coordinates)
      ) {
        continue;
      }
      const [lon2, lat2] = feature.geometry.coordinates as [number, number];
      if (
        !Number.isFinite(lon2) ||
        !Number.isFinite(lat2) ||
        !Number.isFinite(lon1) ||
        !Number.isFinite(lat1)
      ) {
        continue;
      }
      const dLat = toRad(lat2 - lat1);
      const dLon = toRad(lon2 - lon1);
      const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(toRad(lat1)) *
          Math.cos(toRad(lat2)) *
          Math.sin(dLon / 2) *
          Math.sin(dLon / 2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      const distanceKm = 6371 * c;
      if (distanceKm < best) {
        best = distanceKm;
        const props = (feature.properties ?? {}) as Record<string, any>;
        nearest = {
          name: props.name || "Station",
          displayName: props.displayName || props.name || "Station",
          coordinates: [lon2, lat2],
          lines: props.lines ?? [],
          modes: props.modes ?? [],
          distanceKm: distanceKm,
        };
      }
    }
    return nearest;
  };

  const computePlaceStatus = () => {
    if (!selectedPlace) return null;
    const tz = selectedPlace.tz || "UTC";
    const now = new Date();
    const tzNow = new Date(now.toLocaleString("en-US", { timeZone: tz }));
    const minutesNow = tzNow.getHours() * 60 + tzNow.getMinutes();
    const day = tzNow.getDay(); // 0 Sunday ... 6 Saturday
    const daysShort = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

    const parseMinutes = (t: string) => {
      const [hh, mm] = t.split(":");
      const h = Number(hh);
      const m = Number(mm);
      if (!Number.isFinite(h) || !Number.isFinite(m)) return NaN;
      return h * 60 + m;
    };

    const entryToday = placeHours.find((h) => h.day_of_week === day);
    if (entryToday?.is_24h)
      return { state: "open" as const, closingSoon: false, closeLabel: "24h", is24h: true };

    const openMinsToday = entryToday ? parseMinutes(entryToday.open_time) : NaN;
    const closeMinsToday = entryToday ? parseMinutes(entryToday.close_time) : NaN;

    const isOpen = (() => {
      if (!entryToday) return false;
      if (!Number.isFinite(openMinsToday) || !Number.isFinite(closeMinsToday))
        return false;
      const crossesMidnight = closeMinsToday <= openMinsToday;
      return crossesMidnight
        ? minutesNow >= openMinsToday || minutesNow < closeMinsToday
        : minutesNow >= openMinsToday && minutesNow < closeMinsToday;
    })();

    if (isOpen) {
      const crossesMidnight = closeMinsToday <= openMinsToday;
      const untilClose = crossesMidnight
        ? minutesNow >= openMinsToday
          ? 24 * 60 - minutesNow + closeMinsToday
          : closeMinsToday - minutesNow
        : closeMinsToday - minutesNow;
      const closeLabel = formatTime(entryToday.close_time);
      return {
        state: untilClose <= 60 ? ("closing" as const) : ("open" as const),
        closingSoon: untilClose <= 30,
        closeLabel,
      };
    }

    // compute next opening
    let nextOpenLabel: string | null = null;
    for (let i = 0; i < 7; i++) {
      const targetDay = (day + i) % 7;
      const entry = placeHours.find((h) => h.day_of_week === targetDay);
      if (!entry || entry.is_24h) {
        if (entry?.is_24h) {
          const dayLabel = i === 0 ? "today" : i === 1 ? "tomorrow" : daysShort[targetDay];
          nextOpenLabel = `All day ${dayLabel}`;
          break;
        }
        continue;
      }
      const openMins = parseMinutes(entry.open_time);
      const closeMins = parseMinutes(entry.close_time);
      if (!Number.isFinite(openMins) || !Number.isFinite(closeMins)) continue;
      if (i === 0 && minutesNow >= closeMins) continue;
      if (i === 0 && minutesNow >= openMins && minutesNow < closeMins) continue;
      const dayLabel = i === 0 ? "today" : i === 1 ? "tomorrow" : daysShort[targetDay];
      nextOpenLabel = `${formatTime(entry.open_time)} ${dayLabel}`;
      break;
    }

    return { state: "closed" as const, nextOpenLabel };
  };

  const getStationIcon = (
    lines?: string[] | null,
    modes?: string[] | null
  ): string => {
    const lowerModes = (modes ?? []).map((m) => m.toLowerCase());
    const lowerLines = (lines ?? []).map((l) => l.toLowerCase());

    if (lowerModes.includes("national-rail")) return "/icons/national_rail.svg";
    if (lowerModes.includes("dlr") || lowerLines.includes("dlr"))
      return "/icons/dlr.svg";
    if (lowerModes.includes("overground") || lowerLines.includes("overground"))
      return "/icons/overground.svg";
    // default to tube roundel
    return "/icons/tube.svg";
  };

  const requestLocation = async (forcePrompt = false) => {
    if (typeof window === "undefined" || !("geolocation" in navigator)) {
      throw new Error("Geolocation unavailable");
    }

    const getOnce = () =>
      new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 10_000,
          maximumAge: forcePrompt ? 0 : 30_000,
        });
      });

    const promptWithWatch = () =>
      new Promise<GeolocationPosition>((resolve, reject) => {
        const watchId = navigator.geolocation.watchPosition(
          (pos) => {
            navigator.geolocation.clearWatch(watchId);
            resolve(pos);
          },
          (err) => {
            navigator.geolocation.clearWatch(watchId);
            reject(err);
          },
          {
            enableHighAccuracy: true,
            timeout: 10_000,
            maximumAge: 0,
          }
        );
        setTimeout(() => {
          navigator.geolocation.clearWatch(watchId);
          reject(new Error("Location timeout"));
        }, 12_000);
      });

    try {
      return await getOnce();
    } catch (err) {
      if (forcePrompt) {
        return await promptWithWatch();
      }
      throw err;
    }
  };

  const centerToUser = async (forcePrompt = false) => {
    try {
      setLocationError(false);
      const pos = await requestLocation(forcePrompt);
      const lng = pos.coords.longitude;
      const lat = pos.coords.latitude;
      if (Number.isFinite(lng) && Number.isFinite(lat)) {
        setUserLocation([lng, lat]);
        if (mapRef.current) {
          mapRef.current.easeTo({
            center: [lng, lat],
            zoom: REQUESTED_ZOOM,
            pitch: MAP_PITCH,
            duration: 500,
          });
        }
        return;
      }
      throw new Error("Invalid coordinates");
    } catch {
      setLocationError(true);
      setUserLocation(null);
      if (mapRef.current) {
        mapRef.current.easeTo({
          center: [FALLBACK_VIEW.lng, FALLBACK_VIEW.lat],
          zoom: FALLBACK_VIEW.zoom,
          pitch: MAP_PITCH,
          duration: 500,
        });
      }
    }
  };

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    let canceled = false;

    const loadStyle = async (): Promise<string | StyleSpecification> => {
      try {
        const res = await fetch(LOCAL_STYLE_PATH, { cache: "no-store" });
        if (res.ok) {
          return (await res.json()) as StyleSpecification;
        }
      } catch {
        // ignore and fall back
      }
      return OPENFREEMAP_STYLE;
    };

    const init = async () => {
      const style = await loadStyle();
      if (canceled) return;

      const map = new maplibregl.Map({
        container: containerRef.current as HTMLElement,
        style,
        center: [FALLBACK_VIEW.lng, FALLBACK_VIEW.lat],
        zoom: FALLBACK_VIEW.zoom,
        pitch: MAP_PITCH,
        // @ts-expect-error antialias is supported by MapLibre at runtime
        antialias: true,
        attributionControl: false,
      });

      mapRef.current = map;

      map.on("load", () => {
        hideRoadNumbers(map);
        addBuildingExtrusions(map);
        map.setPadding(MAP_PADDING);
        void (async () => {
          await addRoundelIcons(map);
          const stations = await addTflStations(map);
          stationsRef.current = stations;
        })();
      });

      const handleRotate = () => setBearing(map.getBearing());
      map.on("rotate", handleRotate);
      map.on("pitch", handleRotate);

      void centerToUser();

      const toArray = (value: unknown): string[] => {
        if (Array.isArray(value)) return value.map((v) => String(v));
        if (value == null) return [];
        if (typeof value === "string") {
          const trimmed = value.trim();
          if (trimmed.startsWith("[") && trimmed.endsWith("]")) {
            try {
              const parsed = JSON.parse(trimmed);
              if (Array.isArray(parsed)) return parsed.map((v) => String(v));
            } catch {
              // fall back to wrapping
            }
          }
          return [trimmed];
        }
        return [String(value)];
      };

      const handleStationClick = (e: maplibregl.MapLayerMouseEvent) => {
        const feature = e.features?.[0];
        if (!feature || !feature.geometry) return;
        const props = (feature.properties ?? {}) as Record<string, any>;
        const geometry = feature.geometry as GeoJSON.Geometry | undefined;
        const coords = isPointGeometry(geometry)
          ? (geometry.coordinates as [number, number])
          : undefined;
        setSelectedStation({
          name: props.name ?? props.displayName ?? "Station",
          displayName: props.displayName,
          modes: toArray(props.modes),
          lines: toArray(props.lines),
          coordinates: coords,
        });
        setShowStationDrawer(true);
        setDirections({ status: "loading" });
      };
      const handleStationMouseEnter = () => {
        map.getCanvas().style.cursor = "pointer";
      };
      const handleStationMouseLeave = () => {
        map.getCanvas().style.cursor = "";
      };

      const handleResize = () => map.resize();
      window.addEventListener("resize", handleResize);
      map.on("click", "tfl-stations-icon", handleStationClick);
      map.on("click", "tfl-stations-label", handleStationClick);
      map.on("mouseenter", "tfl-stations-icon", handleStationMouseEnter);
      map.on("mouseenter", "tfl-stations-label", handleStationMouseEnter);
      map.on("mouseleave", "tfl-stations-icon", handleStationMouseLeave);
      map.on("mouseleave", "tfl-stations-label", handleStationMouseLeave);

      return () => {
        window.removeEventListener("resize", handleResize);
        map.off("rotate", handleRotate);
        map.off("pitch", handleRotate);
        map.off("click", "tfl-stations-icon", handleStationClick);
        map.off("click", "tfl-stations-label", handleStationClick);
        map.off("mouseenter", "tfl-stations-icon", handleStationMouseEnter);
        map.off("mouseenter", "tfl-stations-label", handleStationMouseEnter);
        map.off("mouseleave", "tfl-stations-icon", handleStationMouseLeave);
        map.off("mouseleave", "tfl-stations-label", handleStationMouseLeave);
        map.remove();
        mapRef.current = null;
      };
    };

    const maybeCleanup = init();
    return () => {
      canceled = true;
      void maybeCleanup?.then((cleanup) => {
        if (typeof cleanup === "function") cleanup();
      });
      friendMarkerRef.current?.remove();
      friendMarkerRef.current = null;
      if (friendMarkerRootRef.current) {
        requestAnimationFrame(() => friendMarkerRootRef.current?.unmount());
        friendMarkerRootRef.current = null;
      }
      friendMarker2Ref.current?.remove();
      friendMarker2Ref.current = null;
      if (friendMarker2RootRef.current) {
        requestAnimationFrame(() => friendMarker2RootRef.current?.unmount());
        friendMarker2RootRef.current = null;
      }
      friendMarker3Ref.current?.remove();
      friendMarker3Ref.current = null;
      if (friendMarker3RootRef.current) {
        requestAnimationFrame(() => friendMarker3RootRef.current?.unmount());
        friendMarker3RootRef.current = null;
      }
      friendMarker4Ref.current?.remove();
      friendMarker4Ref.current = null;
      if (friendMarker4RootRef.current) {
        requestAnimationFrame(() => friendMarker4RootRef.current?.unmount());
        friendMarker4RootRef.current = null;
      }
      friendMarker5Ref.current?.remove();
      friendMarker5Ref.current = null;
      if (friendMarker5RootRef.current) {
        requestAnimationFrame(() => friendMarker5RootRef.current?.unmount());
        friendMarker5RootRef.current = null;
      }
      friendMarker6Ref.current?.remove();
      friendMarker6Ref.current = null;
      if (friendMarker6RootRef.current) {
        requestAnimationFrame(() => friendMarker6RootRef.current?.unmount());
        friendMarker6RootRef.current = null;
      }
      groupMarkerRef.current?.remove();
      groupMarkerRef.current = null;
      if (groupMarkerRootRef.current) {
        requestAnimationFrame(() => groupMarkerRootRef.current?.unmount());
        groupMarkerRootRef.current = null;
      }
      userMarkerRef.current?.remove();
      userMarkerRef.current = null;
      setDirectionsTitle(null);
      setShowPlaceDrawer(false);
      setShowGroupDrawer(false);
    };
  }, []);

  useEffect(() => {
    const loadProfile = async () => {
      const supabase = createClient();
      const userId = "fb66cdef-296f-48f9-9c6e-29114cce6624";
      const { data, error } = await supabase
        .from("profiles")
        .select("profile_title,name")
        .eq("id", userId)
        .maybeSingle();
      if (!error && data) {
        setProfileName(data.profile_title || data.name || null);
      }
    };
    void loadProfile();
  }, []);

  const userMarkerRef = useRef<maplibregl.Marker | null>(null);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (userLocation) {
      let marker = userMarkerRef.current;
      if (!marker) {
        const container = document.createElement("div");
        container.className =
          "pointer-events-none relative flex items-center justify-center";

        const ripple = document.createElement("span");
        ripple.className =
          "absolute inline-flex h-12 w-12 rounded-full bg-primary/35 animate-ping";
        ripple.style.animationDuration = "1.8s";

        const core = document.createElement("span");
        core.className =
          "relative inline-flex h-4 w-4 rounded-full bg-gradient-to-br from-primary via-primary to-primary/60";

        container.appendChild(ripple);
        container.appendChild(core);

        marker = new maplibregl.Marker({ element: container });
        userMarkerRef.current = marker;
      }
      marker.setLngLat(userLocation).addTo(map);
    } else if (userMarkerRef.current) {
      userMarkerRef.current.remove();
      userMarkerRef.current = null;
    }

    return () => {
      userMarkerRef.current?.remove();
      userMarkerRef.current = null;
    };
  }, [userLocation, profileName]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !userLocation) return;

    const [lon, lat] = userLocation;
    const nearby: [number, number] = [lon + 0.0025, lat + 0.0012];
    const nearby2: [number, number] = [lon - 0.002, lat + 0.0017];
    const nearby3: [number, number] = [lon + 0.0015, lat - 0.0015];
    const greenPark: [number, number] = [-0.1425, 51.5069];
    // Brixton marker (random nearby street)
    const brixton: [number, number] = [-0.1109, 51.4611];
    const nottingHill: [number, number] = [-0.1967, 51.5094];
    const stGilesHotel: [number, number] = [-0.1305, 51.5164];
    const avatarUrl =
      "/api/photos/avatars?path=fb66cdef-296f-48f9-9c6e-29114cce6624%2F1762977064388.jpg";
    const displayName = profileName || "Nearby user";

    let marker = friendMarkerRef.current;
    let root = friendMarkerRootRef.current;
    let marker2 = friendMarker2Ref.current;
    let root2 = friendMarker2RootRef.current;
    let marker3 = friendMarker3Ref.current;
    let root3 = friendMarker3RootRef.current;
    let marker4 = friendMarker4Ref.current;
    let root4 = friendMarker4RootRef.current;
    let marker5 = friendMarker5Ref.current;
    let root5 = friendMarker5RootRef.current;
    let marker6 = friendMarker6Ref.current;
    let root6 = friendMarker6RootRef.current;
    let groupMarker = groupMarkerRef.current;
    let groupRoot = groupMarkerRootRef.current;

    if (!marker) {
      const container = document.createElement("div");
      container.className =
        "pointer-events-auto drop-shadow-[0_8px_18px_rgba(0,0,0,0.45)]";
      root = createRoot(container);
      friendMarkerRootRef.current = root;
      marker = new maplibregl.Marker({ element: container, anchor: "center" });
      friendMarkerRef.current = marker;
    }

    if (!marker2) {
      const container = document.createElement("div");
      container.className =
        "pointer-events-auto drop-shadow-[0_8px_18px_rgba(0,0,0,0.45)]";
      root2 = createRoot(container);
      friendMarker2RootRef.current = root2;
      marker2 = new maplibregl.Marker({
        element: container,
        anchor: "center",
      });
      friendMarker2Ref.current = marker2;
    }

    if (!marker3) {
      const container = document.createElement("div");
      container.className =
        "pointer-events-auto drop-shadow-[0_8px_18px_rgba(0,0,0,0.45)]";
      root3 = createRoot(container);
      friendMarker3RootRef.current = root3;
      marker3 = new maplibregl.Marker({
        element: container,
        anchor: "center",
      });
      friendMarker3Ref.current = marker3;
    }

    if (!marker4) {
      const container = document.createElement("div");
      container.className =
        "pointer-events-auto drop-shadow-[0_8px_18px_rgba(0,0,0,0.45)]";
      root4 = createRoot(container);
      friendMarker4RootRef.current = root4;
      marker4 = new maplibregl.Marker({
        element: container,
        anchor: "center",
      });
      friendMarker4Ref.current = marker4;
    }

    if (!marker5) {
      const container = document.createElement("div");
      container.className =
        "pointer-events-auto drop-shadow-[0_8px_18px_rgba(0,0,0,0.45)]";
      root5 = createRoot(container);
      friendMarker5RootRef.current = root5;
      marker5 = new maplibregl.Marker({
        element: container,
        anchor: "center",
      });
      friendMarker5Ref.current = marker5;
    }

    if (!marker6) {
      const container = document.createElement("div");
      container.className =
        "pointer-events-auto drop-shadow-[0_8px_18px_rgba(0,0,0,0.45)]";
      root6 = createRoot(container);
      friendMarker6RootRef.current = root6;
      marker6 = new maplibregl.Marker({
        element: container,
        anchor: "center",
      });
      friendMarker6Ref.current = marker6;
    }

    if (!groupMarker) {
      const container = document.createElement("div");
      container.className =
        "pointer-events-auto drop-shadow-[0_8px_18px_rgba(0,0,0,0.45)]";
      groupRoot = createRoot(container);
      groupMarkerRootRef.current = groupRoot;
      groupMarker = new maplibregl.Marker({
        element: container,
        anchor: "center",
      });
      groupMarkerRef.current = groupMarker;
    }

    root?.render(
      <MapAvatar
        size={44}
        avatarUrl={avatarUrl}
        className="border-white/70 shadow-lg"
        alt={displayName}
        presence="away"
        onClick={() =>
          setSelectedPerson({
            name: displayName,
            presence: "away",
            location:
              (marker?.getLngLat().toArray() as [number, number]) ?? nearby,
          })
        }
      />
    );

    root2?.render(
      <MapAvatar
        size={44}
        avatarUrl={avatarUrl}
        className="border-white/70 shadow-lg"
        alt={displayName}
        presence="online"
        messages
        newMessages
        onClick={() =>
          setSelectedPerson({
            name: displayName,
            presence: "online",
            location:
              (marker2?.getLngLat().toArray() as [number, number]) ?? nearby2,
          })
        }
      />
    );

    root3?.render(
      <MapAvatar
        size={44}
        avatarUrl={avatarUrl}
        className="border-white/70 shadow-lg"
        alt={displayName}
        presence="offline"
        messages
        onClick={() =>
          setSelectedPerson({
            name: displayName,
            presence: "offline",
            location:
              (marker3?.getLngLat().toArray() as [number, number]) ?? nearby3,
          })
        }
      />
    );

    root4?.render(
      <MapAvatar
        size={44}
        avatarUrl={avatarUrl}
        className="border-white/70 shadow-lg"
        alt={displayName}
        presence="online"
        onClick={() =>
          setSelectedPerson({
            name: displayName,
            presence: "online",
            location:
              (marker4?.getLngLat().toArray() as [number, number]) ?? greenPark,
          })
        }
      />
    );

    root5?.render(
      <MapAvatar
        size={44}
        avatarUrl={avatarUrl}
        className="border-white/70 shadow-lg"
        alt={displayName}
        presence="away"
        onClick={() =>
          setSelectedPerson({
            name: displayName,
            presence: "away",
            location:
              (marker5?.getLngLat().toArray() as [number, number]) ?? brixton,
          })
        }
      />
    );

    root6?.render(
      <MapAvatar
        size={44}
        avatarUrl={avatarUrl}
        className="border-white/70 shadow-lg"
        alt={displayName}
        presence="online"
        onClick={() =>
          setSelectedPerson({
            name: displayName,
            presence: "online",
            location:
              (marker6?.getLngLat().toArray() as [number, number]) ??
              nottingHill,
          })
        }
      />
    );

    groupRoot?.render(
      <MapGroup size={32} onClick={() => setShowGroupDrawer(true)} />
    );

    marker?.setLngLat(nearby).addTo(map);
    marker2?.setLngLat(nearby2).addTo(map);
    marker3?.setLngLat(nearby3).addTo(map);
    marker4?.setLngLat(greenPark).addTo(map);
    marker5?.setLngLat(brixton).addTo(map);
    marker6?.setLngLat(nottingHill).addTo(map);
    groupMarker?.setLngLat(stGilesHotel).addTo(map);

    return () => {
      marker?.remove();
      marker2?.remove();
      marker3?.remove();
      marker4?.remove();
      marker5?.remove();
      marker6?.remove();
      groupMarker?.remove();
    };
  }, [userLocation, profileName]);

  useEffect(() => {
    return () => {
      setShowGroupDrawer(false);
    };
  }, []);

  useEffect(() => {
    const supabase = createClient();
    let active = true;
    const loadPlaces = async () => {
      const { data, error } = await supabase
        .from("places")
        .select(
          "id,name,lat,lng,tz,logo_url,website,category:places_categories(name,slug)"
        )
        .limit(100);
      if (!active) return;
      if (!error && Array.isArray(data)) {
        setPlaces(
          data
            .map((p) => ({
              id: p.id as string,
              name: p.name as string,
              lat: Number(p.lat),
              lng: Number(p.lng),
              tz: (p as any).tz ?? null,
              logo_url: (p as any).logo_url ?? null,
              website: (p as any).website ?? null,
              category: (p as any).category ?? null,
            }))
            .filter(
              (p) =>
                Number.isFinite(p.lat) &&
                Number.isFinite(p.lng) &&
                typeof p.name === "string"
            )
        );
      }
    };
    void loadPlaces();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    // cleanup old markers
    placeMarkersRef.current.forEach(({ marker, root }) => {
      marker.remove();
      requestAnimationFrame(() => root.unmount());
    });
    placeMarkersRef.current = [];

    const newMarkers: { marker: maplibregl.Marker; root: Root }[] = [];

    places.forEach((place) => {
      const status = computePlaceStatusFor(place.id, place.tz || "UTC");
      const container = document.createElement("div");
      container.className =
        "pointer-events-auto drop-shadow-[0_8px_18px_rgba(0,0,0,0.45)]";
      if (status?.state === "closed") {
        container.style.opacity = "0.4";
        container.style.filter = "grayscale(0.35)";
      }
      const root = createRoot(container);
      root.render(
        <MapPlace
          size={30}
          imageUrl={place.logo_url || "/logos/prowler.svg"}
          alt={place.name}
          status={status}
          onClick={() => {
            setSelectedPlace(place);
            setShowPlaceDrawer(true);
          }}
        />
      );
      const marker = new maplibregl.Marker({ element: container, anchor: "center" });
      marker.setLngLat([place.lng, place.lat]).addTo(map);
      newMarkers.push({ marker, root });
    });

    placeMarkersRef.current = newMarkers;

    return () => {
      newMarkers.forEach(({ marker, root }) => {
        marker.remove();
        requestAnimationFrame(() => root.unmount());
      });
    };
  }, [places, placeHoursByPlace]);

  useEffect(() => {
    let active = true;
    const fetchHours = async () => {
      if (!selectedPlace?.id) {
        setPlaceHours([]);
        return;
      }
      setPlaceHoursLoading(true);
      const supabase = createClient();
      const { data, error } = await supabase
        .from("place_hours")
        .select(
          "day_of_week, open_time::text, close_time::text, interval_index, is_24h"
        )
        .eq("place_id", selectedPlace.id)
        .order("day_of_week");
      if (!active) return;
      if (!error && Array.isArray(data)) {
        setPlaceHours(
          data.map((row) => ({
            day_of_week: Number(row.day_of_week),
            open_time: typeof row.open_time === "string" ? row.open_time : "",
            close_time: typeof row.close_time === "string" ? row.close_time : "",
            is_closed: false,
            is_24h: (row as any).is_24h ?? false,
          }))
        );
      } else {
        setPlaceHours([]);
      }
      setPlaceHoursLoading(false);
    };
    void fetchHours();
    return () => {
      active = false;
    };
  }, [selectedPlace]);

  useEffect(() => {
    let active = true;
    const fetchAllHours = async () => {
      if (places.length === 0) {
        setPlaceHoursByPlace({});
        return;
      }
      const supabase = createClient();
      const ids = places.map((p) => p.id);
      const { data, error } = await supabase
        .from("place_hours")
        .select("place_id, day_of_week, open_time::text, close_time::text, is_24h");
      if (!active) return;
      if (!error && Array.isArray(data)) {
        const grouped: Record<string, any[]> = {};
        data.forEach((row: any) => {
          const pid = row.place_id as string;
          if (!grouped[pid]) grouped[pid] = [];
          grouped[pid].push({
            day_of_week: Number(row.day_of_week),
            open_time: typeof row.open_time === "string" ? row.open_time : "",
            close_time: typeof row.close_time === "string" ? row.close_time : "",
            is_24h: row.is_24h ?? false,
          });
        });
        setPlaceHoursByPlace(grouped);
      } else {
        setPlaceHoursByPlace({});
      }
    };
    void fetchAllHours();
    return () => {
      active = false;
    };
  }, [places]);

  useEffect(() => {
    let canceled = false;
    const run = async () => {
      if (!selectedStation?.coordinates) {
        setDirections({ status: "idle" });
        return;
      }
      setDirections({ status: "loading" });

      const getPosition = () =>
        new Promise<GeolocationPosition>((resolve, reject) => {
          if (!("geolocation" in navigator)) {
            reject(new Error("Geolocation unavailable"));
            return;
          }
          navigator.geolocation.getCurrentPosition(resolve, reject, {
            enableHighAccuracy: true,
            timeout: 10_000,
            maximumAge: 30_000,
          });
        });

      let userPos: GeolocationPosition;
      try {
        userPos = await getPosition();
        const coords: [number, number] = [
          userPos.coords.longitude,
          userPos.coords.latitude,
        ];
        setUserLocation(coords);
      } catch {
        if (!canceled) {
          setDirections({
            status: "error",
            message: "Turn on location to get directions.",
          });
        }
        return;
      }

      const [stationLon, stationLat] = selectedStation.coordinates;
      const url = new URL("/api/tfl-journey", window.location.origin);
      url.searchParams.set("fromLat", userPos.coords.latitude.toString());
      url.searchParams.set("fromLon", userPos.coords.longitude.toString());
      url.searchParams.set("toLat", stationLat.toString());
      url.searchParams.set("toLon", stationLon.toString());
      url.searchParams.set(
        "toName",
        selectedStation.displayName || selectedStation.name || "Station"
      );

      try {
        const res = await fetch(url.toString(), { cache: "no-store" });
        const data = await res.json();
        if (!res.ok) {
          throw new Error(
            data?.error || `Directions request failed ${res.status}`
          );
        }
        const journeysRaw: any[] = Array.isArray(data?.journeys)
          ? data.journeys
          : [];
        const journeys = journeysRaw.slice(0, 4).map((journey, idx) => {
          const legs: JourneyLeg[] = (journey?.legs ?? []).map((leg: any) => {
            const modeName = leg?.mode?.name ?? "travel";
            const normalizedMode = normalizeMode(String(modeName));
            return {
              mode: modeName,
              normalizedMode,
              summary:
                leg?.instruction?.summary ??
                leg?.instruction?.detailed ??
                leg?.departurePoint?.commonName ??
                "Continue",
              duration: leg?.duration,
            };
          });

          const hasLongWalk = legs.some(
            (leg: JourneyLeg) =>
              leg.normalizedMode === "walking" && (leg.duration ?? 0) > 5
          );

          const journeyId =
            (journey?.startDateTime || journey?.arrivalDateTime || "journey") +
            `-${idx}`;

          return {
            id: journeyId,
            durationMins: journey?.duration ?? 0,
            legs,
            hasLongWalk,
          };
        });
        if (journeys.length === 0) throw new Error("No journeys found");
        journeys.sort((a, b) => {
          const aMode = a.legs[0]?.normalizedMode ?? "travel";
          const bMode = b.legs[0]?.normalizedMode ?? "travel";
          const aPri = MODE_PRIORITY[aMode] ?? 99;
          const bPri = MODE_PRIORITY[bMode] ?? 99;
          if (aPri !== bPri) return aPri - bPri;
          return (a.durationMins ?? 0) - (b.durationMins ?? 0);
        });
        if (!canceled) {
          setDirections({
            status: "ready",
            journeys,
          });
        }
      } catch (err: any) {
        if (!canceled) {
          setDirections({
            status: "error",
            message:
              err?.message && typeof err.message === "string"
                ? err.message
                : "Directions unavailable right now.",
          });
        }
      }
    };

    void run();
    return () => {
      canceled = true;
    };
  }, [selectedStation]);

  useEffect(() => {
    const el = instructionsRef.current;
    if (!el) {
      setShowScrollFadeBottom(false);
      setShowScrollFadeTop(false);
      return;
    }
    const update = () => {
      if (!instructionsRef.current) return;
      const { scrollTop, scrollHeight, clientHeight } = instructionsRef.current;
      const canScroll = scrollHeight > clientHeight + 1;
      const atBottom = scrollTop + clientHeight >= scrollHeight - 1;
      setShowScrollFadeBottom(canScroll && !atBottom);
      setShowScrollFadeTop(canScroll && scrollTop > 1);
    };
    update();
    el.addEventListener("scroll", update);
    window.addEventListener("resize", update);
    return () => {
      el.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, [directions]);

  useEffect(() => {
    const root = gridScrollRef.current;
    const viewport = root?.querySelector(
      '[data-slot="scroll-area-viewport"]'
    ) as HTMLDivElement | null;
    if (!viewport) return;
    const update = () => {
      const { scrollTop, scrollHeight, clientHeight } = viewport;
      setGridTopFade(scrollTop > 1);
      setGridBottomFade(scrollTop + clientHeight < scrollHeight - 1);
    };
    update();
    viewport.addEventListener("scroll", update, { passive: true });
    return () => viewport.removeEventListener("scroll", update);
  }, [showGridDrawer]);

  return (
    <div className="relative h-full w-full" aria-hidden>
      <div ref={containerRef} className="h-full w-full bg-background" />

      <div className="pointer-events-none absolute inset-x-0 top-0 h-24 bg-linear-to-b from-background to-transparent" />

      <MapFiltering />

      {userLocation ? <MapWeather coords={userLocation} className="top-20" /> : null}

      <div className="pointer-events-none absolute left-4 top-20">
        <Button
          size="icon-sm"
          variant="outline"
          className="pointer-events-auto h-9 w-9 rounded-full bg-background/70 backdrop-blur border-border/60 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.35),0_8px_24px_rgba(0,0,0,0.35)]"
          onClick={() => setShowGridDrawer(true)}
        >
          <Grid className="h-4 w-4" />
        </Button>
      </div>

      <div
        className="pointer-events-none absolute right-4 flex flex-col gap-2"
        style={{ bottom: `${MAP_PADDING.bottom + 8}px` }}
      >
        <div className="pointer-events-auto flex flex-col gap-2">
          <div className="overflow-hidden rounded-full border border-white/15 bg-background/50 backdrop-blur-md shadow-[inset_0_1px_0_0_rgba(255,255,255,0.35),0_8px_24px_rgba(0,0,0,0.35)]">
            <div className="flex flex-col divide-y divide-white/10">
              <Button
                size="icon-sm"
                variant="ghost"
                className="h-9 w-9 rounded-none border-0 text-foreground"
                onClick={() => mapRef.current?.zoomIn()}
              >
                <Plus className="h-4 w-4" />
              </Button>
              <Button
                size="icon-sm"
                variant="ghost"
                className="h-9 w-9 rounded-none border-0 text-foreground"
                onClick={() => mapRef.current?.zoomOut()}
              >
                <Minus className="h-4 w-4" />
              </Button>
            </div>
          </div>
          <Button
            size="icon-sm"
            variant="outline"
            className="h-9 w-9 rounded-full bg-background/70 backdrop-blur border-border/60"
            onClick={() =>
              mapRef.current?.easeTo({
                center: userLocation ?? [FALLBACK_VIEW.lng, FALLBACK_VIEW.lat],
                zoom: REQUESTED_ZOOM,
                bearing: 0,
                pitch: MAP_PITCH,
                duration: 400,
              })
            }
          >
            <Compass
              className="h-4 w-4 transition-transform"
              style={{ transform: `rotate(${bearing * -1}deg)` }}
            />
          </Button>
        </div>
      </div>

      <Drawer open={showGridDrawer} onOpenChange={setShowGridDrawer}>
        <DrawerContent>
          <DrawerHeader className="sr-only">
            <DrawerTitle>Grid</DrawerTitle>
          </DrawerHeader>
          <div className="relative px-4 pb-6 pt-2">
            <div ref={gridScrollRef}>
              <ScrollArea className="h-[60vh]">
                <div className="grid grid-cols-3 gap-3 py-2 pr-2">
                  {Array.from({ length: 36 }).map((_, idx) => (
                    <div
                      key={idx}
                      className="flex h-16 items-center justify-center rounded-lg border border-border/50 bg-background/70 text-xs text-muted-foreground"
                    >
                      Placeholder {idx + 1}
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </div>
            <div
              className={`pointer-events-none absolute inset-x-0 bottom-0 h-10 bg-gradient-to-t from-background to-transparent transition-opacity duration-200 ${
                gridBottomFade ? "opacity-100" : "opacity-0"
              }`}
            />
            <div
              className={`pointer-events-none absolute inset-x-0 top-0 h-10 bg-gradient-to-b from-background to-transparent transition-opacity duration-200 ${
                gridTopFade ? "opacity-100" : "opacity-0"
              }`}
            />
          </div>
        </DrawerContent>
      </Drawer>

      <Drawer
        open={!!selectedPerson}
        onOpenChange={(open) => {
          if (!open) setSelectedPerson(null);
        }}
      >
        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle className="flex items-center gap-2">
              <span>{selectedPerson?.name ?? "User"}</span>
              <span className="inline-flex items-center gap-1 rounded-full bg-primary px-2 py-0.5 text-[11px] font-semibold text-white">
                <Clock className="h-3 w-3" />
                Right now
              </span>
            </DrawerTitle>
            <DrawerDescription className="flex justify-start">
              {selectedPerson ? (
                <span className="inline-flex items-center gap-2 text-sm">
                  <span
                    className={cn(
                      "h-2.5 w-2.5 rounded-full",
                      selectedPerson.presence === "online"
                        ? "bg-emerald-500"
                        : selectedPerson.presence === "away"
                          ? "bg-amber-400"
                          : "bg-zinc-400"
                    )}
                    aria-hidden
                  />
                  <span className="text-foreground">
                    {selectedPerson.presence === "online"
                      ? "Online"
                      : selectedPerson.presence === "away"
                        ? "Away"
                        : "Offline"}
                  </span>
                </span>
              ) : null}
            </DrawerDescription>
          </DrawerHeader>
          <div className="grid grid-cols-3 gap-3 px-4 pb-6">
            <div className="flex flex-col items-center gap-2 rounded-2xl bg-card p-4 text-sm font-semibold shadow-[0_12px_28px_rgba(0,0,0,0.35)] backdrop-blur transition hover:bg-card/90">
              <UserIcon className="h-5 w-5 text-foreground" />
              <span>Profile</span>
            </div>
            <div className="flex flex-col items-center gap-2 rounded-2xl bg-card p-4 text-sm font-semibold shadow-[0_12px_28px_rgba(0,0,0,0.35)] backdrop-blur transition hover:bg-card/90">
              <MessageCircle className="h-5 w-5 text-foreground" />
              <span>Messages</span>
            </div>
            <div
              className="flex flex-col items-center gap-2 rounded-2xl bg-card p-4 text-sm font-semibold shadow-[0_12px_28px_rgba(0,0,0,0.35)] backdrop-blur transition hover:bg-card/90"
              onClick={() => {
                if (selectedPerson?.location) {
                  const nearest = findNearestStation(selectedPerson.location);
                  setSelectedStation(
                    nearest ?? {
                      name: selectedPerson.name,
                      displayName: selectedPerson.name,
                      lines: [],
                      modes: [],
                      coordinates: selectedPerson.location,
                    }
                  );
                  setDirectionsTitle(`Directions to ${selectedPerson.name}`);
                } else {
                  setDirectionsTitle("Directions");
                }
                setShowStationDrawer(false);
                setShowDirectionsDrawer(true);
              }}
            >
              <Navigation className="h-5 w-5 text-foreground" />
              <span>Directions</span>
            </div>
          </div>
        </DrawerContent>
      </Drawer>

      <Drawer
          open={showDirectionsDrawer}
          onOpenChange={setShowDirectionsDrawer}
        >
          <DrawerContent>
            <DrawerHeader>
              <DrawerTitle>
                {directionsTitle ||
                  selectedStation?.displayName ||
                  selectedStation?.name ||
                  "Directions"}
              </DrawerTitle>
            </DrawerHeader>
            <div className="flex flex-col gap-3 px-4 pb-4">
            {selectedStation ? (
              <div className="flex flex-col gap-1">
                <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                  Closest station
                </span>
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-card/80 px-3 py-1 text-xs font-semibold text-foreground shadow-[0_8px_18px_rgba(0,0,0,0.35)] backdrop-blur">
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-white -ml-1">
                      <img
                        src={getStationIcon(selectedStation?.lines, selectedStation?.modes)}
                        alt="Station icon"
                        className="h-4 w-4"
                      />
                    </span>
                    <span className="text-sm">
                      {selectedStation?.displayName ||
                        selectedStation?.name ||
                        "Nearest station"}
                    </span>
                  </span>
                </div>
              </div>
            ) : null}

            <div className="pt-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
              Journey options
            </div>

            {directions.status === "loading" && (
              <div className="space-y-2">
                <div className="h-3.5 w-24 animate-pulse rounded bg-muted/70" />
                <div className="space-y-2 rounded-lg border border-border/50 p-3">
                  <div className="h-4 w-32 animate-pulse rounded bg-muted/70" />
                  <div className="h-3 w-48 animate-pulse rounded bg-muted/60" />
                  <div className="h-3 w-40 animate-pulse rounded bg-muted/60" />
                </div>
              </div>
            )}
            {directions.status === "error" && (
              <span className="text-destructive text-sm">
                {directions.message}
              </span>
            )}
            {directions.status === "ready" &&
              directions.journeys.length > 0 && (
                <Tabs
                  defaultValue={directions.journeys[0]?.id}
                  className="w-full"
                >
                  <TabsList className="mb-2">
                    {directions.journeys.map((journey) => {
                      return (
                        <TabsTrigger
                          key={journey.id}
                          value={journey.id}
                          className="flex items-center gap-1.5 rounded-full border border-border/60 bg-background px-3 py-1 text-xs font-medium"
                        >
                          <span>{formatDuration(journey.durationMins)}</span>
                        </TabsTrigger>
                      );
                    })}
                  </TabsList>
                  <div className="relative">
                    <div
                      className="h-72 w-full overflow-y-auto [::-webkit-scrollbar]:hidden"
                      style={{ scrollbarWidth: "none" }}
                    >
                      {directions.journeys.map((journey) => (
                        <TabsContent key={journey.id} value={journey.id}>
                          <ul className="space-y-2 text-xs text-muted-foreground">
                            {journey.legs.map((leg, idx) => (
                              <li
                                key={`${journey.id}-${leg.summary}-${idx}`}
                                className="rounded-lg bg-muted/20 p-3"
                              >
                                <div className="flex items-center justify-between gap-3">
                                  <span className="flex items-center gap-2 font-semibold capitalize text-foreground">
                                    <span className="text-muted-foreground">
                                      {getModeIcon(leg.normalizedMode)}
                                    </span>
                                    {formatModeLabel(leg.mode)}
                                  </span>
                                  {leg.duration ? (
                                    <span className="text-muted-foreground text-[11px]">
                                      {leg.duration} min
                                    </span>
                                  ) : null}
                                </div>
                                <div className="mt-1 text-[13px] leading-relaxed text-muted-foreground">
                                  <InstructionWithLineBadges
                                    text={leg.summary}
                                  />
                                </div>
                              </li>
                            ))}
                          </ul>
                        </TabsContent>
                      ))}
                    </div>
                  </div>
                </Tabs>
              )}
          </div>
        </DrawerContent>
      </Drawer>

      <Drawer
        open={showPlaceDrawer}
        onOpenChange={(open) => {
          setShowPlaceDrawer(open);
          if (!open) setSelectedPlace(null);
        }}
      >
        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle className="flex items-center gap-2">
              <span className="relative inline-flex items-center gap-2">
                <span>{selectedPlace?.name ?? "Place"}</span>
                <span className="rounded-full bg-primary px-2 py-0.5 text-[11px] font-semibold text-white">
                  {selectedPlace?.category?.name || "Place"}
                </span>
              </span>
            </DrawerTitle>
          </DrawerHeader>
          <div className="space-y-3 px-4 pb-4 text-sm text-foreground">
            <Accordion
              type="single"
              collapsible
              className="rounded-2xl bg-card/90 shadow-[0_10px_30px_rgba(0,0,0,0.35)] backdrop-blur-md"
            >
              <AccordionItem value="opening-times" className="border-0">
                {(() => {
                  const statusInfo = computePlaceStatus();
                  const status = statusInfo?.state;
                  const statusLabel =
                    status === "open"
                      ? "Open now"
                      : status === "closing"
                        ? "Closing soon"
                        : "Closed";
                  const statusClass =
                    status === "closed"
                      ? "text-destructive"
                      : status === "open"
                        ? "text-emerald-400"
                        : undefined;
                  return (
                    <AccordionTrigger
                      className={cn(
                        "items-center px-4 py-3 text-left text-base font-semibold hover:no-underline [&>svg]:translate-y-0",
                        statusClass
                      )}
                    >
                      <span className="inline-flex items-center gap-2">
                        <span className={statusClass}>{statusLabel}</span>
                        {status !== "closed" && statusInfo?.closeLabel ? (
                          <span
                            className={cn(
                              "text-sm text-muted-foreground",
                              statusInfo.is24h
                                ? ""
                                : statusInfo.closingSoon
                                  ? "text-amber-400"
                                  : ""
                            )}
                          >
                            {statusInfo.is24h
                              ? "• Open 24 hours"
                              : `• Closes ${statusInfo.closeLabel}`}
                          </span>
                        ) : null}
                        {status === "closed" && statusInfo?.nextOpenLabel ? (
                          <span className="text-sm text-muted-foreground">
                            • Opens {statusInfo.nextOpenLabel}
                          </span>
                        ) : null}
                      </span>
                    </AccordionTrigger>
                  );
                })()}
                <AccordionContent className="px-4 pb-4">
                  {placeHoursLoading ? (
                    <div className="mt-2 space-y-2 text-muted-foreground">
                      {[1, 2, 3].map((i) => (
                        <Skeleton key={i} className="h-3 w-full rounded" />
                      ))}
                    </div>
                  ) : placeHours.length > 0 ? (
                    <>
                      {(() => {
                      const labels = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
                      const todayIdx = new Date().getDay();
                      const dayData = labels.map((label, idx) => {
                        const dow = (idx + 1) % 7;
                        const entry = placeHours.find((h) => h.day_of_week === dow);
                        let text = "—";
                        if (entry) {
                          text = entry.is_24h
                            ? "Open 24 hours"
                            : `${formatTime(entry.open_time)} – ${formatTime(entry.close_time)}`;
                        }
                        return { label, dow, text, isToday: todayIdx === dow };
                      });

                      const segments: { start: number; end: number; text: string; isToday: boolean }[] = [];
                      let current = { start: 0, end: 0, text: dayData[0].text, isToday: dayData[0].isToday };
                      for (let i = 1; i < dayData.length; i++) {
                        const day = dayData[i];
                        if (day.text === current.text) {
                          current.end = i;
                          current.isToday = current.isToday || day.isToday;
                        } else {
                          segments.push(current);
                          current = { start: i, end: i, text: day.text, isToday: day.isToday };
                        }
                      }
                      segments.push(current);

                      const isAllWeekSame = segments.length === 1 && segments[0].start === 0 && segments[0].end === 6;

                      return (
                        <ul className="mt-2 space-y-1 text-muted-foreground">
                          {segments.map((seg, idx) => {
                            const isTwoDayRange = seg.end === seg.start + 1;
                            const dayLabel = isAllWeekSame
                              ? "All week"
                              : seg.start === seg.end
                                ? dayData[seg.start].label
                                : isTwoDayRange
                                  ? `${dayData[seg.start].label} & ${dayData[seg.end].label}`
                                  : `${dayData[seg.start].label} – ${dayData[seg.end].label}`;
                            const isToday = seg.isToday;
                            const labelClass = isToday ? "font-semibold text-foreground" : "text-muted-foreground";
                            const timeClass = isToday ? "font-semibold text-foreground" : "text-muted-foreground";
                            return (
                              <li
                                key={`${dayLabel}-${idx}`}
                                className="grid grid-cols-[120px_1fr] items-start gap-x-4"
                              >
                                <span className={labelClass}>{dayLabel}</span>
                                <span className={timeClass}>{seg.text}</span>
                              </li>
                            );
                          })}
                        </ul>
                      );
                    })()}
                    </>
                  ) : (
                    <p className="mt-2 text-muted-foreground text-sm">
                      No hours provided.
                    </p>
                  )}
                </AccordionContent>
              </AccordionItem>
            </Accordion>
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col items-center gap-2 rounded-2xl bg-card p-4 text-sm font-semibold shadow-[0_12px_28px_rgba(0,0,0,0.35)] backdrop-blur transition hover:bg-card/90">
                <Globe className="h-5 w-5 text-foreground" />
                <button
                  type="button"
                  className="text-white"
                  onClick={() => {
                    if (selectedPlace?.website && typeof window !== "undefined") {
                      const url = selectedPlace.website.startsWith("http")
                        ? selectedPlace.website
                        : `https://${selectedPlace.website}`;
                      window.open(url, "_blank", "noopener,noreferrer");
                    }
                  }}
                  disabled={!selectedPlace?.website}
                >
                  Website
                </button>
              </div>
              <div
                className="flex flex-col items-center gap-2 rounded-2xl bg-card p-4 text-sm font-semibold shadow-[0_12px_28px_rgba(0,0,0,0.35)] backdrop-blur transition hover:bg-card/90"
                onClick={() => {
                  if (selectedPlace) {
                    const coords: [number, number] = [
                      selectedPlace.lng,
                      selectedPlace.lat,
                    ];
                    const nearest = findNearestStation(coords);
                    setSelectedStation(
                      nearest ?? {
                        name: selectedPlace.name,
                        displayName: selectedPlace.name,
                        lines: [],
                        modes: [],
                        coordinates: coords,
                      }
                    );
                    setDirectionsTitle(`Directions to ${selectedPlace.name}`);
                    setShowDirectionsDrawer(true);
                  }
                }}
              >
                <Navigation className="h-5 w-5 text-foreground" />
                <span>Directions</span>
              </div>
            </div>
          </div>
        </DrawerContent>
      </Drawer>

      <Drawer open={showGroupDrawer} onOpenChange={setShowGroupDrawer}>
        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle className="flex items-center gap-2">
              <span>TCR pump n dump</span>
              <span className="inline-flex items-center gap-1 rounded-full bg-red-600 px-2 py-0.5 text-[11px] font-semibold text-white">
                Pump n dump
              </span>
            </DrawerTitle>
          </DrawerHeader>
          <div className="grid grid-cols-3 gap-3 px-4 pb-6">
            <div className="flex flex-col items-center gap-2 rounded-2xl bg-card p-4 text-sm font-semibold shadow-[0_12px_28px_rgba(0,0,0,0.35)] backdrop-blur transition hover:bg-card/90">
              <UserIcon className="h-5 w-5 text-foreground" />
              <span>Details</span>
            </div>
            <div className="flex flex-col items-center gap-2 rounded-2xl bg-card p-4 text-sm font-semibold shadow-[0_12px_28px_rgba(0,0,0,0.35)] backdrop-blur transition hover:bg-card/90">
              <MessageCircle className="h-5 w-5 text-foreground" />
              <span>Host</span>
            </div>
            <div className="flex flex-col items-center gap-2 rounded-2xl bg-card p-4 text-sm font-semibold shadow-[0_12px_28px_rgba(0,0,0,0.35)] backdrop-blur transition hover:bg-card/90">
              <Navigation className="h-5 w-5 text-foreground" />
              <span>Directions</span>
            </div>
          </div>
        </DrawerContent>
      </Drawer>

      {locationError ? (
        <div className="pointer-events-none absolute right-4 top-4">
          <Button
            size="icon-sm"
            variant="outline"
            className="pointer-events-auto h-9 w-9 rounded-full border-destructive/70 text-destructive bg-background/80 backdrop-blur"
            onClick={() => {
              setLocationError(false);
              void centerToUser(true);
            }}
            aria-label="Retry location access"
          >
            <AlertCircle className="h-4 w-4" />
          </Button>
        </div>
      ) : null}

      <Drawer
        open={showStationDrawer}
        onOpenChange={(open) => {
          setShowStationDrawer(open);
          // keep selectedStation so directions drawer can reuse it
          if (!open) {
            setDirections({ status: "idle" });
          }
        }}
      >
        <DrawerContent>
          <DrawerHeader className="items-start">
            <DrawerTitle className="text-left">
              {selectedStation?.displayName ||
                selectedStation?.name ||
                "Station"}
            </DrawerTitle>
          </DrawerHeader>
          <div className="flex flex-col gap-3 px-4 pb-4">
            <div className="flex flex-wrap gap-2">
              {(() => {
                const lineTokens = Array.from(
                  new Set(
                    (selectedStation?.lines ?? [])
                      .map((l) => (l ?? "").toString().trim())
                      .filter(Boolean)
                      .filter((l) => !/[0-9]/.test(l))
                  )
                );
                if (lineTokens.length === 0) {
                  return (
                    <span className="text-muted-foreground text-sm">
                      Line info unavailable
                    </span>
                  );
                }
                return lineTokens.map((line) => (
                  <span
                    key={line}
                    className="rounded-full px-2 py-0.5 text-xs font-medium"
                    style={{
                      backgroundColor: getLineColor(line),
                      color: getContrastingText(getLineColor(line)),
                    }}
                  >
                    {line}
                  </span>
                ));
              })()}
            </div>
            {directions.status === "loading" && (
              <div className="space-y-2">
                <div className="h-3.5 w-24 animate-pulse rounded bg-muted/70" />
                <div className="space-y-2 rounded-lg border border-border/50 p-3">
                  <div className="h-4 w-32 animate-pulse rounded bg-muted/70" />
                  <div className="h-3 w-48 animate-pulse rounded bg-muted/60" />
                  <div className="h-3 w-40 animate-pulse rounded bg-muted/60" />
                </div>
              </div>
            )}
            {directions.status === "error" && (
              <span className="text-destructive text-sm">
                {directions.message}
              </span>
            )}
            {directions.status === "ready" &&
              directions.journeys.length > 0 && (
                <Tabs
                  defaultValue={directions.journeys[0]?.id}
                  className="w-full"
                >
                  <TabsList className="mb-2">
                    {directions.journeys.map((journey) => {
                      return (
                        <TabsTrigger
                          key={journey.id}
                          value={journey.id}
                          className="flex items-center gap-1.5 rounded-full border border-border/60 bg-background px-3 py-1 text-xs font-medium"
                        >
                          <span>{formatDuration(journey.durationMins)}</span>
                        </TabsTrigger>
                      );
                    })}
                  </TabsList>
                  <div className="relative">
                    <div
                      ref={instructionsRef}
                      className="h-72 w-full overflow-y-auto [::-webkit-scrollbar]:hidden"
                      style={{ scrollbarWidth: "none" }}
                    >
                      {directions.journeys.map((journey) => (
                        <TabsContent key={journey.id} value={journey.id}>
                          <ul className="space-y-2 text-xs text-muted-foreground">
                            {journey.legs.map((leg, idx) => (
                              <li
                                key={`${journey.id}-${leg.summary}-${idx}`}
                                className="rounded-lg border border-border/60 bg-muted/20 p-3"
                              >
                                <div className="flex items-center justify-between gap-3">
                                  <span className="flex items-center gap-2 font-semibold capitalize text-foreground">
                                    <span className="text-muted-foreground">
                                      {getModeIcon(leg.normalizedMode)}
                                    </span>
                                    {formatModeLabel(leg.mode)}
                                  </span>
                                  {leg.duration ? (
                                    <span className="text-muted-foreground text-[11px]">
                                      {leg.duration} min
                                    </span>
                                  ) : null}
                                </div>
                                <div className="mt-1 text-[13px] leading-relaxed text-muted-foreground">
                                  <InstructionWithLineBadges
                                    text={leg.summary}
                                  />
                                </div>
                              </li>
                            ))}
                          </ul>
                        </TabsContent>
                      ))}
                    </div>
                    <div
                      className="pointer-events-none absolute inset-x-0 bottom-0 h-10 bg-linear-to-t from-background to-transparent transition-opacity duration-200"
                      style={{ opacity: showScrollFadeBottom ? 1 : 0 }}
                    />
                    <div
                      className="pointer-events-none absolute inset-x-0 top-0 h-10 bg-linear-to-b from-background to-transparent transition-opacity duration-200"
                      style={{ opacity: showScrollFadeTop ? 1 : 0 }}
                    />
                  </div>
                </Tabs>
              )}
          </div>
        </DrawerContent>
      </Drawer>
    </div>
  );
}
import { Skeleton } from "@/components/ui/skeleton";
