"use client";

import { useEffect, useRef } from "react";
import maplibregl, { Map } from "maplibre-gl";

type MapCanvasProps = {
  className?: string;
  /** optional initial center, default London */
  center?: [number, number];
  /** optional initial zoom */
  zoom?: number;
};

// allow re-use across fast refresh / route changes in dev
declare global {
  // eslint-disable-next-line no-var
  var __PROXIMITY_MAP__: Map | undefined;
}

export default function MapCanvas({
  className = "",
  center = [-0.1276, 51.5072], // London
  zoom = 12,
}: MapCanvasProps) {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<Map | null>(null);

  useEffect(() => {
    console.log("MapCanvas mounted");

    // guard for Next / hydration
    if (!mapContainerRef.current) return;

    // if we already have a global map (likely because of Fast Refresh), just re-use it
    if (typeof window !== "undefined" && window.__PROXIMITY_MAP__) {
      console.log("Reusing existing global map instance");
      mapRef.current = window.__PROXIMITY_MAP__;

      // rebind to current container if needed
      // MapLibre keeps the same canvas, so we just force a resize
      mapRef.current.resize();
      return;
    }

    console.log("Initializing new map instance");
    const map = new maplibregl.Map({
      container: mapContainerRef.current,
      style: "https://demotiles.maplibre.org/style.json", // public demo style
      center,
      zoom,
    });

    map.addControl(
      new maplibregl.NavigationControl({ showCompass: false }),
      "top-right"
    );

    mapRef.current = map;

    // store globally so subsequent mounts can reuse
    if (typeof window !== "undefined") {
      window.__PROXIMITY_MAP__ = map;
    }

    return () => {
      console.log("MapCanvas unmounted");

      // in dev we keep the global map so fast refresh / route edits don't kill it
      if (process.env.NODE_ENV === "production") {
        console.log("Cleaning up map instance (production)");
        map.remove();
        if (typeof window !== "undefined") {
          window.__PROXIMITY_MAP__ = undefined;
        }
      } else {
        console.log(
          "Skipping map.remove() in dev to preserve state across refreshes"
        );
      }
    };
  }, [center, zoom]);

  return (
    <div
      ref={mapContainerRef}
      className={`absolute inset-0 min-h-[calc(100dvh-3.5rem)] w-full ${className}`}
    />
  );
}
