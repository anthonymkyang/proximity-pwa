"use client";

import React, { useEffect, useRef, useState } from "react";
import maplibregl, {
  type GeoJSONSource,
  type Map as MaplibreMap,
  type StyleSpecification,
} from "maplibre-gl";
import {
  BusFront,
  Compass,
  AlertCircle,
  Footprints,
  Grid,
  Minus,
  Plus,
  TrainFront,
  TrainFrontTunnel,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";

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
        minzoom: 12.5,
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
        minzoom: 11,
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
  } catch {
    // swallow errors to keep map rendering
  }
};

export default function MapCanvas() {
  const mapRef = useRef<MaplibreMap | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [bearing, setBearing] = useState(0);
  const [locationError, setLocationError] = useState(false);
  const [selectedStation, setSelectedStation] = useState<{
    name: string;
    displayName?: string;
    modes?: string[];
    lines?: string[];
    coordinates?: [number, number];
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
        attributionControl: false,
      });

      mapRef.current = map;

      map.on("load", () => {
        hideRoadNumbers(map);
        map.setPadding(MAP_PADDING);
        void (async () => {
          await addRoundelIcons(map);
          await addTflStations(map);
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
    };
  }, []);

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

  return (
    <div className="relative h-full w-full" aria-hidden>
      <div ref={containerRef} className="h-full w-full bg-background" />

      <div className="pointer-events-none absolute inset-x-0 top-0 h-24 bg-linear-to-b from-background to-transparent" />

      <div className="pointer-events-none absolute left-4 top-4">
        <Button
          size="icon-sm"
          variant="outline"
          className="pointer-events-auto h-9 w-9 rounded-full bg-background/70 backdrop-blur border-border/60 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.35),0_8px_24px_rgba(0,0,0,0.35)]"
          onClick={() => {
            /* TODO: hook up grid action */
          }}
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
        open={!!selectedStation}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedStation(null);
            setDirections({ status: "idle" });
          }
        }}
      >
        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle>
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
