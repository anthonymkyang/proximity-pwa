import { createClient } from "@/utils/supabase/client";

/**
 * Resolve an avatar reference to a public URL.
 * - If `path` is already an absolute URL (http/https/data), return as-is.
 * - Otherwise, treat it as a Storage object path in the avatars bucket and
 *   return the public URL (bucket is configurable via NEXT_PUBLIC_SUPABASE_AVATARS_BUCKET).
 */
export default function getAvatarPublicUrl(
  path?: string | null
): string | null {
  if (!path) return null;

  // Already an absolute or data URL
  const lower = path.toLowerCase();
  if (
    lower.startsWith("http://") ||
    lower.startsWith("https://") ||
    lower.startsWith("data:")
  ) {
    return path;
  }

  try {
    const bucket = process.env.NEXT_PUBLIC_SUPABASE_AVATARS_BUCKET || "avatars";
    const supabase = createClient();

    // Normalize the key (strip leading slashes)
    const key = path.replace(/^\/+/, "");

    const { data } = supabase.storage.from(bucket).getPublicUrl(key);
    return data?.publicUrl ?? null;
  } catch {
    return null;
  }
}
