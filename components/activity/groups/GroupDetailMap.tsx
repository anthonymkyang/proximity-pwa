"use client";

import React, { useEffect, useRef } from "react";
import maplibregl, { type Map as MaplibreMap } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Navigation } from "lucide-react";
import MapDirections from "@/components/map/MapDirections";
import { createClient } from "@/utils/supabase/client";

interface GroupDetailMapProps {
  lat: number;
  lng: number;
  name: string;
}

export function GroupDetailMap({ lat, lng, name }: GroupDetailMapProps) {
  const mapRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<MaplibreMap | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [directionsOpen, setDirectionsOpen] = React.useState(false);
  const [userLocation, setUserLocation] = React.useState<
    [number, number] | null
  >(null);

  // Get user's current location
  React.useEffect(() => {
    if (typeof window !== "undefined" && navigator?.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setUserLocation([pos.coords.longitude, pos.coords.latitude]);
        },
        () => {
          // Location permission denied or error
        },
        { enableHighAccuracy: false, timeout: 5000, maximumAge: 60_000 }
      );
    }
  }, []);

  React.useEffect(() => {
    if (userLocation) return;
    let active = true;
    const supabase = createClient();
    const loadPresenceLocation = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!active || !user) return;
      const { data, error } = await supabase
        .from("user_presence")
        .select("lat,lng")
        .eq("user_id", user.id)
        .maybeSingle();
      if (!active || error || !data) return;
      const lat = Number(data.lat);
      const lng = Number(data.lng);
      if (Number.isFinite(lat) && Number.isFinite(lng)) {
        setUserLocation([lng, lat]);
      }
    };
    void loadPresenceLocation();
    return () => {
      active = false;
    };
  }, [userLocation]);

  useEffect(() => {
    if (!mapRef.current || mapInstanceRef.current) return;

    let canceled = false;

    const initMap = async () => {
      try {
        if (canceled || !mapRef.current) return;

        // Fetch style with fallback
        let style: string = "https://tiles.openfreemap.org/styles/positron";
        try {
          const styleRes = await fetch("/maps/proximity-dark.json");
          if (styleRes.ok) {
            const styleData = await styleRes.json();
            style = styleData;
          }
        } catch {
          // Use fallback style
        }

        if (canceled || !mapRef.current) return;

        const map = new maplibregl.Map({
          container: mapRef.current,
          style,
          center: [lng, lat],
          zoom: 13,
          pitch: 0,
          // @ts-expect-error antialias is supported
          antialias: true,
          attributionControl: false,
        });
        map.dragPan.disable();
        map.scrollZoom.disable();
        map.doubleClickZoom.disable();
        map.boxZoom.disable();
        map.dragRotate.disable();
        map.keyboard.disable();
        map.touchZoomRotate.disable();

        const hideRoadNumbers = (mapObj: MaplibreMap) => {
          const style = mapObj.getStyle();
          if (!style?.layers) return;
          style.layers.forEach((layer) => {
            if (!layer || typeof layer.id !== "string") return;
            const hasShieldId = layer.id.toLowerCase().includes("shield");
            const hasRefField =
              typeof (layer as any).layout?.["text-field"] === "string" &&
              (layer as any).layout["text-field"].includes("{ref}");
            if (hasShieldId || hasRefField) {
              mapObj.setLayoutProperty(layer.id, "visibility", "none");
            }
          });
        };

        map.on("load", () => {
          if (canceled) {
            map.remove();
            return;
          }

          // Hide road number shields (e.g., A52, B457)
          hideRoadNumbers(map);

          // Add marker for group location
          const el = document.createElement("div");
          el.className =
            "flex items-center justify-center rounded-full bg-red-600 text-white shadow-lg";
          el.style.width = "30px";
          el.style.height = "30px";
          el.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>`;
          el.title = name;

          new maplibregl.Marker({ element: el })
            .setLngLat([lng, lat])
            .addTo(map);

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
  }, [lat, lng, name]);

  return (
    <>
      <div className="relative w-full rounded-xl overflow-hidden bg-muted/20">
        {loading && (
          <div className="absolute inset-0 z-10 bg-background/50">
            <Skeleton className="h-full w-full" />
          </div>
        )}
        <div ref={mapRef} className="h-64 w-full bg-muted/30" />

        {/* Get Directions Button */}
        <div className="absolute bottom-3 left-3">
          <Button
            size="sm"
            variant="secondary"
            className="rounded-full shadow-lg bg-background/95 backdrop-blur-sm hover:bg-background border"
            onClick={() => setDirectionsOpen(true)}
          >
            <Navigation className="h-4 w-4" />
            Get directions
          </Button>
        </div>
      </div>

      {/* Directions Drawer */}
      <MapDirections
        open={directionsOpen}
        onOpenChange={setDirectionsOpen}
        station={{
          name: name,
          displayName: name,
          coordinates: [lng, lat],
        }}
        title="Directions to this group"
        userLocation={userLocation}
      />
    </>
  );
}
