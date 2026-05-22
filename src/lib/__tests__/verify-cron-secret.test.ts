import { describe, expect, it } from "vitest";

import { extractCronTokenFromRequest, verifyCronSecret } from "../verify-cron-secret";

describe("verifyCronSecret", () => {
  it("menerima token yang sama", () => {
    expect(verifyCronSecret("s3cret", "s3cret")).toBe(true);
  });

  it("menolak token salah", () => {
    expect(verifyCronSecret("wrong", "s3cret")).toBe(false);
  });

  it("menolak null", () => {
    expect(verifyCronSecret(null, "s3cret")).toBe(false);
  });
});

describe("extractCronTokenFromRequest", () => {
  it("membaca Bearer", () => {
    const r = new Request("https://x.test/api/keep-alive", {
      headers: { Authorization: "Bearer abc123" },
    });
    expect(extractCronTokenFromRequest(r)).toBe("abc123");
  });

  it("membaca X-Cron-Secret", () => {
    const r = new Request("https://x.test/", {
      headers: { "X-Cron-Secret": "xyz" },
    });
    expect(extractCronTokenFromRequest(r)).toBe("xyz");
  });
});
