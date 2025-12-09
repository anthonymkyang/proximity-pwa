"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/utils/supabase/client";
import { Button } from "@/components/ui/button";

type PlaceRow = {
  id: string;
  name: string;
  slug: string | null;
  category?: { name?: string | null } | null;
};

export default function PlacesListPage() {
  const [places, setPlaces] = useState<PlaceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const load = async () => {
      const supabase = createClient();
      const { data, error: err } = await supabase
        .from("places")
        .select("id,name,slug,category:places_categories(name)")
        .order("name");
      if (!active) return;
      if (err) {
        setError(err.message);
      } else if (data) {
        setPlaces(
          data.map((p) => ({
            id: p.id as string,
            name: (p as any).name as string,
            slug: (p as any).slug ?? null,
            category: (p as any).category ?? null,
          }))
        );
      }
      setLoading(false);
    };
    void load();
    return () => {
      active = false;
    };
  }, []);

  return (
    <div className="p-6">
      <div className="mb-4 flex items-center justify-between">
        <div className="text-lg font-semibold text-foreground">Places</div>
        <Link href="/admin/places/add">
          <Button size="sm">Add place</Button>
        </Link>
      </div>
      {loading ? (
        <div className="text-sm text-muted-foreground">Loading…</div>
      ) : error ? (
        <div className="text-sm text-destructive">{error}</div>
      ) : places.length === 0 ? (
        <div className="text-sm text-muted-foreground">No places found.</div>
      ) : (
        <div className="space-y-2">
          {places.map((p) => (
            <div
              key={p.id}
              className="flex items-center justify-between rounded-lg border border-border/60 bg-background/70 px-4 py-3 text-sm shadow-sm"
            >
              <div className="flex flex-col">
                <span className="font-medium text-foreground">{p.name}</span>
                <span className="text-[12px] text-muted-foreground">
                  {p.slug || "—"}
                  {p.category?.name ? ` • ${p.category.name}` : ""}
                </span>
              </div>
              <Link href={`/admin/places/${p.id}`}>
                <Button size="sm" variant="secondary">
                  Edit
                </Button>
              </Link>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
