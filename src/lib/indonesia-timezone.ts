/**
 * Zona waktu Indonesia & konversi jam dinding ↔ UTC (IANA timeZone).
 * Satu sumber untuk WIB/WITA/WIT, datetime-local, dan jadwal pengumuman.
 */

export type Ymd = { y: number; m: number; d: number };

/** Zona IANA Indonesia Barat (WIB) — pemeliharaan platform, fallback server. */
export const INDONESIA_WIB_TIME_ZONE = "Asia/Jakarta";

/** Jam pengumuman contoh (besok, waktu lokal). */
export const FREE_PENGUMUMAN_HOUR = 10;

const DATETIME_LOCAL_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/;

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

/** Offset jam dari UTC untuk instan di zona peramban (atau zona IANA). */
export function utcOffsetHoursAt(instant: Date, timeZone?: string): number {
  if (!timeZone) return -instant.getTimezoneOffset() / 60;
  const z = getZonedParts(instant, normalizeTimeZone(timeZone));
  const zAsIfUtc = Date.UTC(z.y, z.m - 1, z.d, z.hour, z.minute);
  return (zAsIfUtc - instant.getTime()) / 3_600_000;
}

/** Label singkat zona Indonesia umum; selain itu tampilkan GMT±… */
export function indonesiaTzAbbrevFromOffsetHours(
  offsetHours: number,
): "WIB" | "WITA" | "WIT" | string {
  const h = offsetHours;
  if (h === 7) return "WIB";
  if (h === 8) return "WITA";
  if (h === 9) return "WIT";
  const rounded = Number.isInteger(h) ? h : Math.round(h * 10) / 10;
  const sign = rounded >= 0 ? "+" : "";
  return `GMT${sign}${rounded}`;
}

export function indonesiaTzAbbrevForTimeZone(timeZone: string, at = new Date()): string {
  return indonesiaTzAbbrevFromOffsetHours(utcOffsetHoursAt(at, timeZone));
}

/** Validasi IANA; fallback {@link INDONESIA_WIB_TIME_ZONE}. */
export function normalizeTimeZone(tz: string | undefined | null): string {
  const t = tz?.trim();
  if (!t) return INDONESIA_WIB_TIME_ZONE;
  try {
    Intl.DateTimeFormat(undefined, { timeZone: t });
    return t;
  } catch {
    return INDONESIA_WIB_TIME_ZONE;
  }
}

type ZonedParts = { y: number; m: number; d: number; hour: number; minute: number };

function getZonedParts(instant: Date, timeZone: string): ZonedParts {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const parts = fmt.formatToParts(instant);
  const pick = (type: string) =>
    parseInt(parts.find((p) => p.type === type)?.value ?? "0", 10);
  let hour = pick("hour");
  if (hour === 24) hour = 0;
  return {
    y: pick("year"),
    m: pick("month"),
    d: pick("day"),
    hour,
    minute: pick("minute"),
  };
}

/** Tanggal kalender di `timeZone` untuk suatu instan UTC. */
export function localYmdFromInstant(instant: Date, timeZone: string): Ymd {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const [y, m, d] = fmt.format(instant).split("-").map((x) => parseInt(x, 10));
  return { y, m, d };
}

function addCalendarDays(y: number, m: number, d: number, days: number): Ymd {
  const shifted = new Date(Date.UTC(y, m - 1, d + days));
  return {
    y: shifted.getUTCFullYear(),
    m: shifted.getUTCMonth() + 1,
    d: shifted.getUTCDate(),
  };
}

/** UTC instant untuk jam dinding di zona IANA. */
export function utcFromWallClock(
  timeZone: string,
  y: number,
  m: number,
  d: number,
  hour: number,
  minute = 0,
): Date {
  const tz = normalizeTimeZone(timeZone);
  let utcMs = Date.UTC(y, m - 1, d, hour, minute);
  for (let i = 0; i < 8; i++) {
    const z = getZonedParts(new Date(utcMs), tz);
    const desiredAsUtc = Date.UTC(y, m - 1, d, hour, minute);
    const actualAsUtc = Date.UTC(z.y, z.m - 1, z.d, z.hour, z.minute);
    const diff = desiredAsUtc - actualAsUtc;
    if (diff === 0) break;
    utcMs += diff;
  }
  return new Date(utcMs);
}

