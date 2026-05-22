import { describe, expect, it } from "vitest";

import {
  datetimeLocalToIsoUtc,
  datetimeLocalToIsoUtcBrowser,
  formatInstantForBrowser,
  INDONESIA_WIB_TIME_ZONE,
  isoUtcToDatetimeLocal,
  isoUtcToDatetimeLocalWib,
  normalizeTimeZone,
  utcFromWallClock,
} from "@/lib/indonesia-timezone";

const WIB = INDONESIA_WIB_TIME_ZONE;
const WITA = "Asia/Makassar";

describe("datetime-local ↔ ISO UTC", () => {
  it("roundtrip WIB", () => {
    const local = "2026-05-19T10:00";
    const iso = datetimeLocalToIsoUtc(local, WIB);
    expect(iso).toBeTruthy();
    expect(isoUtcToDatetimeLocal(iso!, WIB)).toBe(local);
  });

  it("roundtrip WITA", () => {
    const local = "2026-05-19T10:00";
    const iso = datetimeLocalToIsoUtc(local, WITA);
    expect(iso).toBeTruthy();
    expect(isoUtcToDatetimeLocal(iso!, WITA)).toBe(local);
  });

  it("WIB dan WITA jam 10 menghasilkan UTC berbeda 1 jam", () => {
    const isoWib = datetimeLocalToIsoUtc("2026-05-19T10:00", WIB)!;
    const isoWita = datetimeLocalToIsoUtc("2026-05-19T10:00", WITA)!;
    expect(Math.abs(Date.parse(isoWita) - Date.parse(isoWib))).toBe(3_600_000);
  });

  it("isoUtcToDatetimeLocalWib dari UTC", () => {
    const utc = utcFromWallClock(WIB, 2026, 5, 19, 10, 0);
    expect(isoUtcToDatetimeLocalWib(utc.toISOString())).toBe("2026-05-19T10:00");
  });
});

describe("normalizeTimeZone", () => {
  it("invalid → Jakarta", () => {
    expect(normalizeTimeZone("Not/A_Zone")).toBe(WIB);
  });
});

describe("formatInstantForBrowser", () => {
  it("menyertakan label zona dari offset", () => {
    const utc = utcFromWallClock(WITA, 2026, 5, 19, 10, 0).toISOString();
    const formatted = formatInstantForBrowser(utc);
    expect(formatted).toMatch(/WITA|WIB|WIT|GMT/);
  });
});
