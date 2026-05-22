import type { SchoolLevel } from "@prisma/client";

/** Pola semester kelas atas dasar (setara MI kelas 4–6). */
const SEMESTER_KEYS_SD_LIKE = [
  "k4_ganjil",
  "k4_genap",
  "k5_ganjil",
  "k5_genap",
  "k6_ganjil",
  "k6_genap",
] as const;

/** Pola semester jenjang menengah pertama (setara MTS). */
const SEMESTER_KEYS_SMP_LIKE = [
  "k7_ganjil",
  "k7_genap",
  "k8_ganjil",
  "k8_genap",
  "k9_ganjil",
  "k9_genap",
] as const;

/** Pola semester menengah atas / kejuruan (setara MA, 5 semester terakhir). */
const SEMESTER_KEYS_SMA_LIKE = [
  "k10_ganjil",
  "k10_genap",
  "k11_ganjil",
  "k11_genap",
  "k12_ganjil",
  "k12_genap",
] as const;

/** PAUD / nonformal awal: slot generik (bukan k7–k12). */
const SEMESTER_KEYS_PAUD = [
  "paud_1",
  "paud_2",
  "paud_3",
  "paud_4",
  "paud_5",
  "paud_6",
] as const;

/** Kunci semester internal untuk setiap jenjang (sejajar ijazah-web). */
export const SEMESTER_KEYS_BY_LEVEL: Record<SchoolLevel, readonly string[]> = {
  MI: SEMESTER_KEYS_SD_LIKE,
  MTS: SEMESTER_KEYS_SMP_LIKE,
  MA: SEMESTER_KEYS_SMA_LIKE,
  KB: SEMESTER_KEYS_PAUD,
  TK: SEMESTER_KEYS_PAUD,
  RA: SEMESTER_KEYS_PAUD,
  TPA: SEMESTER_KEYS_PAUD,
  SD: SEMESTER_KEYS_SD_LIKE,
  SDLB: SEMESTER_KEYS_SD_LIKE,
  SMP: SEMESTER_KEYS_SMP_LIKE,
  SMPLB: SEMESTER_KEYS_SMP_LIKE,
  SMA: SEMESTER_KEYS_SMA_LIKE,
  SMALB: SEMESTER_KEYS_SMA_LIKE,
  SMK: SEMESTER_KEYS_SMA_LIKE,
  SLB: SEMESTER_KEYS_SMP_LIKE,
  PKBM: SEMESTER_KEYS_SMA_LIKE,
};

export function semestersForSchool(
  jenjang: SchoolLevel | null | undefined,
  raporSemesterCount: number,
): string[] {
  if (!jenjang) return [];
  const full = [...SEMESTER_KEYS_BY_LEVEL[jenjang]];
  const isSD = jenjang === "MI" || jenjang === "SD" || jenjang === "SDLB";

  if (isSD) {
    if (raporSemesterCount === 3) {
      return full.slice(2, 5); // k5_ganjil, k5_genap, k6_ganjil
    }
    if (raporSemesterCount === 4) {
      return full.slice(2, 6); // k5_ganjil, k5_genap, k6_ganjil, k6_genap
    }
  }

  if (raporSemesterCount === 5) {
    return full.slice(0, 5);
  }
  return full;
}
