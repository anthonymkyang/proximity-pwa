"use client";

import React, { useEffect, useMemo, useState } from "react";
import { createClient } from "@/utils/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { ChevronsUpDown } from "lucide-react";

type CruisingFormProps = {
  defaultCoords?: [number, number] | null;
  className?: string;
};

export default function CruisingForm({
  defaultCoords,
  className,
}: CruisingFormProps) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [lat, setLat] = useState("");
  const [lng, setLng] = useState("");
  const [tips, setTips] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [categories, setCategories] = useState<{ id: string; name: string }[]>(
    []
  );
  const [categoryInput, setCategoryInput] = useState("");
  const [showCatList, setShowCatList] = useState(false);

  useEffect(() => {
    if (defaultCoords) {
      setLng(String(defaultCoords[0]));
      setLat(String(defaultCoords[1]));
    }
  }, [defaultCoords]);

  useEffect(() => {
    const loadCats = async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("cruising_categories")
        .select("id,name")
        .order("name");
      if (!error && data) {
        setCategories(
          (data as any[]).map((c) => ({
            id: c.id as string,
            name: c.name as string,
          }))
        );
      }
    };
    void loadCats();
  }, []);

  const filteredCategories = useMemo(() => {
    const term = categoryInput.toLowerCase();
    return categories.filter((c) => c.name.toLowerCase().includes(term));
  }, [categories, categoryInput]);

  const slugify = (str: string) =>
    str
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9\s-]/g, "")
      .replace(/\s+/g, "-");

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus(null);
    const parsedLat = parseFloat(lat);
    const parsedLng = parseFloat(lng);
    if (!name || !Number.isFinite(parsedLat) || !Number.isFinite(parsedLng)) {
      setStatus("Name and valid coordinates are required.");
      return;
    }

    setLoading(true);
    const supabase = createClient();

    let categoryId: string | null = null;
    const catTrimmed = categoryInput.trim();
    if (catTrimmed) {
      const existing = categories.find(
        (c) => c.name.toLowerCase() === catTrimmed.toLowerCase()
      );
      if (existing) {
        categoryId = existing.id;
      } else {
        const { data: inserted, error: catErr } = await supabase
          .from("cruising_categories")
          .upsert({ name: catTrimmed }, { onConflict: "name" })
          .select("id")
          .maybeSingle();
        if (catErr) {
          setStatus(catErr.message);
          setLoading(false);
          return;
        }
        if (inserted?.id) {
          categoryId = inserted.id as string;
        }
      }
    }

    let storedImagePath: string | null = null;
    if (file) {
      const ext = file.name.split(".").pop() || "jpg";
      const baseSlug =
        slugify(name || "") || slugify(categoryInput || "") || crypto.randomUUID();
      const path = `spots/${baseSlug}-${Date.now()}.${ext}`;
      const { error: uploadErr } = await supabase.storage
        .from("cruising-spots")
        .upload(path, file, { cacheControl: "3600", upsert: true });
      if (uploadErr) {
        setStatus(uploadErr.message);
        setLoading(false);
        return;
      }
      storedImagePath = path;
    }

    const tipsArray = tips
      .split("\n")
      .map((t) => t.trim())
      .filter(Boolean);

    const { error: insertError } = await supabase.from("cruising_places").insert({
      name,
      description: description || null,
      category_id: categoryId,
      // Postgres point syntax: "(x,y)"
      location: `(${parsedLng},${parsedLat})`,
      image_path: storedImagePath,
      tips: tipsArray.length ? tipsArray : [],
    });

    if (insertError) {
      setStatus(insertError.message);
      setLoading(false);
      return;
    }

    setStatus("Saved!");
    setName("");
    setDescription("");
    setLat("");
    setLng("");
    setFile(null);
    setTips("");
    setCategoryInput("");
    setLoading(false);
  };

  return (
    <form
      onSubmit={onSubmit}
      className={cn("space-y-4 rounded-xl border border-border/70 p-4", className)}
    >
      <div className="space-y-1">
        <label className="text-sm font-medium text-foreground">Name</label>
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Paddington benches"
          required
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <label className="text-sm font-medium text-foreground">Latitude</label>
          <Input
            value={lat}
            onChange={(e) => setLat(e.target.value)}
            placeholder="51.5154"
          />
        </div>
        <div className="space-y-1">
          <label className="text-sm font-medium text-foreground">Longitude</label>
          <Input
            value={lng}
            onChange={(e) => setLng(e.target.value)}
            placeholder="-0.1756"
          />
        </div>
      </div>

      <div className="space-y-1">
        <label className="text-sm font-medium text-foreground">Category</label>
        <div className="relative">
          <Input
            value={categoryInput}
            onChange={(e) => setCategoryInput(e.target.value)}
            onFocus={() => setShowCatList(true)}
            onBlur={() => setTimeout(() => setShowCatList(false), 120)}
            placeholder="Station, park…"
          />
          <ChevronsUpDown className="pointer-events-none absolute right-2 top-2.5 h-4 w-4 text-muted-foreground" />
          {showCatList && filteredCategories.length > 0 && (
            <div className="absolute z-10 mt-1 max-h-40 w-full overflow-y-auto rounded-md border border-border/70 bg-popover shadow-lg">
              {filteredCategories.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  className="flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-muted"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    setCategoryInput(c.name);
                    setShowCatList(false);
                  }}
                >
                  {c.name}
                </button>
              ))}
            </div>
          )}
        </div>
        <p className="text-xs text-muted-foreground">
          Pick an existing category or type a new one.
        </p>
      </div>

      <div className="space-y-1">
        <label className="text-sm font-medium text-foreground">Image</label>
        <input
          type="file"
          accept="image/*"
          onChange={(e) => setFile(e.target.files?.[0] || null)}
          className="block w-full text-sm text-muted-foreground file:mr-3 file:rounded-md file:border-0 file:bg-primary/10 file:px-3 file:py-1.5 file:text-foreground"
        />
        <p className="text-xs text-muted-foreground">
          Uploads to private bucket <code>cruising-spots</code>; stored path is
          saved with the spot.
        </p>
      </div>

      <div className="space-y-1">
        <label className="text-sm font-medium text-foreground">Description</label>
        <Textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Short summary of the spot"
          rows={3}
        />
      </div>

      <div className="space-y-1">
        <label className="text-sm font-medium text-foreground">Tips</label>
        <Textarea
          value={tips}
          onChange={(e) => setTips(e.target.value)}
          placeholder="One tip per line"
          rows={4}
        />
      </div>

      {status && <div className="text-sm text-muted-foreground">{status}</div>}

      <Button type="submit" disabled={loading} className="w-full">
        {loading ? "Saving…" : "Save cruising spot"}
      </Button>
    </form>
  );
}
