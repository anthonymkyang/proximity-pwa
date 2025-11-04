// app/(app)/app/settings/photos/private/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/utils/supabase/client";
import { useSignedUpload } from "@/components/photos/useSignedUpload";
import { Button } from "@/components/ui/button";

type PrivatePhoto = { id: string; object_key: string; position: number };

export default function PrivatePhotosPage() {
  const supabase = createClient();
  const { upload } = useSignedUpload();
  const [rows, setRows] = useState<PrivatePhoto[]>([]);
  const [urls, setUrls] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    const { data } = await supabase
      .from("profile_photos_private")
      .select("*")
      .order("position", { ascending: true });

    setRows(data || []);

    // sign read URLs
    const ownerId = (await supabase.auth.getUser()).data.user?.id;
    if (ownerId && (data?.length ?? 0) > 0) {
      const r = await fetch("/api/photos/private/sign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ owner_id: ownerId }),
      });
      const j = await r.json();
      setUrls(j.urls?.map((u: any) => u.signedUrl) || []);
    } else {
      setUrls([]);
    }
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function handleFilePick(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    await upload(f, { kind: "private", position: rows.length });
    await load();
  }

  async function remove(id: string) {
    await fetch(`/api/photos/private/${id}`, { method: "DELETE" });
    await load();
  }

  return (
    <div className="px-4 py-6 space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold">Private photos</h1>
          <p className="text-sm text-muted-foreground">
            Up to 8. Visible only to people you unlock.
          </p>
        </div>
        <label className="inline-flex">
          <input
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleFilePick}
          />
          <Button>Add photo</Button>
        </label>
      </header>

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : null}

      <ul className="grid grid-cols-3 gap-3">
        {rows.map((r, idx) => (
          <li key={r.id} className="relative">
            <img
              src={urls[idx] || "/placeholder.svg"}
              alt=""
              className="aspect-square w-full rounded-lg object-cover border border-border"
            />
            <div className="mt-2 flex gap-2">
              <Button
                size="sm"
                variant="destructive"
                onClick={() => remove(r.id)}
              >
                Delete
              </Button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