/** Zona waktu peramban (lokasi pengguna). */
export function getBrowserTimeZone(): string {
  try {
    return normalizeTimeZone(Intl.DateTimeFormat().resolvedOptions().timeZone);
  } catch {
    return INDONESIA_WIB_TIME_ZONE;
  }
}

/** ISO UTC → nilai `<input type="datetime-local">` di zona `timeZone`. */
export function isoUtcToDatetimeLocal(
  isoUtc: string | null | undefined,
  timeZone: string,
): string {
  if (!isoUtc?.trim()) return "";
  const d = new Date(isoUtc);
  if (Number.isNaN(d.getTime())) return "";
  const tz = normalizeTimeZone(timeZone);
  const z = getZonedParts(d, tz);
  return `${z.y}-${pad2(z.m)}-${pad2(z.d)}T${pad2(z.hour)}:${pad2(z.minute)}`;
}

/** Nilai datetime-local (tanpa zona) → ISO UTC; kosong/invalid → `null`. */
export function datetimeLocalToIsoUtc(localValue: string, timeZone: string): string | null {
  const trimmed = localValue.trim();
  if (!trimmed) return null;
  if (!DATETIME_LOCAL_PATTERN.test(trimmed)) return null;
  const [datePart, timePart] = trimmed.split("T");
  const [y, m, d] = datePart.split("-").map((x) => parseInt(x, 10));
  const [hour, minute] = timePart.split(":").map((x) => parseInt(x, 10));
  if (
    !Number.isFinite(y) ||
    !Number.isFinite(m) ||
    !Number.isFinite(d) ||
    !Number.isFinite(hour) ||
    !Number.isFinite(minute)
  ) {
    return null;
  }
  return utcFromWallClock(normalizeTimeZone(timeZone), y, m, d, hour, minute).toISOString();
}

/** datetime-local ↔ UTC memakai zona peramban (WIB/WITA/WIT sesuai lokasi). */
export function isoUtcToDatetimeLocalBrowser(isoUtc: string | null | undefined): string {
  return isoUtcToDatetimeLocal(isoUtc, getBrowserTimeZone());
}

export function datetimeLocalToIsoUtcBrowser(localValue: string): string | null {
  return datetimeLocalToIsoUtc(localValue, getBrowserTimeZone());
}

/** datetime-local ↔ UTC tetap WIB (pemeliharaan platform). */
export function isoUtcToDatetimeLocalWib(isoUtc: string | null | undefined): string {
  return isoUtcToDatetimeLocal(isoUtc, INDONESIA_WIB_TIME_ZONE);
}

export function datetimeLocalToUtcWib(localValue: string): Date | null {
  const iso = datetimeLocalToIsoUtc(localValue, INDONESIA_WIB_TIME_ZONE);
  if (!iso) return null;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Teks tanggal+jam dalam zona tertentu + label WIB/WITA/WIT. */
export function formatInstantInTimeZone(
  isoOrDate: Date | string | null | undefined,
  timeZone: string,
  options?: { hour12?: boolean; dateTimeSeparator?: string },
): string {
  if (isoOrDate == null || isoOrDate === "") return "—";
  const d = typeof isoOrDate === "string" ? new Date(isoOrDate) : isoOrDate;
  if (Number.isNaN(d.getTime())) return "—";
  const tz = normalizeTimeZone(timeZone);
  const sep = options?.dateTimeSeparator ?? ", ";
  const tanggal = new Intl.DateTimeFormat("id-ID", {
    timeZone: tz,
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(d);
  const jam = new Intl.DateTimeFormat("id-ID", {
    timeZone: tz,
    hour: "numeric",
    minute: "2-digit",
    hour12: options?.hour12 ?? false,
  }).format(d);
  const abbrev = indonesiaTzAbbrevForTimeZone(tz, d);
  return `${tanggal}${sep}${jam} ${abbrev}`;
}

/** Format instan UTC untuk tampilan di zona peramban (gaya pengumuman kelulusan). */
export function formatInstantForBrowser(isoUtc: string): string {
  const d = new Date(isoUtc);
  if (Number.isNaN(d.getTime())) return "";
  const tz = getBrowserTimeZone();
  const tanggal = new Intl.DateTimeFormat("id-ID", {
    timeZone: tz,
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(d);
  const jamMenit = new Intl.DateTimeFormat("en-GB", {
    timeZone: tz,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(d);
  const abbrev = indonesiaTzAbbrevForTimeZone(tz, d);
  return `${tanggal} - ${jamMenit} ${abbrev}`;
}
