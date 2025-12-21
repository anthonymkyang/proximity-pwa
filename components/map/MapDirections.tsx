"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Footprints,
  BusFront,
  TrainFront,
  TrainFrontTunnel,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { getLineColor, getContrastingText } from "./MapInstructions";

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
  userLocation?: [number, number] | null;
};

type JourneyResponse = {
  journeys?: {
    duration?: number;
    startDateTime?: string;
    arrivalDateTime?: string;
    legs?: {
      mode?: { id?: string };
      duration?: number;
      departurePoint?: { commonName?: string };
      arrivalPoint?: { commonName?: string };
      routeOptions?: { name?: string }[];
    }[];
    fare?: { totalCost?: number };
  }[];
};

type Journey = {
  duration: number;
  startTime: string;
  endTime: string;
  fare?: string;
  legs: {
    mode: string;
    route?: string;
    duration?: number;
  }[];
};

const formatTime = (iso?: string) => {
  if (!iso) return "";
  const d = new Date(iso);
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
};

const formatFare = (pence?: number) => {
  if (pence === undefined || !Number.isFinite(pence)) return undefined;
  return `£${(pence / 100).toFixed(2)}`;
};

function JourneyLegChips({ legs }: { legs: Journey["legs"] }) {
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const [leftFade, setLeftFade] = useState(false);
  const [rightFade, setRightFade] = useState(false);

  const updateFade = () => {
    const el = scrollRef.current;
    if (!el) return;
    const { scrollLeft, scrollWidth, clientWidth } = el;
    setLeftFade(scrollLeft > 1);
    setRightFade(scrollLeft + clientWidth < scrollWidth - 1);
  };

  useEffect(() => {
    updateFade();
    const el = scrollRef.current;
    if (!el) return;
    el.addEventListener("scroll", updateFade);
    const resize = () => updateFade();
    window.addEventListener("resize", resize);
    return () => {
      el.removeEventListener("scroll", updateFade);
      window.removeEventListener("resize", resize);
    };
  }, [legs]);

  return (
    <div className="relative text-xs font-semibold text-foreground">
      <div
        ref={scrollRef}
        className="flex items-center gap-1 overflow-x-auto whitespace-nowrap pb-1 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
      >
        {legs.map((leg, legIdx) => {
          const isBus = leg.mode === "bus";
          const isTubeLike =
            leg.mode === "tube" ||
            leg.mode === "dlr" ||
            leg.mode === "overground";
          const isWalking = leg.mode === "walking" || leg.mode === "walk";

          const chip = (() => {
            if (isTubeLike && leg.route) {
              const bg = getLineColor(leg.route);
              const textColor = getContrastingText(bg);
              return (
                <span
                  className="inline-flex shrink-0 items-center gap-1 rounded-full pl-1 pr-2 py-0.5"
                  style={{ backgroundColor: bg, color: textColor }}
                >
                  <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-white">
                    {modeIcon(leg.mode)}
                  </span>
                  <span className="text-xs font-bold">{leg.route}</span>
                </span>
              );
            }

            if (isWalking) {
              const minsRaw = Number(leg.duration);
              const mins = Number.isFinite(minsRaw)
                ? Math.max(1, Math.round(minsRaw))
                : null;
              return (
                <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-white/15 px-2 py-0.5 text-xs font-semibold text-foreground">
                  {modeIcon(leg.mode)}
                  <span>{mins != null ? `${mins}` : "Walk"}</span>
                </span>
              );
            }

            return isBus && leg.route ? (
              <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-red-600 px-2 py-0.5 text-xs font-bold text-white">
                <span className="inline-flex h-4 w-4 items-center justify-center">
                  {modeIcon(leg.mode)}
                </span>
                {leg.route}
              </span>
            ) : (
              <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-background/60 px-2 py-1">
                {modeIcon(leg.mode)}
                {leg.route ? <span>{leg.route}</span> : null}
              </span>
            );
          })();

          return <React.Fragment key={`leg-${legIdx}`}>{chip}</React.Fragment>;
        })}
      </div>
      <div
        className={cn(
          "pointer-events-none absolute inset-y-0 left-0 w-6 bg-linear-to-r from-background via-background/80 to-transparent transition-opacity",
          leftFade ? "opacity-100" : "opacity-0"
        )}
      />
      <div
        className={cn(
          "pointer-events-none absolute inset-y-0 right-0 w-6 bg-linear-to-l from-background via-background/80 to-transparent transition-opacity",
          rightFade ? "opacity-100" : "opacity-0"
        )}
      />
    </div>
  );
}

const modeIcon = (mode: string) => {
  if (mode === "bus") return <BusFront className="h-3.5 w-3.5" />;
  if (mode === "tube" || mode === "dlr" || mode === "overground")
    return (
      <span className="inline-flex h-4 w-4 items-center justify-center">
        <img src="/icons/tube.svg" alt="Underground" className="h-4 w-4" />
      </span>
    );
  if (mode === "national-rail" || mode === "rail")
    return <TrainFront className="h-3.5 w-3.5" />;
  return <Footprints className="h-3.5 w-3.5" />;
};

