"use client";

import React, { useEffect, useState } from "react";
import { createClient } from "@/utils/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { ChevronsUpDown } from "lucide-react";

type PlaceTempFormProps = {
  defaultCoords?: [number, number] | null;
  className?: string;
};

export default function PlaceTempForm({
  defaultCoords,
  className,
}: PlaceTempFormProps) {
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [address, setAddress] = useState("");
  const [lat, setLat] = useState<string>("");
  const [lng, setLng] = useState<string>("");
  const [tz, setTz] = useState("Europe/London");
  const [status, setStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [website, setWebsite] = useState("");
  const [categories, setCategories] = useState<
    { id: string; name: string; slug: string }[]
  >([]);
  const [categoryInput, setCategoryInput] = useState("");
  const [showCatList, setShowCatList] = useState(false);
  const days = [
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday",
    "Sunday",
  ];
  const [hours, setHours] = useState(
    days.map(() => ({ open: "", close: "", allDay: false }))
  );

  useEffect(() => {
    if (defaultCoords) {
      setLng(String(defaultCoords[0]));
      setLat(String(defaultCoords[1]));
    }
  }, [defaultCoords]);

  useEffect(() => {
    if (!name) return;
    setSlug(
      name
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9\s-]/g, "")
        .replace(/\s+/g, "-")
    );
  }, [name]);

  useEffect(() => {
    const loadCats = async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("places_categories")
        .select("id,name,slug")
        .order("name");
      if (!error && data) {
        setCategories(
          (data as any[]).map((c) => ({
            id: c.id as string,
            name: c.name as string,
            slug: c.slug as string,
          }))
        );
      }
    };
    void loadCats();
  }, []);

  const filteredCategories = categories.filter((c) =>
    c.name.toLowerCase().includes(categoryInput.toLowerCase())
  );

  const normalizeTime = (value: string) => {
    const cleaned = value.replace(/[^0-9]/g, "");
    if (cleaned.length < 3) return "";
    const hh = cleaned.slice(0, 2);
    const mm = cleaned.slice(2, 4).padEnd(2, "0");
    return `${hh}:${mm}:00`;
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus(null);
    const parsedLat = parseFloat(lat);
    const parsedLng = parseFloat(lng);
    if (!name || !Number.isFinite(parsedLat) || !Number.isFinite(parsedLng)) {
      setStatus("Name, slug, and valid coordinates are required.");
      return;
    }
    if (!slug) {
      setStatus("Slug is required.");
      return;
    }
    setLoading(true);
    const supabase = createClient();

    let uploadedLogoUrl: string | null = null;
    if (!file) {
      setStatus("Logo file is required.");
      setLoading(false);
      return;
    }
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("slug", slug || name.toLowerCase().replace(/\s+/g, "-"));

      const res = await fetch("/api/admin/upload-place-logo", {
        method: "POST",
        body: fd,
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "Upload failed");
      uploadedLogoUrl = json.publicUrl || null;
    } catch (err: any) {
      setStatus(err?.message || "Logo upload failed");
      setLoading(false);
      return;
    }

    let categoryId: string | null = null;

    const slugify = (str: string) =>
      str
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9\s-]/g, "")
        .replace(/\s+/g, "-");

    const catInputTrimmed = categoryInput.trim();

    if (catInputTrimmed) {
      const match = categories.find(
        (c) =>
          c.slug.toLowerCase() === catInputTrimmed.toLowerCase() ||
          c.name.toLowerCase() === catInputTrimmed.toLowerCase()
      );
      if (match) {
        categoryId = match.id;
      } else {
        const newSlug = slugify(catInputTrimmed) || crypto.randomUUID();
        const { data: inserted, error: catErr } = await supabase
          .from("places_categories")
          .insert({ name: catInputTrimmed, slug: newSlug })
          .select("id")
          .maybeSingle();
        if (catErr) {
          // if conflict, fetch existing by slug
          const { data: existing } = await supabase
            .from("places_categories")
            .select("id")
            .eq("slug", newSlug)
            .maybeSingle();
          if (existing?.id) {
            categoryId = existing.id as string;
          } else {
            setStatus("Failed to create category");
            setLoading(false);
            return;
          }
        } else {
          categoryId = inserted?.id ?? null;
        }
      }
    }

    const { data: placeData, error: insertError } = await supabase
      .from("places")
      .insert({
        name,
        slug: slug || undefined,
        address: address || null,
      lat: parsedLat,
      lng: parsedLng,
      tz: tz || null,
      category_id: categoryId,
      logo_url: uploadedLogoUrl || null,
      website: website || null,
    })
      .select("id")
      .maybeSingle();

    if (insertError) {
      setStatus(insertError.message);
    } else {
      const placeId = placeData?.id as string | undefined;
      if (placeId) {
        const hoursToInsert = hours
          .map((h, idx) => {
            const dayOfWeek = (idx + 1) % 7; // shift so Monday=1, ..., Sunday=0
            if (h.allDay) {
              return {
                place_id: placeId,
                day_of_week: dayOfWeek,
                open_time: "00:00:00",
                close_time: "23:59:00",
                interval_index: 0,
                is_24h: true,
              };
            }
            const openTime = normalizeTime(h.open);
            const closeTime = normalizeTime(h.close);
            if (openTime && closeTime) {
              return {
                place_id: placeId,
                day_of_week: dayOfWeek,
                open_time: openTime,
                close_time: closeTime,
                interval_index: 0,
                is_24h: false,
              };
            }
            return null;
          })
          .filter(Boolean);
        if (hoursToInsert.length > 0) {
          const { error: hoursErr } = await supabase
            .from("place_hours")
            .upsert(hoursToInsert as any[], {
              onConflict: "place_id,day_of_week,interval_index",
            });
          if (hoursErr) {
            setStatus(`Saved place but hours failed: ${hoursErr.message}`);
            setLoading(false);
            return;
          }
        }
      }
      setStatus("Saved place.");
    }
    setLoading(false);
  };

  return (
    <div
      className={cn(
        "pointer-events-auto w-full max-w-sm rounded-2xl border border-white/10 bg-background/85 p-3 text-xs shadow-[0_12px_28px_rgba(0,0,0,0.35)] backdrop-blur",
        className
      )}
    >
      <div className="mb-2 text-sm font-semibold text-foreground">
        Temp: Add Place
      </div>
      <form className="space-y-2" onSubmit={onSubmit}>
        <div className="space-y-1">
          <label className="text-[11px] text-muted-foreground">Name</label>
          <Input
            size={0}
            value={name}
            placeholder="Name"
            onChange={(e) => setName(e.target.value)}
            required
            className="h-12 text-sm"
          />
        </div>
        <div className="space-y-1">
          <label className="text-[11px] text-muted-foreground">Slug</label>
          <Input
            size={0}
            value={slug}
            placeholder="Slug"
            onChange={(e) => setSlug(e.target.value)}
            required
            className="h-12 text-sm"
          />
        </div>
        <div className="space-y-1">
          <label className="text-[11px] text-muted-foreground">Address</label>
          <Input
            size={0}
            value={address}
            placeholder="Address"
            onChange={(e) => setAddress(e.target.value)}
            className="h-12 text-sm"
          />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1">
            <label className="text-[11px] text-muted-foreground">Lat</label>
            <Input
              size={0}
              value={lat}
              placeholder="Lat"
              onChange={(e) => setLat(e.target.value)}
              className="h-12 text-sm"
            />
          </div>
          <div className="space-y-1">
            <label className="text-[11px] text-muted-foreground">Lng</label>
            <Input
              size={0}
              value={lng}
              placeholder="Lng"
              onChange={(e) => setLng(e.target.value)}
              className="h-12 text-sm"
            />
          </div>
        </div>
        <div className="space-y-1">
          <label className="text-[11px] text-muted-foreground">Time zone</label>
          <Input
            size={0}
            value={tz}
            placeholder="Europe/London"
            onChange={(e) => setTz(e.target.value)}
            className="h-12 text-sm"
          />
        </div>
        <div className="space-y-1">
          <label className="text-[11px] text-muted-foreground">Category</label>
          <div className="relative">
            <Input
              size={0}
              value={categoryInput}
              placeholder="Select or type to create"
              onFocus={() => setShowCatList(true)}
              onBlur={() => setTimeout(() => setShowCatList(false), 150)}
              onChange={(e) => setCategoryInput(e.target.value)}
              className="h-12 pr-8 text-sm"
            />
            <ChevronsUpDown className="pointer-events-none absolute right-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            {showCatList ? (
              <div className="absolute z-30 mt-1 max-h-48 w-full overflow-auto rounded-md border border-border bg-background shadow-lg">
                {filteredCategories.length === 0 ? (
                  <div className="px-3 py-2 text-xs text-muted-foreground">
                    Type to create “{categoryInput || "new category"}”
                  </div>
                ) : (
                  filteredCategories.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      className="flex w-full items-center px-3 py-2 text-left text-xs hover:bg-accent"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => {
                        setCategoryInput(c.name);
                        setShowCatList(false);
                      }}
                    >
                      {c.name}
                    </button>
                  ))
                )}
              </div>
            ) : null}
          </div>
        </div>
        <div className="space-y-1">
          <label className="text-[11px] text-muted-foreground">Website</label>
          <Input
            size={0}
            value={website}
            placeholder="https://example.com"
            onChange={(e) => setWebsite(e.target.value)}
            className="h-12 text-sm"
          />
        </div>
        <div className="space-y-1">
          <label className="text-[11px] text-muted-foreground">
            Opening hours (HH:MM 24h)
          </label>
            <div className="space-y-2 rounded-lg border border-border/60 p-2">
              {days.map((day, idx) => (
                <div
                  key={day}
                  className="grid grid-cols-4 items-center gap-2 text-sm"
                >
                  <span className="text-[11px] text-muted-foreground">{day}</span>
                  <Input
                    size={0}
                    type="text"
                    inputMode="numeric"
                    pattern="[0-2][0-9]:[0-5][0-9]"
                    maxLength={5}
                    value={hours[idx].open}
                    disabled={hours[idx].allDay}
                    placeholder="HH:MM"
                    onChange={(e) => {
                      const raw = e.target.value.replace(/[^0-9]/g, "");
                      const auto =
                        raw.length >= 3
                          ? `${raw.slice(0, 2)}:${raw.slice(2, 4)}`
                          : raw;
                      const next = [...hours];
                      next[idx] = { ...next[idx], open: auto };
                      setHours(next);
                    }}
                    className="h-10 text-sm"
                  />
                  <Input
                    size={0}
                    type="text"
                    inputMode="numeric"
                    pattern="[0-2][0-9]:[0-5][0-9]"
                    maxLength={5}
                    value={hours[idx].close}
                    disabled={hours[idx].allDay}
                    placeholder="HH:MM"
                    onChange={(e) => {
                      const raw = e.target.value.replace(/[^0-9]/g, "");
                      const auto =
                        raw.length >= 3
                          ? `${raw.slice(0, 2)}:${raw.slice(2, 4)}`
                          : raw;
                      const next = [...hours];
                      next[idx] = { ...next[idx], close: auto };
                      setHours(next);
                    }}
                    className="h-10 text-sm"
                  />
                  <label className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                    <input
                      type="checkbox"
                      checked={hours[idx].allDay}
                      onChange={(e) => {
                        const next = [...hours];
                        next[idx] = {
                          ...next[idx],
                          allDay: e.target.checked,
                          open: e.target.checked ? "00:00" : next[idx].open,
                          close: e.target.checked ? "23:59" : next[idx].close,
                        };
                        setHours(next);
                      }}
                      className="h-4 w-4 accent-primary"
                    />
                    24 hours
                  </label>
                </div>
              ))}
            </div>
        </div>
        <div className="space-y-1">
          <label className="text-[11px] text-muted-foreground">Logo</label>
          <Input
            size={0}
            type="file"
            accept="image/*"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            required
            className="h-12 text-sm file:text-xs file:font-medium"
          />
        </div>
        <div className="flex items-center justify-between pt-1">
          <span className="text-[11px] text-muted-foreground">
            Temp form (remove in prod)
          </span>
          <Button size="sm" type="submit" disabled={loading}>
            {loading ? "Saving..." : "Save"}
          </Button>
        </div>
        {status ? (
          <div className="text-[11px] text-muted-foreground">{status}</div>
        ) : null}
      </form>
    </div>
  );
}
