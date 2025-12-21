"use client";

import React, { useEffect, useRef } from "react";
import maplibregl, {
  type Map as MaplibreMap,
  type StyleSpecification,
} from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { Users } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

type NearbyGroup = {
  id: string;
  name: string;
  location_lat?: number | null;
  location_lng?: number | null;
};

interface NearbyGroupsMapProps {
  groups: NearbyGroup[];
}

export function NearbyGroupsMap({ groups }: NearbyGroupsMapProps) {
  const mapRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<MaplibreMap | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [userLocation, setUserLocation] = React.useState<{
    lat: number;
    lng: number;
  }>({ lat: 51.5074, lng: -0.1276 }); // Default to London
  const [locationLoaded, setLocationLoaded] = React.useState(false);

  // Get user's current location
  React.useEffect(() => {
    if (typeof window !== "undefined" && navigator?.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setUserLocation({
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
          });
          setLocationLoaded(true);
        },
        () => {
          // Fallback to London if geolocation fails
          setLocationLoaded(true);
        },
        { enableHighAccuracy: false, timeout: 5000, maximumAge: 60_000 }
      );
    } else {
      setLocationLoaded(true);
    }
  }, []);

  useEffect(() => {
    if (!mapRef.current || mapInstanceRef.current || !locationLoaded) return;

    let canceled = false;

    const initMap = async () => {
      try {
        if (canceled || !mapRef.current) return;

        // Fetch style with fallback
        let style: StyleSpecification | string =
          "https://tiles.openfreemap.org/styles/positron";
        try {
          const styleRes = await fetch("/maps/proximity-dark.json");
          if (styleRes.ok) {
            style = (await styleRes.json()) as StyleSpecification;
          }
        } catch {
          // Use fallback style
        }

        if (canceled || !mapRef.current) return;

        // Center on user location
        const center: [number, number] = [userLocation.lng, userLocation.lat];
        const zoom = 13;

        // Get valid groups for markers
        const validGroups = groups.filter(
          (g) =>
            typeof g.location_lat === "number" &&
            typeof g.location_lng === "number"
        );

        const map = new maplibregl.Map({
          container: mapRef.current,
          style,
          center,
          zoom,
          pitch: 0,
          // @ts-expect-error antialias is supported
          antialias: true,
          attributionControl: false,
        });

        map.on("load", () => {
          if (canceled) {
            map.remove();
            return;
          }

          // Hide road numbers (A52, B357, etc.)
          const layers = map.getStyle()?.layers || [];
          layers.forEach((layer) => {
            if (
              layer.type === "symbol" &&
              layer.id.includes("road") &&
              (layer.id.includes("shield") ||
                layer.id.includes("ref") ||
                layer.id.includes("number"))
            ) {
              map.setLayoutProperty(layer.id, "visibility", "none");
            }
          });

          // Add marker for user location
          const userEl = document.createElement("div");
          userEl.className =
            "flex items-center justify-center rounded-full bg-blue-500 text-white shadow-lg ring-4 ring-blue-200";
          userEl.style.width = "24px";
          userEl.style.height = "24px";

          new maplibregl.Marker({ element: userEl })
            .setLngLat([userLocation.lng, userLocation.lat])
            .addTo(map);

          // Add markers for each valid group
          validGroups.forEach((group) => {
            const el = document.createElement("div");
            el.className =
              "flex items-center justify-center rounded-full bg-red-600 text-white shadow-lg cursor-pointer hover:bg-red-700 transition-colors";
            el.style.width = "40px";
            el.style.height = "40px";
            el.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" style="width:20px;height:20px;"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/></svg>`;
            el.title = group.name;

            new maplibregl.Marker({ element: el })
              .setLngLat([group.location_lng!, group.location_lat!])
              .addTo(map);
          });

          setLoading(false);
        });

        mapInstanceRef.current = map;
      } catch (error) {
        console.error("Failed to initialize map", error);
        setLoading(false);
      }
    };

    initMap();

    return () => {
      canceled = true;
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, [groups, userLocation, locationLoaded]);

  if (!groups.length) {
    return (
      <div className="relative w-full rounded-lg overflow-hidden border">
        <div ref={mapRef} className="h-96 w-full bg-muted/30" />
      </div>
    );
  }

  const validGroups = groups.filter(
    (g) =>
      typeof g.location_lat === "number" && typeof g.location_lng === "number"
  );

  return (
    <div className="relative w-full rounded-lg overflow-hidden bg-muted/20 border">
      {loading && (
        <div className="absolute inset-0 z-10 bg-background/50">
          <Skeleton className="h-full w-full" />
        </div>
      )}
      <div ref={mapRef} className="h-96 w-full bg-muted/30" />
    </div>
  );
}
