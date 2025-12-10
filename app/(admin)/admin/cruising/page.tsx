"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/utils/supabase/client";
import { Button } from "@/components/ui/button";

type CruisingRow = {
  id: string;
  name: string;
  category?: { name?: string | null } | null;
};

export default function CruisingListPage() {
  const [spots, setSpots] = useState<CruisingRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const load = async () => {
      const supabase = createClient();
      const { data, error: err } = await supabase
        .from("cruising_places")
        .select("id,name,category:cruising_categories(name)")
        .order("name");
      if (!active) return;
      if (err) {
        setError(err.message);
      } else if (data) {
        setSpots(
          data.map((p) => ({
            id: p.id as string,
            name: (p as any).name as string,
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
        <div className="text-lg font-semibold text-foreground">Cruising</div>
        <Link href="/admin/cruising/add">
          <Button size="sm">Add spot</Button>
        </Link>
      </div>
      {loading ? (
        <div className="text-sm text-muted-foreground">Loading…</div>
      ) : error ? (
        <div className="text-sm text-destructive">{error}</div>
      ) : spots.length === 0 ? (
        <div className="text-sm text-muted-foreground">No spots found.</div>
      ) : (
        <div className="space-y-2">
          {spots.map((p) => (
            <div
              key={p.id}
              className="flex items-center justify-between rounded-lg border border-border/60 bg-background/70 px-4 py-3 text-sm shadow-sm"
            >
              <div className="flex flex-col">
                <span className="font-medium text-foreground">{p.name}</span>
                <span className="text-[12px] text-muted-foreground">
                  {p.category?.name || "—"}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
