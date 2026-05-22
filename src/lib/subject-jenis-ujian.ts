export {
  JENIS_UJIAN_KEDUANYA,
  JENIS_UJIAN_MADRASAH,
  JENIS_UJIAN_PRAKTEK,
  JENIS_UJIAN_SEKOLAH,
  formatJenisUjianLabel,
  isUjianTertulisJenis,
  jenisUjianOptions,
  normalizeJenisUjianForSchool,
  ujianTertulisJenisValue,
} from "@/lib/school-terminology";

import {
  ujianTertulisJenisValue,
  type JenisUjianTertulisValue,
} from "@/lib/school-terminology";

import type { SchoolLevel } from "@prisma/client";

/** @deprecated Gunakan `jenisUjianOptions(jenjang)` — butuh konteks jenjang. */
export const JENIS_UJIAN_VALUES = [
  "Ujian Madrasah",
  "Ujian Sekolah",
  "Ujian Praktek",
  "Keduanya",
] as const;

/** Default impor tanpa jenjang (fallback madrasah). */
export const DEFAULT_JENIS_UJIAN: JenisUjianTertulisValue = "Ujian Madrasah";

export function defaultJenisUjianForJenjang(
  jenjang: SchoolLevel | null | undefined,
): JenisUjianTertulisValue {
  return ujianTertulisJenisValue(jenjang);
}

export function defaultJenisUjianLabel(
  jenjang: SchoolLevel | null | undefined,
): string {
  return ujianTertulisJenisValue(jenjang);
}
