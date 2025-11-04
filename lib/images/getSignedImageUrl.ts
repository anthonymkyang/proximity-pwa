import { createClient } from "@/utils/supabase/client";

// Public API accepted by our helper. We intentionally allow `format` here
// for future compatibility, but we do NOT pass it into Supabase's
// `createSignedUrl` transform because the current typings only accept
// `format: 'origin'`. Next/Image can still do format negotiation (AVIF/WebP).
export type TransformInput = {
  width?: number;
  height?: number;
  quality?: number; // 1..100
  resize?: "cover" | "contain" | "fill";
  format?: "webp" | "jpeg" | "png"; // ignored for Supabase signed URLs
};

export async function getSignedImageUrl(
  bucket: string,
  objectKey: string,
  expiresIn = 60, // seconds
  transform: TransformInput = {}
) {
  const supabase = createClient();

  // Strip `format` to satisfy current Supabase typings for TransformOptions.
  const { format: _ignoredFormat, ...rest } = transform ?? {};

  const supabaseTransform: {
    width?: number;
    height?: number;
    quality?: number;
    resize?: "cover" | "contain" | "fill";
  } = {
    ...rest,
    quality: rest.quality ?? 70,
  };

  const { data, error } = await supabase.storage
    .from(bucket)
    .createSignedUrl(objectKey, expiresIn, {
      transform: supabaseTransform,
    });

  if (error || !data?.signedUrl) return null;
  return data.signedUrl;
}
