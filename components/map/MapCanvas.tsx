"use client";

import mapboxgl from "mapbox-gl";
import { useEffect, useRef } from "react";

export default function RealMap() {
  const mapContainer = useRef<HTMLDivElement>(null);

  useEffect(() => {
    mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN!;

    const initializeMap = (lng: number, lat: number) => {
      const map = new mapboxgl.Map({
        container: mapContainer.current!,
        style: "mapbox://styles/mapbox/standard",
        center: [lng, lat],
        zoom: 15,
        pitch: 60,
        config: {
          basemap: {
            lightPreset: "night",
            showPointOfInterestLabels: false,
          },
        },
      });

      return map;
    };

    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const { longitude, latitude } = pos.coords;
          const map = initializeMap(longitude, latitude);
          return () => map.remove();
        },
        () => {
          const map = initializeMap(-0.1276, 51.5072); // fallback to London
          return () => map.remove();
        },
        { enableHighAccuracy: true }
      );
    } else {
      const map = initializeMap(-0.1276, 51.5072); // fallback to London
      return () => map.remove();
    }
  }, []);

  return <div ref={mapContainer} className="absolute inset-0" />;
}
