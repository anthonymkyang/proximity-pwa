"use client";

import React, { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import AnimatedWeatherIcon from "./AnimatedWeatherIcon";

type MapWeatherProps = {
  coords: [number, number] | null;
  className?: string;
};

type WeatherData = {
  temp: number;
  icon: string;
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
        setWeather({
          temp,
          icon,
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
    <div
      className={cn(
        "pointer-events-none absolute right-4 top-4 z-10",
        className
      )}
    >
      <div className="pointer-events-auto flex items-center gap-2">
        {temp != null ? (
          <span className="text-sm font-semibold leading-none tracking-tight text-foreground drop-shadow-[0_2px_6px_rgba(0,0,0,0.45)]">
            {temp}°C
          </span>
        ) : null}
        <div className="drop-shadow-[0_2px_6px_rgba(0,0,0,0.45)]">
          <AnimatedWeatherIcon animation={iconUrl} size={40} ariaLabel="Weather" />
        </div>
      </div>
    </div>
  );
}
