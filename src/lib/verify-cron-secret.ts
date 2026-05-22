import { createHash, timingSafeEqual } from "node:crypto";

/** Ekstrak token dari permintaan cron (Bearer atau header kustom). */
export function extractCronTokenFromRequest(request: Request): string | null {
  const auth = request.headers.get("authorization");
  if (auth?.startsWith("Bearer ")) {
    const t = auth.slice(7).trim();
    return t.length > 0 ? t : null;
  }
  const x = request.headers.get("x-cron-secret")?.trim();
  return x && x.length > 0 ? x : null;
}

/**
 * Verifikasi token terhadap rahasia server (perbandingan aman-waktu via SHA-256).
 */
export function verifyCronSecret(provided: string | null, secret: string): boolean {
  if (!provided || !secret) return false;
  const a = createHash("sha256").update(provided, "utf8").digest();
  const b = createHash("sha256").update(secret, "utf8").digest();
  return timingSafeEqual(a, b);
}
