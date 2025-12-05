"use client";

import { useEffect, useRef } from "react";
import maplibregl, {
  type Map as MaplibreMap,
  type StyleSpecification,
} from "maplibre-gl";

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

      map.addControl(
        new maplibregl.NavigationControl({
          showCompass: true,
          visualizePitch: true,
        }),
        "top-right"
      );

      mapRef.current = map;

      map.on("load", () => {
        hideRoadNumbers(map);
        map.setPadding(MAP_PADDING);
      });

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

  return <div ref={containerRef} className="h-full w-full bg-background" aria-hidden />;
}
