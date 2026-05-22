import type { SchoolLevel } from "@prisma/client";

const JENJANG_LONG: Partial<Record<SchoolLevel, string>> = {
  MI: "Madrasah Ibtidaiyah",
  MTS: "Madrasah Tsanawiyah",
  MA: "Madrasah Aliyah",
  KB: "Kelompok Bermain",
  TK: "Taman Kanak-kanak",
  RA: "Raudhatul Athfal",
  TPA: "Taman Penitipan Anak",
  SD: "Sekolah Dasar",
  SDLB: "Sekolah Dasar Luar Biasa",
  SMP: "Sekolah Menengah Pertama",
  SMPLB: "Sekolah Menengah Pertama Luar Biasa",
  SMA: "Sekolah Menengah Atas",
  SMALB: "Sekolah Menengah Atas Luar Biasa",
  SMK: "Sekolah Menengah Kejuruan",
  SLB: "Sekolah Luar Biasa",
  PKBM: "Pusat Kegiatan Belajar Masyarakat",
};

const JENJANG_UNIT: Partial<Record<SchoolLevel, string>> = {
  MI: "Madrasah Ibtidaiyah",
  MTS: "Madrasah Tsanawiyah",
  MA: "Madrasah Aliyah",
  SD: "Sekolah Dasar",
  SMP: "Sekolah Menengah Pertama",
  SMA: "Sekolah Menengah Atas",
  SMK: "Sekolah Menengah Kejuruan",
};

export function schoolLevelLongLabel(jenjang: SchoolLevel | null | undefined): string {
  if (!jenjang) return "Satuan Pendidikan";
  return JENJANG_LONG[jenjang] ?? jenjang;
}

export function schoolUnitTypeLabel(jenjang: SchoolLevel | null | undefined): string {
  if (!jenjang) return "Satuan Pendidikan";
  return JENJANG_UNIT[jenjang] ?? schoolLevelLongLabel(jenjang);
}

const MADRASAH_JENJANG = new Set<SchoolLevel>(["MI", "MTS", "MA"]);

/** Madrasah (Kemenag) vs satuan pendidikan di bawah Kemdikbud. */
export function isMadrasahJenjang(jenjang: SchoolLevel | null | undefined): boolean {
  return jenjang != null && MADRASAH_JENJANG.has(jenjang);
}
