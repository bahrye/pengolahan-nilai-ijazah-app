type Bucket = {
  count: number;
  resetAt: number;
};

const buckets = new Map<string, Bucket>();

/** Hapus entri kadaluarsa agar Map tidak membengkak tanpa batas. */
function pruneExpired(now: number) {
  if (buckets.size < 500) return;
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) buckets.delete(key);
  }
}

export type RateLimitResult =
  | { ok: true; remaining: number }
  | { ok: false; retryAfterSec: number };

/**
 * Fixed-window rate limiter (in-memory, per instance).
 * Cocok untuk mitigasi brute force pada rute login; di serverless setiap instance punya kuota sendiri.
 */
export function consumeRateLimit(
  key: string,
  limit: number,
  windowMs: number,
): RateLimitResult {
  const now = Date.now();
  pruneExpired(now);

  let bucket = buckets.get(key);
  if (!bucket || bucket.resetAt <= now) {
    bucket = { count: 0, resetAt: now + windowMs };
    buckets.set(key, bucket);
  }

  bucket.count += 1;
  if (bucket.count > limit) {
    return {
      ok: false,
      retryAfterSec: Math.max(1, Math.ceil((bucket.resetAt - now) / 1000)),
    };
  }

  return { ok: true, remaining: Math.max(0, limit - bucket.count) };
}

/** Cek kuota tanpa menambah hit (untuk credentials sebelum verifikasi sandi). */
export function peekRateLimit(key: string, limit: number): RateLimitResult {
  const now = Date.now();
  const bucket = buckets.get(key);
  if (!bucket || bucket.resetAt <= now) {
    return { ok: true, remaining: limit };
  }
  if (bucket.count >= limit) {
    return {
      ok: false,
      retryAfterSec: Math.max(1, Math.ceil((bucket.resetAt - now) / 1000)),
    };
  }
  return { ok: true, remaining: Math.max(0, limit - bucket.count) };
}

/** Reset counter (mis. setelah login berhasil). */
export function resetRateLimit(key: string) {
  buckets.delete(key);
}

/** Hanya untuk unit test. */
export function clearAllRateLimitsForTests() {
  buckets.clear();
}
