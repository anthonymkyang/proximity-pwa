// components/photos/useSignedUpload.ts
"use client";

type UploadOpts = {
  kind: "public" | "private" | "album";
  albumId?: string;
  isMain?: boolean;
  position?: number;
};

export function useSignedUpload() {
  async function upload(file: File, opts: UploadOpts) {
    const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";

    // 1) ask server for signed upload URL
    const url =
      opts.kind === "public"
        ? "/api/photos/public/upload-url"
        : opts.kind === "private"
        ? "/api/photos/private/upload-url"
        : `/api/albums/${opts.albumId}/items/upload-url`;

    const r1 = await fetch(url, {
      method: "POST",
      body: JSON.stringify({ ext }),
      headers: { "Content-Type": "application/json" },
    });
    if (!r1.ok) throw new Error(`Failed to get upload URL`);
    const { uploadUrl, objectKey } = await r1.json();

    // 2) PUT file directly to storage using signed URL
    const r2 = await fetch(uploadUrl, { method: "PUT", body: file });
    if (!r2.ok) throw new Error(`Upload failed`);

    // 3) confirm DB insert
    if (opts.kind === "public") {
      const r3 = await fetch("/api/photos/public/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          objectKey,
          is_main: !!opts.isMain,
          position: opts.position ?? 0,
        }),
      });
      if (!r3.ok) throw new Error(`Confirm failed`);
      return (await r3.json()).photo;
    }

    if (opts.kind === "private") {
      const r3 = await fetch("/api/photos/private/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          objectKey,
          position: opts.position ?? 0,
        }),
      });
      if (!r3.ok) throw new Error(`Confirm failed`);
      return (await r3.json()).photo;
    }

    if (opts.kind === "album") {
      if (!opts.albumId) throw new Error("albumId required");
      const r3 = await fetch(`/api/albums/${opts.albumId}/items/confirm`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          objectKey,
          position: opts.position ?? 0,
        }),
      });
      if (!r3.ok) throw new Error(`Confirm failed`);
      return (await r3.json()).item;
    }
  }

  return { upload };
}
