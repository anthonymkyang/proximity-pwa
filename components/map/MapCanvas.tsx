"use client";

import { useEffect, useRef } from "react";
import maplibregl, { Map } from "maplibre-gl";

type MapCanvasProps = {
  className?: string;
  center?: [number, number];
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

    if (!mapContainerRef.current) return;

    // re-use existing map in dev / fast-refresh
    if (typeof window !== "undefined" && window.__PROXIMITY_MAP__) {
      console.log("Reusing existing global map instance");
      mapRef.current = window.__PROXIMITY_MAP__;
      mapRef.current.resize();
      return;
    }

    const map = new maplibregl.Map({
      container: mapContainerRef.current,
      // 🔥 point to your running tileserver-gl (v3.1.1) inside Docker
      style: "/maps/proximity-dark.json",
      center,
      zoom,
      pixelRatio: 1,
      attributionControl: false,
    });

    map.addControl(
      new maplibregl.NavigationControl({ showCompass: false }),
      "top-right"
    );

    mapRef.current = map;

    if (typeof window !== "undefined") {
      window.__PROXIMITY_MAP__ = map;
    }

    return () => {
      console.log("MapCanvas unmounted");
      // keep it alive in dev
      if (process.env.NODE_ENV === "production") {
        map.remove();
        if (typeof window !== "undefined") {
          window.__PROXIMITY_MAP__ = undefined;
        }
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
