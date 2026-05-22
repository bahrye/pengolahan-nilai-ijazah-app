import { afterEach, describe, expect, it } from "vitest";

import { clearAllRateLimitsForTests, consumeRateLimit } from "@/lib/rate-limit";

afterEach(() => {
  clearAllRateLimitsForTests();
});

describe("consumeRateLimit", () => {
  it("allows requests under the limit", () => {
    const r1 = consumeRateLimit("k", 3, 60_000);
    const r2 = consumeRateLimit("k", 3, 60_000);
    expect(r1.ok).toBe(true);
    expect(r2.ok).toBe(true);
    if (r2.ok) expect(r2.remaining).toBe(1);
  });

  it("blocks when limit exceeded", () => {
    consumeRateLimit("k", 2, 60_000);
    consumeRateLimit("k", 2, 60_000);
    const r3 = consumeRateLimit("k", 2, 60_000);
    expect(r3.ok).toBe(false);
    if (!r3.ok) expect(r3.retryAfterSec).toBeGreaterThan(0);
  });
});
