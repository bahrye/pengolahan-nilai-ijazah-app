const TTL_MS = 15 * 60 * 1000;
const MAX_ENTRIES = 32;

const cache = new Map<string, { dataUrl: string; expiresAt: number }>();

async function fetchLetterhead(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(8_000) });
    if (!res.ok) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    const mime = res.headers.get("content-type")?.split(";")[0]?.trim() || "image/png";
    return `data:${mime};base64,${buf.toString("base64")}`;
  } catch {
    return null;
  }
}

/** Data URL kop surat — di-cache per URL agar pratinjau/unduh SKL tidak fetch ulang. */
export async function getCachedLetterheadDataUrl(url: string): Promise<string | null> {
  const key = url.trim();
  if (!key) return null;

  const now = Date.now();
  const hit = cache.get(key);
  if (hit && hit.expiresAt > now) return hit.dataUrl;

  const dataUrl = await fetchLetterhead(key);
  if (!dataUrl) return null;

  if (cache.size >= MAX_ENTRIES) {
    const oldest = cache.keys().next().value;
    if (oldest) cache.delete(oldest);
  }
  cache.set(key, { dataUrl, expiresAt: now + TTL_MS });
  return dataUrl;
}
