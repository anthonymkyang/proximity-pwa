"use client";

import React, { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import AnimatedWeatherIcon from "./AnimatedWeatherIcon";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";

type MapWeatherProps = {
  coords: [number, number] | null;
  className?: string;
};

type WeatherData = {
  temp: number;
  icon: string;
  description?: string;
  city?: string;
  country?: string;
  feelsLike?: number;
  humidity?: number;
  wind?: number;
};

const mapOwIconToMeteocon = (owIcon: string): string | null => {
  const code = owIcon?.slice(0, 2);
  const isDay = owIcon?.endsWith("d");
  switch (code) {
    case "01":
      return isDay ? "clear-day" : "clear-night";
    case "02":
      return isDay ? "partly-cloudy-day" : "partly-cloudy-night";
    case "03":
    case "04":
      return isDay ? "overcast-day" : "overcast-night";
    case "09":
      return "drizzle";
    case "10":
      return isDay ? "rain" : "rain";
    case "11":
      return isDay ? "thunderstorms-day" : "thunderstorms-night";
    case "13":
      return "snow";
    case "50":
      return "mist";
    default:
      return null;
  }
};

export default function MapWeather({ coords, className }: MapWeatherProps) {
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [state, setState] = useState<"idle" | "loading" | "error">("idle");
  const [showDrawer, setShowDrawer] = useState(false);

  useEffect(() => {
    const apiKey = process.env.NEXT_PUBLIC_OPENWEATHER_API_KEY;
    if (!coords || !apiKey) {
      setWeather(null);
      return;
    }
    const [lon, lat] = coords;
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) return;

    const controller = new AbortController();
    const fetchWeather = async () => {
      setState("loading");
      try {
        const url = new URL("https://api.openweathermap.org/data/2.5/weather");
        url.searchParams.set("lat", String(lat));
        url.searchParams.set("lon", String(lon));
        url.searchParams.set("units", "metric");
        url.searchParams.set("appid", apiKey);

        const res = await fetch(url.toString(), {
          cache: "no-store",
          signal: controller.signal,
        });
        if (!res.ok) throw new Error("weather fetch failed");
        const json = await res.json();
        const icon = json?.weather?.[0]?.icon ?? "01d";
        const temp = Number(json?.main?.temp);
        const feelsLike = Number(json?.main?.feels_like);
        const humidity = Number(json?.main?.humidity);
        const wind = Number(json?.wind?.speed);
        const description = json?.weather?.[0]?.description as string | undefined;
        const city = json?.name as string | undefined;
        const country = (json?.sys?.country as string | undefined) ?? "";
        setWeather({
          temp,
          icon,
          description,
          city,
          country,
          feelsLike,
          humidity,
          wind,
        });
        setState("idle");
      } catch {
        if (!controller.signal.aborted) {
          setState("error");
        }
      }
    };
    void fetchWeather();
    return () => controller.abort();
  }, [coords]);

  if (!coords || !weather || state === "error") return null;

  const meteocon = mapOwIconToMeteocon(weather.icon) ?? "cloudy";
  const iconUrl = `/weather/lottie/${meteocon}.json`;
  const temp = Number.isFinite(weather.temp)
    ? Math.round(weather.temp)
    : undefined;

  return (
    <>
      <div className={cn("pointer-events-none absolute right-4 top-4 z-10", className)}>
        <button
          type="button"
          className="pointer-events-auto inline-flex items-center gap-2 text-left"
          onClick={() => setShowDrawer(true)}
        >
          {temp != null ? (
            <span className="text-sm font-semibold leading-none tracking-tight text-foreground drop-shadow-[0_2px_6px_rgba(0,0,0,0.45)]">
              {temp}°C
            </span>
          ) : null}
          <div className="drop-shadow-[0_2px_6px_rgba(0,0,0,0.45)]">
            <AnimatedWeatherIcon animation={iconUrl} size={40} ariaLabel="Weather" />
          </div>
        </button>
      </div>

      <Drawer open={showDrawer} onOpenChange={setShowDrawer}>
        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle>Weather</DrawerTitle>
            <DrawerDescription>
              {weather.city ? `${weather.city}${weather.country ? `, ${weather.country}` : ""}` : "Current location"}
            </DrawerDescription>
          </DrawerHeader>
          <div className="flex flex-col gap-4 px-4 pb-6">
            <div className="flex items-center gap-3">
              <AnimatedWeatherIcon
                animation={iconUrl}
                size={64}
                ariaLabel="Weather icon"
              />
              <div className="space-y-1">
                <div className="text-3xl font-semibold">
                  {temp != null ? `${temp}°C` : "N/A"}
                </div>
                {weather.description ? (
                  <div className="text-sm capitalize text-muted-foreground">
                    {weather.description}
                  </div>
                ) : null}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div className="space-y-1 rounded-lg bg-muted/20 p-3">
                <div className="text-muted-foreground">Feels like</div>
                <div className="font-semibold">
                  {Number.isFinite(weather.feelsLike)
                    ? `${Math.round(weather.feelsLike ?? 0)}°C`
                    : "N/A"}
                </div>
              </div>
              <div className="space-y-1 rounded-lg bg-muted/20 p-3">
                <div className="text-muted-foreground">Humidity</div>
                <div className="font-semibold">
                  {Number.isFinite(weather.humidity)
                    ? `${weather.humidity}%`
                    : "N/A"}
                </div>
              </div>
              <div className="space-y-1 rounded-lg bg-muted/20 p-3">
                <div className="text-muted-foreground">Wind</div>
                <div className="font-semibold">
                  {Number.isFinite(weather.wind)
                    ? `${Math.round((weather.wind ?? 0) * 3.6)} km/h`
                    : "N/A"}
                </div>
              </div>
              <div className="space-y-1 rounded-lg bg-muted/20 p-3">
                <div className="text-muted-foreground">Coordinates</div>
                <div className="font-semibold text-xs">
                  {coords ? `${coords[1].toFixed(3)}, ${coords[0].toFixed(3)}` : "N/A"}
                </div>
              </div>
            </div>
          </div>
        </DrawerContent>
      </Drawer>
    </>
  );
}
