// components/map/MapCanvas.tsx
"use client";

import { useEffect, useRef, useState } from "react";
import maplibregl, { Map } from "maplibre-gl";

export default function MapCanvas() {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<Map | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let aborted = false;

    async function init() {
      // 1. fetch the local style from public/
      const res = await fetch("/maps/proximity-dark.json", {
        cache: "no-cache",
      });
      if (!res.ok) {
        console.error("failed to load style:", res.status);
        return;
      }
      const style = await res.json();

      if (aborted) return;
      if (!containerRef.current) return;

      // 2. create map with THAT style
      const map = new maplibregl.Map({
        container: containerRef.current,
        style, // <- our local file, not the tileserver UI style
        center: [-0.1276, 51.5072],
        zoom: 11,
        attributionControl: false,
      });

      mapRef.current = map;

      // optional controls
      map.addControl(
        new maplibregl.NavigationControl({ showCompass: false }),
        "top-right"
      );

      map.on("load", () => {
        if (!aborted) setLoading(false);
      });
    }

    init();

    return () => {
      aborted = true;
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, []);

  return (
    <div style={{ position: "relative", width: "100%", height: "100%" }}>
      <div ref={containerRef} style={{ width: "100%", height: "100%" }} />
      {loading ? (
        <div
          style={{
            position: "absolute",
            inset: 0,
            pointerEvents: "none",
          }}
        />
      ) : null}
    </div>
  );
}
