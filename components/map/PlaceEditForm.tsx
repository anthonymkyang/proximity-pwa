"use client";

import React, { useEffect, useMemo, useState } from "react";
import { createClient } from "@/utils/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ChevronsUpDown } from "lucide-react";

type PlaceEditFormProps = {
  placeId: string;
  className?: string;
};

const days = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
];

type DayHours = { open: string; close: string; allDay: boolean };

const slugify = (str: string) =>
  str
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-");

export default function PlaceEditForm({
  placeId,
  className,
}: PlaceEditFormProps) {
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugDirty, setSlugDirty] = useState(false);
  const [address, setAddress] = useState("");
  const [lat, setLat] = useState<string>("");
  const [lng, setLng] = useState<string>("");
  const [tz, setTz] = useState("Europe/London");
  const [website, setWebsite] = useState("");
  const [file, setFile] = useState<File | null>(null);

  const [categories, setCategories] = useState<
    { id: string; name: string; slug: string }[]
  >([]);
  const [categoryInput, setCategoryInput] = useState("");
  const [showCatList, setShowCatList] = useState(false);

  const [hours, setHours] = useState<DayHours[]>(
    days.map(() => ({ open: "", close: "", allDay: false }))
  );

  useEffect(() => {
    if (!slugDirty && name) {
      setSlug(slugify(name));
    }
  }, [name, slugDirty]);

  useEffect(() => {
    let active = true;
    const load = async () => {
      const supabase = createClient();
      const [{ data: place }, { data: cats }] = await Promise.all([
        supabase
          .from("places")
          .select("name,slug,address,lat,lng,tz,website,category_id")
          .eq("id", placeId)
          .maybeSingle(),
        supabase
          .from("places_categories")
          .select("id,name,slug")
          .order("name"),
      ]);

      if (!active) return;

      if (place) {
        setName(place.name || "");
        setSlug(place.slug || "");
        setAddress(place.address || "");
        setLat(
          place.lat !== null && place.lat !== undefined ? String(place.lat) : ""
        );
        setLng(
          place.lng !== null && place.lng !== undefined ? String(place.lng) : ""
        );
        setTz(place.tz || "Europe/London");
        setWebsite(place.website || "");
        if (place.category_id) {
          const catMatch = cats?.find((c) => c.id === place.category_id);
          if (catMatch) setCategoryInput(catMatch.name);
        }
      }

      if (cats) {
        setCategories(
          (cats as any[]).map((c) => ({
            id: c.id as string,
            name: c.name as string,
            slug: c.slug as string,
          }))
        );
      }

        const { data: hoursData } = await supabase
          .from("place_hours")
          .select("day_of_week, open_time, close_time, is_24h")
          .eq("place_id", placeId)
          .order("day_of_week");

      if (hoursData && Array.isArray(hoursData)) {
        const next = days.map(() => ({ open: "", close: "", closed: false }));
        hoursData.forEach((h: any) => {
          const dow = Number(h.day_of_week);
          const idx = dow === 0 ? 6 : dow - 1; // stored Sunday=0
          const isAllDay = (h as any).is_24h ? true : false;
          next[idx] = {
            open: isAllDay ? "00:00" : (h.open_time || "").slice(0, 5),
            close: isAllDay ? "23:59" : (h.close_time || "").slice(0, 5),
            allDay: isAllDay,
          };
        });
        setHours(next);
      }

      setLoaded(true);
    };
    void load();
    return () => {
      active = false;
    };
  }, [placeId]);

  const filteredCategories = useMemo(
    () =>
      categories.filter((c) =>
        c.name.toLowerCase().includes(categoryInput.toLowerCase())
      ),
    [categories, categoryInput]
  );

  const normalizeTime = (value: string) => {
    const cleaned = value.replace(/[^0-9]/g, "");
    if (cleaned.length < 3) return "";
    const hh = cleaned.slice(0, 2);
    const mm = cleaned.slice(2, 4).padEnd(2, "0");
    return `${hh}:${mm}:00`;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus(null);
    const parsedLat = parseFloat(lat);
    const parsedLng = parseFloat(lng);
    if (!name || !slug || !Number.isFinite(parsedLat) || !Number.isFinite(parsedLng)) {
      setStatus("Name, slug, and valid coordinates are required.");
      return;
    }
    setSaving(true);
    const supabase = createClient();

    let uploadedLogoUrl: string | null = null;
    if (file) {
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
        setSaving(false);
        return;
      }
    }

    let categoryId: string | null = null;
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
          const { data: existing } = await supabase
            .from("places_categories")
            .select("id")
            .eq("slug", newSlug)
            .maybeSingle();
          if (existing?.id) {
            categoryId = existing.id as string;
          } else {
            setStatus("Failed to create category");
            setSaving(false);
            return;
          }
        } else {
          categoryId = inserted?.id ?? null;
        }
      }
    }

    const updatePayload: Record<string, any> = {
      name,
      slug,
      address: address || null,
      lat: parsedLat,
      lng: parsedLng,
      tz: tz || null,
      category_id: categoryId,
      website: website || null,
    };
    if (uploadedLogoUrl) {
      updatePayload.logo_url = uploadedLogoUrl;
    }

    const { error: updateErr } = await supabase
      .from("places")
      .update(updatePayload)
      .eq("id", placeId);
    if (updateErr) {
      setStatus(updateErr.message);
      setSaving(false);
      return;
    }

    const hoursToInsert = hours
      .map((h, idx) => {
        const dayOfWeek = (idx + 1) % 7; // Monday=1, Sunday=0
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

    const { error: deleteErr } = await supabase
      .from("place_hours")
      .delete()
      .eq("place_id", placeId);
    if (deleteErr) {
      setStatus(`Updated place but failed to replace hours: ${deleteErr.message}`);
      setSaving(false);
      return;
    }
    if (hoursToInsert.length > 0) {
      const { error: hoursErr } = await supabase
        .from("place_hours")
        .insert(hoursToInsert as any[]);
      if (hoursErr) {
        setStatus(`Updated place but hours failed: ${hoursErr.message}`);
        setSaving(false);
        return;
      }
    }

    setStatus("Updated place.");
    setSaving(false);
  };

  return (
    <div
      className={cn(
        "pointer-events-auto w-full max-w-2xl rounded-2xl border border-white/10 bg-background/85 p-4 text-sm shadow-[0_12px_28px_rgba(0,0,0,0.35)] backdrop-blur",
        className
      )}
    >
      <div className="mb-3 text-base font-semibold text-foreground">
        Edit Place
      </div>
      {!loaded ? (
        <div className="text-xs text-muted-foreground">Loading…</div>
      ) : (
        <form className="space-y-3" onSubmit={handleSubmit}>
          <div className="space-y-1">
            <label className="text-[11px] text-muted-foreground">Name</label>
            <Input
              size={0}
              value={name}
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
              placeholder="slug"
              onChange={(e) => {
                setSlug(e.target.value);
                setSlugDirty(true);
              }}
              required
              className="h-12 text-sm"
            />
          </div>
          <div className="space-y-1">
            <label className="text-[11px] text-muted-foreground">Address</label>
            <Input
              size={0}
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              className="h-12 text-sm"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-[11px] text-muted-foreground">Lat</label>
              <Input
                size={0}
                value={lat}
                onChange={(e) => setLat(e.target.value)}
                className="h-12 text-sm"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[11px] text-muted-foreground">Lng</label>
              <Input
                size={0}
                value={lng}
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
              type="url"
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
                  {(() => {
                    if (!hours[idx]) {
                      const clone = [...hours];
                      clone[idx] = { open: "", close: "", allDay: false };
                      setHours(clone);
                    }
                  })()}
                  {/** guard to avoid undefined during async load */}
                  {(() => null)()}
                  <span className="text-[11px] text-muted-foreground">{day}</span>
                  {(() => {
                    const h = hours[idx] ?? { open: "", close: "", allDay: false };
                    return (
                      <>
                        <Input
                          size={0}
                          type="text"
                          inputMode="numeric"
                          maxLength={5}
                          value={h.open}
                          disabled={h.allDay}
                          placeholder="HH:MM"
                          onChange={(e) => {
                            const raw = e.target.value.replace(/[^0-9]/g, "");
                            const auto =
                              raw.length >= 3
                                ? `${raw.slice(0, 2)}:${raw.slice(2, 4)}`
                                : raw;
                            const next = [...hours];
                            next[idx] = { ...h, open: auto };
                            setHours(next);
                          }}
                          className="h-10 text-sm"
                        />
                        <Input
                          size={0}
                          type="text"
                          inputMode="numeric"
                          maxLength={5}
                          value={h.close}
                          disabled={h.allDay}
                          placeholder="HH:MM"
                          onChange={(e) => {
                            const raw = e.target.value.replace(/[^0-9]/g, "");
                            const auto =
                              raw.length >= 3
                                ? `${raw.slice(0, 2)}:${raw.slice(2, 4)}`
                                : raw;
                            const next = [...hours];
                            next[idx] = { ...h, close: auto };
                            setHours(next);
                          }}
                          className="h-10 text-sm"
                        />
                        <label className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                          <input
                            type="checkbox"
                            checked={h.allDay}
                            onChange={(e) => {
                              const next = [...hours];
                              next[idx] = {
                                ...h,
                                allDay: e.target.checked,
                                open: e.target.checked ? "00:00" : h.open,
                                close: e.target.checked ? "23:59" : h.close,
                              };
                              setHours(next);
                            }}
                            className="h-4 w-4 accent-primary"
                          />
                          24 hours
                        </label>
                      </>
                    );
                  })()}
                  <span className="text-[11px] text-muted-foreground">{day}</span>
                  <Input
                    size={0}
                    type="text"
                    inputMode="numeric"
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
              className="h-12 text-sm file:text-xs file:font-medium"
            />
            <div className="text-[11px] text-muted-foreground">
              Leave empty to keep current logo.
            </div>
          </div>
          <div className="flex items-center justify-between pt-1">
            <span className="text-[11px] text-muted-foreground">
              Editing place #{placeId}
            </span>
            <Button size="sm" type="submit" disabled={saving}>
              {saving ? "Saving..." : "Save changes"}
            </Button>
          </div>
          {status ? (
            <div className="text-[11px] text-muted-foreground">{status}</div>
          ) : null}
        </form>
      )}
    </div>
  );
}