export default function MapDirections({
  open,
  onOpenChange,
  station,
  title,
  onUserLocation,
  userLocation,
}: MapDirectionsProps) {
  const [journeys, setJourneys] = useState<Journey[]>([]);
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  const heading = useMemo(
    () =>
      title ??
      station?.displayName ??
      station?.name ??
      (userLocation ? "Directions from here" : "Directions"),
    [title, station?.displayName, station?.name, userLocation]
  );

  const canRequest =
    open &&
    station?.coordinates &&
    Array.isArray(station.coordinates) &&
    Number.isFinite(station.coordinates[0]) &&
    Number.isFinite(station.coordinates[1]) &&
    userLocation &&
    Number.isFinite(userLocation[0]) &&
    Number.isFinite(userLocation[1]);

  useEffect(() => {
    if (!canRequest) return;

    const fetchDirections = async () => {
      setStatus("loading");
      setError(null);
      setJourneys([]);
      try {
        const [toLon, toLat] = station?.coordinates as [number, number];
        const [fromLon, fromLat] = userLocation as [number, number];
        const params = new URLSearchParams({
          fromLat: String(fromLat),
          fromLon: String(fromLon),
          toLat: String(toLat),
          toLon: String(toLon),
          mode: "tube,dlr,overground,bus,national-rail,walking",
        });
        const res = await fetch(`/api/tfl?${params.toString()}`, {
          cache: "no-store",
        });
        if (!res.ok) {
          const text = await res.text();
          let message = text;
          try {
            const parsed = JSON.parse(text);
            message =
              (parsed?.message as string) ||
              (parsed?.error as string) ||
              text ||
              "Failed to fetch directions";
          } catch {
            // plain text
            if (!message) message = "Failed to fetch directions";
          }
          throw new Error(message);
        }
        const json = (await res.json()) as JourneyResponse;
        const parsed: Journey[] =
          json.journeys?.map((j) => ({
            duration: j.duration ?? 0,
            startTime: formatTime(j.startDateTime),
            endTime: formatTime(j.arrivalDateTime),
            fare: formatFare(j.fare?.totalCost),
            legs:
              j.legs?.map((leg) => {
                let legMins: number | undefined;
                if (
                  typeof leg.duration === "number" &&
                  Number.isFinite(leg.duration)
                ) {
                  legMins = leg.duration;
                }
                return {
                  mode: leg.mode?.id ?? "walk",
                  route: leg.routeOptions?.[0]?.name,
                  duration: legMins,
                };
              }) ?? [],
          })) ?? [];
        setJourneys(parsed);
        setStatus("idle");
      } catch (err: any) {
        setStatus("error");
        setError(
          err?.message ??
            "Unable to fetch directions right now. Please try again."
        );
      }
    };

    void fetchDirections();
  }, [canRequest, station?.coordinates, userLocation]);

  const content = useMemo(() => {
    if (!open) return null;
    if (!canRequest) {
      return (
        <div className="px-4 pb-4 text-sm text-muted-foreground">
          Enable location and select a destination to see directions.
        </div>
      );
    }
    if (status === "loading") {
      return (
        <div className="space-y-3 px-4 pb-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="rounded-2xl bg-muted/20 p-3 shadow-inner">
              <div className="flex items-center gap-3">
                <Skeleton className="h-6 w-10" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-4 w-32" />
                </div>
                <Skeleton className="h-4 w-12" />
              </div>
            </div>
          ))}
        </div>
      );
    }
    if (status === "error") {
      return (
        <div className="px-4 pb-4 text-sm text-destructive">
          {error || "Unable to load directions."}
        </div>
      );
    }
    if (!journeys.length) {
      return (
        <div className="px-4 pb-4 text-sm text-muted-foreground">
          No routes found. Try another destination.
        </div>
      );
    }

    return (
      <div className="space-y-3 px-4 pb-4">
        {journeys.map((journey, idx) => (
          <div
            key={`journey-${idx}`}
            className="rounded-2xl bg-muted/20 p-3 shadow-inner"
          >
            <div className="flex items-center gap-3">
              <div className="flex h-14 w-14 flex-col items-center justify-center rounded-full bg-muted/20 text-foreground">
                <span className="text-xl font-semibold leading-tight">
                  {journey.duration}
                </span>
                <span className="text-[11px] font-semibold leading-none text-muted-foreground">
                  min
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold text-foreground">
                  {journey.startTime} – {journey.endTime}
                </div>
                <div className="h-1" />
                <JourneyLegChips legs={journey.legs} />
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  }, [open, canRequest, status, error, journeys]);

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent>
        <DrawerHeader className="text-center">
          <DrawerTitle>{heading}</DrawerTitle>
          <DrawerDescription />
        </DrawerHeader>
        {content}
      </DrawerContent>
    </Drawer>
  );
}
