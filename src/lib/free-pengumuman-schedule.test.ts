import { describe, expect, it } from "vitest";

import { freeTierDummyAnnouncementAt } from "@/lib/free-pengumuman-schedule";
import {
  indonesiaTzAbbrevForTimeZone,
  localYmdFromInstant,
  utcFromWallClock,
} from "@/lib/indonesia-timezone";

const WIB = "Asia/Jakarta";
const WITA = "Asia/Makassar";

describe("freeTierDummyAnnouncementAt", () => {
  it("mengarah ke besok 10:00 WIB (Jakarta)", () => {
    const now = utcFromWallClock(WIB, 2026, 5, 18, 8, 0);
    const at = freeTierDummyAnnouncementAt(now, WIB);
    expect(at.getTime()).toBe(utcFromWallClock(WIB, 2026, 5, 19, 10, 0).getTime());
  });

  it("mengarah ke besok 10:00 WITA (Makassar / Sulawesi)", () => {
    const now = utcFromWallClock(WITA, 2026, 5, 18, 8, 0);
    const at = freeTierDummyAnnouncementAt(now, WITA);
    expect(at.getTime()).toBe(utcFromWallClock(WITA, 2026, 5, 19, 10, 0).getTime());
  });

  it("WITA dan WIB jam 10:00 tidak sama dalam UTC", () => {
    const wib = utcFromWallClock(WIB, 2026, 5, 19, 10, 0);
    const wita = utcFromWallClock(WITA, 2026, 5, 19, 10, 0);
    expect(Math.abs(wita.getTime() - wib.getTime())).toBe(3_600_000);
  });

  it("setelah 10:00 lokal, besok bergeser", () => {
    const now = utcFromWallClock(WIB, 2026, 5, 18, 10, 5);
    const at = freeTierDummyAnnouncementAt(now, WIB);
    expect(at.getTime()).toBe(utcFromWallClock(WIB, 2026, 5, 19, 10, 0).getTime());
  });

  it("label zona untuk Makassar adalah WITA", () => {
    const at = utcFromWallClock(WITA, 2026, 5, 19, 10, 0);
    expect(indonesiaTzAbbrevForTimeZone(WITA, at)).toBe("WITA");
  });

  it("localYmdFromInstant selaras kalender WIB", () => {
    const instant = utcFromWallClock(WIB, 2026, 5, 18, 23, 30);
    expect(localYmdFromInstant(instant, WIB)).toEqual({ y: 2026, m: 5, d: 18 });
  });
});
