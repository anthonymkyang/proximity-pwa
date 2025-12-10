"use client";

import React from "react";

export type MapDirectionsProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  station: {
    name: string;
    displayName?: string;
    modes?: string[];
    lines?: string[];
    coordinates?: [number, number];
  } | null;
  title?: string | null;
  onUserLocation?: (coords: [number, number]) => void;
};

export default function MapDirections({
  open,
  onOpenChange,
  station,
  title,
  onUserLocation,
}: MapDirectionsProps) {
  // intentionally empty placeholder to reduce noise
  return null;
}
