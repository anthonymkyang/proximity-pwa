/****
 * Build a same-origin proxy URL for a user avatar stored in Supabase Storage.
 * This avoids using public bucket URLs and relies on the authenticated
 * /api/photos/avatars route to generate a signed URL or stream the file.
 *
 * Behavior:
 * - If `path` is already an absolute URL (http/https/data), return as-is.
 * - Otherwise, treat it as a Storage object key inside the avatars bucket and
 *   return the internal API route URL: /api/photos/avatars?path=<key>
 *
 * NOTE: The internal implementation is named `buildAvatarProxyUrl`, exported by default and also aliased as a named export `getAvatarProxyUrl` for backward compatibility.
 */
function buildAvatarProxyUrl(path?: string | null): string | null {
  if (!path) return null;

  const lower = path.toLowerCase();
  if (
    lower.startsWith("http://") ||
    lower.startsWith("https://") ||
    lower.startsWith("data:")
  ) {
    return path;
  }

  // Normalize storage key by stripping any leading slashes
  const key = path.replace(/^\/+/, "");
  // Return same-origin API route that handles auth + signed access
  const url = `/api/photos/avatars?path=${encodeURIComponent(key)}`;
  return url;
}

// Exports
export default buildAvatarProxyUrl;
export { buildAvatarProxyUrl as getAvatarProxyUrl };
