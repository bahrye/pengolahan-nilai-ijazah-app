import {
  FREE_PENGUMUMAN_HOUR,
  localYmdFromInstant,
  normalizeTimeZone,
  utcFromWallClock,
} from "@/lib/indonesia-timezone";

export { FREE_PENGUMUMAN_HOUR };

/**
 * Jadwal pengumuman contoh untuk sekolah free: selalu **besok** pukul 10:00
 * di zona waktu lokasi admin (WIB / WITA / WIT sesuai perangkat).
 * Setelah lewat pukul 10:00 lokal, "besok" bergeser (reset harian).
 */
export function freeTierDummyAnnouncementAt(
  now = new Date(),
  timeZone?: string | null,
): Date {
  const tz = normalizeTimeZone(timeZone);
  const today = localYmdFromInstant(now, tz);
  const tomorrow = addCalendarDays(today.y, today.m, today.d, 1);
  return utcFromWallClock(tz, tomorrow.y, tomorrow.m, tomorrow.d, FREE_PENGUMUMAN_HOUR, 0);
}

function addCalendarDays(y: number, m: number, d: number, days: number) {
  const shifted = new Date(Date.UTC(y, m - 1, d + days));
  return {
    y: shifted.getUTCFullYear(),
    m: shifted.getUTCMonth() + 1,
    d: shifted.getUTCDate(),
  };
}
