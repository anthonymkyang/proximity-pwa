"use client";

import { useEffect, useRef, useState } from "react";
import maplibregl, {
  type GeoJSONSource,
  type Map as MaplibreMap,
  type StyleSpecification,
} from "maplibre-gl";
import { Compass, Grid, Minus, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";

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
        geometry: { type: "Point", coordinates: [lon, lat] as [number, number] },
        properties: {
          ...(f.properties as Record<string, unknown>),
          displayName,
        },
      } as GeoJSON.Feature;
    })
    .filter(Boolean) as GeoJSON.Feature[];
  return { type: "FeatureCollection", features };
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

const normalizeCssColor = (input: string | null | undefined, fallback: string) => {
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
          const imageData = ctx.getImageData(
            0,
            0,
            canvas.width,
            canvas.height
          );
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
      const stopPoints: any[] = Array.isArray(stopPointsRaw) ? stopPointsRaw : [];
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

    let features = Array.from(bestByStation.values()).map((sp) => ({
      type: "Feature",
      geometry: { type: "Point", coordinates: [sp.lon, sp.lat] },
      properties: {
        id: sp.id,
        name: sp.commonName,
        modes: sp.modes,
        lines: (sp.lines ?? []).map((l: any) => l?.name).filter(Boolean),
      },
    }));

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
        .map((sp) => ({
          type: "Feature",
          geometry: {
            type: "Point",
            coordinates: [Number(sp.lon), Number(sp.lat)],
          },
          properties: {
            id: sp.id,
            name: sp.commonName,
            modes: sp.modes,
            lines: (sp.lines ?? []).map((l: any) => l?.name).filter(Boolean),
          },
        }));
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
          "text-font": ["Quicksand Regular"],
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
        "icon-size": ["interpolate", ["linear"], ["zoom"], 11, 0.34, 16, 0.48],
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

      const setView = (
        lng: number,
        lat: number,
        zoom = REQUESTED_ZOOM,
        pitch = MAP_PITCH
      ) => {
        if (!mapRef.current) return;
        mapRef.current.easeTo({
          center: [lng, lat],
          zoom,
          pitch,
          duration: 500,
        });
      };

      const centerToUser = () => {
        if (!("geolocation" in navigator)) {
          setView(FALLBACK_VIEW.lng, FALLBACK_VIEW.lat, FALLBACK_VIEW.zoom);
          return;
        }
        navigator.geolocation.getCurrentPosition(
          (pos) =>
            setView(
              pos.coords.longitude,
              pos.coords.latitude,
              REQUESTED_ZOOM,
              MAP_PITCH
            ),
          () =>
            setView(
              FALLBACK_VIEW.lng,
              FALLBACK_VIEW.lat,
              FALLBACK_VIEW.zoom,
              MAP_PITCH
            ),
          { enableHighAccuracy: true, timeout: 10_000, maximumAge: 30_000 }
        );
      };

      centerToUser();

      const handleResize = () => map.resize();
      window.addEventListener("resize", handleResize);

      return () => {
        window.removeEventListener("resize", handleResize);
        map.off("rotate", handleRotate);
        map.off("pitch", handleRotate);
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

  return (
    <div className="relative h-full w-full" aria-hidden>
      <div ref={containerRef} className="h-full w-full bg-background" />

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
    </div>
  );
}
