import type { SchoolLevel } from "@prisma/client";
import { z } from "zod";

/**
 * Semua nilai `SchoolLevel` (Prisma) — urutan: nilai lama dulu, lalu tambahan (aman untuk migrasi DB).
 */
export const ALL_SCHOOL_LEVELS = [
  "MI",
  "MTS",
  "MA",
  "KB",
  "TK",
  "RA",
  "TPA",
  "SD",
  "SDLB",
  "SMP",
  "SMPLB",
  "SMA",
  "SMALB",
  "SMK",
  "SLB",
  "PKBM",
] as const satisfies readonly SchoolLevel[];

export const schoolLevelSchema = z.enum(ALL_SCHOOL_LEVELS);

/** Label singkat untuk dropdown / registrasi. */
export const SCHOOL_LEVEL_LABEL: Record<SchoolLevel, string> = {
  MI: "MI — Madrasah Ibtidaiyah",
  MTS: "MTS — Madrasah Tsanawiyah",
  MA: "MA — Madrasah Aliyah",
  KB: "KB — Kelompok Bermain",
  TK: "TK — Taman Kanak-kanak",
  RA: "RA — Raudhatul Athfadl",
  TPA: "TPA / sederajat",
  SD: "SD — Sekolah Dasar",
  SDLB: "SDLB — SD Luar Biasa",
  SMP: "SMP — Sekolah Menengah Pertama",
  SMPLB: "SMPLB — SMP Luar Biasa",
  SMA: "SMA — Sekolah Menengah Atas",
  SMALB: "SMALB — SMA Luar Biasa",
  SMK: "SMK — Sekolah Menengah Kejuruan",
  SLB: "SLB — Sekolah Luar Biasa (umum)",
  PKBM: "PKBM — Pusat Kegiatan Belajar Masyarakat",
};

/**
 * Memetakan teks `bentukPendidikan` dari referensi NPSN/Dapodik ke `SchoolLevel`.
 * Bentuk yang tidak dikenali mengembalikan `null` (admin bisa set manual di data sekolah).
 */
export function mapBentukPendidikanToJenjang(
  bentuk: string | null | undefined,
): SchoolLevel | null {
  const raw = (bentuk ?? "").trim();
  if (!raw) return null;

  const u = raw.toUpperCase();

  // Luar biasa / khusus (cek sebelum pola "SD"/"SMP" umum).
  if (/\bSDLB\b/i.test(raw) || u.includes("SD LUAR BIASA")) return "SDLB";
  if (/\bSMPLB\b/i.test(raw) || u.includes("SMP LUAR BIASA")) return "SMPLB";
  if (/\bSMALB\b/i.test(raw) || u.includes("SMA LUAR BIASA")) return "SMALB";
  if (u.includes("PKBM")) return "PKBM";
  if (/\bSLB\b/i.test(raw) || u.includes("SEKOLAH LUAR BIASA")) return "SLB";

  // Kejuruan / vokasi.
  if (u.includes("SMK") || u.includes("STM")) return "SMK";

  // Menengah atas umum & madrasah atas.
  if (u.includes("SMA") && !u.includes("SMALB")) return "SMA";
  if (u.includes("ALIYAH") || /\bMA\b/.test(u)) return "MA";

  // Menengah pertama.
  if (u.includes("SMP") && !u.includes("SMPLB") && !u.includes("MTS")) return "SMP";
  if (u.includes("TSANAWIYAH") || u.includes("MTS")) return "MTS";

  // Dasar.
  if (u.includes("SD") && !u.includes("SDLB")) return "SD";
  if (u.includes("IBTIDAI") || /\bMI\b/.test(u)) return "MI";

  // PAUD / nonformal awal.
  if (u.includes("KELOMPOK BERMAIN") || /\bKB\b/.test(u)) return "KB";
  if (u.includes("TAMAN KANAK") || /\bTK\b/.test(u)) return "TK";
  if (u.includes("RAUDHAT") || u.includes("ATHFAL") || /\bRA\b/.test(u)) return "RA";
  if (u.includes("TPA") || u.includes("SATPEN")) return "TPA";

  return null;
}
