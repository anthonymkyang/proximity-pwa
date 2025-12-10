"use client";

import React, { useEffect, useMemo, useState } from "react";
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
  sunrise?: number;
  sunset?: number;
  timezone?: number;
};

type HourlyForecast = {
  dt: number;
  temp: number;
  icon: string;
  label: string;
  localTs: number;
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
  const [hourly, setHourly] = useState<HourlyForecast[]>([]);
  const [showDrawer, setShowDrawer] = useState(false);

  useEffect(() => {
    const apiKey = process.env.NEXT_PUBLIC_OPENWEATHER_API_KEY;
    if (!coords || !apiKey) {
      setWeather(null);
      setHourly([]);
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
        const timezone = Number(json?.timezone) || 0;
        const sunrise = Number(json?.sys?.sunrise);
        const sunset = Number(json?.sys?.sunset);

        const forecastUrl = new URL("https://api.openweathermap.org/data/2.5/forecast");
        forecastUrl.searchParams.set("lat", String(lat));
        forecastUrl.searchParams.set("lon", String(lon));
        forecastUrl.searchParams.set("units", "metric");
        forecastUrl.searchParams.set("appid", apiKey);

        let hourlyData: HourlyForecast[] = [];
        try {
          const forecastRes = await fetch(forecastUrl.toString(), {
            cache: "no-store",
            signal: controller.signal,
          });
          if (forecastRes.ok) {
            const forecastJson = await forecastRes.json();
            const list = Array.isArray(forecastJson?.list) ? forecastJson.list : [];
            const tzOffset = Number(forecastJson?.city?.timezone) || timezone || 0;
            hourlyData = list.slice(0, 8).map((entry: any) => {
              const dt = Number(entry?.dt) || 0;
              const iconCode = entry?.weather?.[0]?.icon ?? "01d";
              const tempValue = Number(entry?.main?.temp);
              const localTs = dt + tzOffset;
              const local = new Date(localTs * 1000);
              const label = local.toLocaleTimeString([], {
                hour: "numeric",
                hour12: true,
              });
              return {
                dt,
                temp: tempValue,
                icon: iconCode,
                label,
                localTs,
              };
            });
          }
        } catch (forecastErr) {
          // ignore forecast errors to still show current conditions
          console.warn("forecast fetch failed", forecastErr);
        }
        setWeather({
          temp,
          icon,
          description,
          city,
          country,
          feelsLike,
          humidity,
          wind,
          sunrise,
          sunset,
          timezone,
        });
        setHourly(hourlyData);
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

  const timelineItems = useMemo(() => {
    const items: {
      kind: "hourly" | "sunrise" | "sunset";
      timeLabel: string;
      temp?: number;
      icon?: string;
      keyTs: number;
    }[] = [];
    const tz = weather?.timezone ?? 0;
    const nowLocal = Math.floor(Date.now() / 1000) + tz;
    const windowEnd = nowLocal + 24 * 60 * 60;

    if (weather?.sunrise && Number.isFinite(weather.sunrise)) {
      let sunriseLocal = (weather.sunrise ?? 0) + tz;
      if (sunriseLocal < nowLocal) sunriseLocal += 24 * 60 * 60;
      if (sunriseLocal <= windowEnd) {
        const local = new Date(sunriseLocal * 1000);
        items.push({
          kind: "sunrise",
          timeLabel: local.toLocaleTimeString([], {
            hour: "numeric",
            minute: "2-digit",
            hour12: true,
          }),
          keyTs: sunriseLocal,
        });
      }
    }
    if (weather?.sunset && Number.isFinite(weather.sunset)) {
      let sunsetLocal = (weather.sunset ?? 0) + tz;
      if (sunsetLocal < nowLocal) sunsetLocal += 24 * 60 * 60;
      if (sunsetLocal <= windowEnd) {
        const local = new Date(sunsetLocal * 1000);
        items.push({
          kind: "sunset",
          timeLabel: local.toLocaleTimeString([], {
            hour: "numeric",
            minute: "2-digit",
            hour12: true,
          }),
          keyTs: sunsetLocal,
        });
      }
    }

    hourly.forEach((hour) => {
      items.push({
        kind: "hourly",
        timeLabel: hour.label,
        temp: hour.temp,
        icon: hour.icon,
        keyTs: hour.localTs ?? 0,
      });
    });

    return items
      .filter((item) => item.keyTs >= nowLocal && item.keyTs <= windowEnd)
      .sort((a, b) => a.keyTs - b.keyTs);
  }, [hourly, weather?.sunrise, weather?.sunset, weather?.timezone]);

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
          <DrawerHeader className="text-center">
            <DrawerTitle>
              {weather.city
                ? `${weather.city}${weather.country ? `, ${weather.country}` : ""}`
                : "Weather"}
            </DrawerTitle>
          </DrawerHeader>
          <div className="flex flex-col gap-4 px-4 pb-6">
            <div className="flex items-center justify-center gap-3 text-center">
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
            {timelineItems.length ? (
              <div className="rounded-2xl bg-muted/15 p-3 shadow-inner">
                <div className="flex gap-4 overflow-x-auto pb-1 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
                  {timelineItems.map((item, idx) => {
                    if (item.kind === "hourly") {
                      const hourIcon = mapOwIconToMeteocon(item.icon ?? "") ?? "cloudy";
                      const isFirstHourly = timelineItems
                        .slice(0, idx + 1)
                        .findIndex((t) => t.kind === "hourly") === idx;
                      const label = isFirstHourly ? "Now" : item.timeLabel;
                      return (
                        <div
                          key={`hour-${idx}-${item.timeLabel}`}
                          className="flex min-w-[60px] flex-col items-center gap-2 text-center"
                        >
                          <div className="text-xs font-semibold text-foreground">
                            {label}
                          </div>
                          <AnimatedWeatherIcon
                            animation={`/weather/lottie/${hourIcon}.json`}
                            size={38}
                            ariaLabel={`${label} weather`}
                          />
                          <div className="text-base font-semibold">
                            {Number.isFinite(item.temp)
                              ? `${Math.round(item.temp ?? 0)}°`
                              : "—"}
                          </div>
                        </div>
                      );
                    }

                    const isSunrise = item.kind === "sunrise";
                    return (
                      <div
                        key={`${item.kind}-${idx}-${item.timeLabel}`}
                        className="flex min-w-[60px] flex-col items-center gap-2 text-center"
                      >
                        <div className="text-xs font-semibold text-foreground">
                          {item.timeLabel}
                        </div>
                        <AnimatedWeatherIcon
                          animation={`/weather/lottie/${isSunrise ? "sunrise" : "sunset"}.json`}
                          size={38}
                          ariaLabel={isSunrise ? "Sunrise" : "Sunset"}
                        />
                        <div className="text-xs font-semibold text-muted-foreground">
                          {isSunrise ? "Sunrise" : "Sunset"}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : null}
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
