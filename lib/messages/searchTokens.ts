const urlRegex = /(https?:\/\/[^\s]+)/gi;

export function extractSearchTokens(text: string): string[] {
  const tokens = new Set<string>();
  const lower = text.toLowerCase();

  const words = lower.match(/[a-z0-9]+/gi) ?? [];
  for (const word of words) {
    if (/^\d+$/.test(word)) {
      if (word.length < 3) continue;
    } else if (word.length < 2) {
      continue;
    }
    tokens.add(word);
  }

  const urls = lower.match(urlRegex) ?? [];
  for (const raw of urls) {
    try {
      const parsed = new URL(raw);
      const host = parsed.hostname.replace(/^www\./, "");
      if (host) {
        tokens.add(host);
        host.split(".").forEach((part) => {
          if (part.length >= 2) tokens.add(part);
        });
      }
      const pathParts = parsed.pathname.split("/").filter(Boolean);
      pathParts.forEach((part) => {
        if (part.length >= 2) tokens.add(part);
      });
    } catch {
      // ignore malformed URLs
    }
  }

  return Array.from(tokens).slice(0, 40);
}

function bufferToHex(buffer: ArrayBuffer) {
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function hashSearchTokens(tokens: string[]): Promise<string[]> {
  if (!tokens.length) return [];
  const subtle = globalThis.crypto?.subtle;
  if (!subtle) return [];
  const encoder = new TextEncoder();
  const hashed = await Promise.all(
    tokens.map(async (token) => {
      const data = encoder.encode(token);
      const digest = await subtle.digest("SHA-256", data);
      return bufferToHex(digest);
    })
  );
  return hashed.filter(Boolean);
}
