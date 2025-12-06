"use client";

import { useEffect, useRef, useState } from "react";
import maplibregl, {
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
