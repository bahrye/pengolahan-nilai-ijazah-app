import { SCORE_TYPE } from "@/domain/scoreTypes";
import { isUjianTertulisJenis } from "@/lib/school-terminology";

/** Rata ujian tertulis + praktik (sama logika ringkas seperti rekap). */
export function examAverageFromParts(
  um: number | null | undefined,
  up: number | null | undefined,
): number | null {
  const a = um != null && Number.isFinite(um) ? um : null;
  const b = up != null && Number.isFinite(up) ? up : null;
  if (a != null && b != null) return Math.round(((a + b) / 2 + Number.EPSILON) * 100) / 100;
  if (a != null) return Math.round((a + Number.EPSILON) * 100) / 100;
  if (b != null) return Math.round((b + Number.EPSILON) * 100) / 100;
  return null;
}

/** Bulatkan nilai ujian untuk cetak/pratinjau (contoh: 93,64 → 94; 95,5 → 96). */
export function roundExamNilaiForPrint(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.round(value);
}

/** Teks kolom Nilai pada cetak ujian — selalu bilangan bulat. */
export function formatExamNilaiPrint(value: number): string {
  return roundExamNilaiForPrint(value).toLocaleString("id-ID", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
}

export function examScoreTypesForSubjectJenis(jenisUjian: string): string[] {
  if (jenisUjian === "Ujian Praktek") return [SCORE_TYPE.UJIAN_PRAKTEK];
  if (jenisUjian === "Keduanya") return [SCORE_TYPE.UJIAN_MADRASAH, SCORE_TYPE.UJIAN_PRAKTEK];
  if (isUjianTertulisJenis(jenisUjian)) return [SCORE_TYPE.UJIAN_MADRASAH];
  return [SCORE_TYPE.UJIAN_MADRASAH];
}
