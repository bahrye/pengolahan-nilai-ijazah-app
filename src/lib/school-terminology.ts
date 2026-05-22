import type { SchoolLevel } from "@prisma/client";

/** MI, MTS, MA — pakai istilah madrasah & jenis ujian tertulis «Ujian Madrasah». */
export function isKemenagJenjang(
  jenjang: SchoolLevel | null | undefined,
): boolean {
  return jenjang === "MI" || jenjang === "MTS" || jenjang === "MA";
}

export function institutionNoun(
  jenjang: SchoolLevel | null | undefined,
  capitalize = false,
): string {
  const w = isKemenagJenjang(jenjang) ? "madrasah" : "sekolah";
  return capitalize ? w.charAt(0).toUpperCase() + w.slice(1) : w;
}

export function kepalaSekolahLabel(
  jenjang: SchoolLevel | null | undefined,
): "Kepala Madrasah" | "Kepala Sekolah" {
  return isKemenagJenjang(jenjang) ? "Kepala Madrasah" : "Kepala Sekolah";
}

/** Nilai tersimpan di `Subject.jenisUjian` untuk aspek tertulis. */
export const JENIS_UJIAN_MADRASAH = "Ujian Madrasah" as const;
export const JENIS_UJIAN_SEKOLAH = "Ujian Sekolah" as const;
export const JENIS_UJIAN_PRAKTEK = "Ujian Praktek" as const;
export const JENIS_UJIAN_KEDUANYA = "Keduanya" as const;

export type JenisUjianTertulisValue =
  | typeof JENIS_UJIAN_MADRASAH
  | typeof JENIS_UJIAN_SEKOLAH;

export function ujianTertulisJenisValue(
  jenjang: SchoolLevel | null | undefined,
): JenisUjianTertulisValue {
  return isKemenagJenjang(jenjang)
    ? JENIS_UJIAN_MADRASAH
    : JENIS_UJIAN_SEKOLAH;
}

export function isUjianTertulisJenis(jenis: string): boolean {
  return jenis === JENIS_UJIAN_MADRASAH || jenis === JENIS_UJIAN_SEKOLAH;
}

export function jenisUjianOptions(
  jenjang: SchoolLevel | null | undefined,
): readonly string[] {
  return [
    ujianTertulisJenisValue(jenjang),
    JENIS_UJIAN_PRAKTEK,
    JENIS_UJIAN_KEDUANYA,
  ];
}

/** Tampilan label jenis ujian (mis. data lama «Ujian Madrasah» di sekolah dinas). */
export function formatJenisUjianLabel(
  jenis: string,
  jenjang: SchoolLevel | null | undefined,
): string {
  if (isUjianTertulisJenis(jenis)) return ujianTertulisJenisValue(jenjang);
  return jenis;
}

export function normalizeJenisUjianForSchool(
  raw: string | undefined,
  jenjang: SchoolLevel | null | undefined,
): string {
  if (!raw?.trim()) return ujianTertulisJenisValue(jenjang);
  const t = raw.trim();
  if (isUjianTertulisJenis(t)) return ujianTertulisJenisValue(jenjang);
  if (t.toLowerCase() === JENIS_UJIAN_PRAKTEK.toLowerCase()) {
    return JENIS_UJIAN_PRAKTEK;
  }
  if (t.toLowerCase() === JENIS_UJIAN_KEDUANYA.toLowerCase()) {
    return JENIS_UJIAN_KEDUANYA;
  }
  return ujianTertulisJenisValue(jenjang);
}

/** Judul dokumen cetak: «Nilai Ujian Sekolah Tahun …». */
export function nilaiUjianDocHeading(
  jenjang: SchoolLevel | null | undefined,
  tahunAjaranLabel: string,
): string {
  return `Nilai ${ujianTertulisJenisValue(jenjang)} Tahun ${tahunAjaranLabel}`;
}

export function nilaiUjianDocHeadingUpper(
  jenjang: SchoolLevel | null | undefined,
  tahunAjaranLabel: string,
): string {
  return nilaiUjianDocHeading(jenjang, tahunAjaranLabel).toUpperCase();
}

export function ujianTertulisAspectHint(
  jenjang: SchoolLevel | null | undefined,
): string {
  const label = isKemenagJenjang(jenjang) ? "ujian madrasah" : "ujian sekolah";
  return `Kolom aspek: T = tertulis (${label}), P = praktik.`;
}

/** Ganti «madrasah» → «sekolah» di teks UI untuk sekolah dinas/PAUD/dll. */
export function localizeInstitutionInText(
  text: string,
  jenjang: SchoolLevel | null | undefined,
): string {
  if (isKemenagJenjang(jenjang)) return text;
  return text.replace(/\bmadrasah\b/gi, (match) => {
    if (match === "Madrasah") return "Sekolah";
    if (match === "MADRASAH") return "SEKOLAH";
    return "sekolah";
  });
}
