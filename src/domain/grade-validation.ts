import type { RaporAspectMode } from "@prisma/client";

import { SCORE_TYPE } from "@/domain/scoreTypes";
import { isUjianTertulisJenis } from "@/lib/school-terminology";

export type GradeValidationStatus = "filled" | "empty" | "ignored";

export type ExamValidationAspect = "tertulis" | "praktek";
export type RaporValidationAspect = "pengetahuan" | "keterampilan";

/** Jenis nilai ujian yang relevan per mapel (selaras input ujian & status kirim). */
export function examScoreTypesForSubject(
  jenisUjian: string,
): (typeof SCORE_TYPE)[keyof typeof SCORE_TYPE][] {
  if (jenisUjian === "Ujian Praktek") return [SCORE_TYPE.UJIAN_PRAKTEK];
  if (jenisUjian === "Keduanya") {
    return [SCORE_TYPE.UJIAN_MADRASAH, SCORE_TYPE.UJIAN_PRAKTEK];
  }
  if (isUjianTertulisJenis(jenisUjian)) {
    return [SCORE_TYPE.UJIAN_MADRASAH];
  }
  return [SCORE_TYPE.UJIAN_MADRASAH];
}

export function effectiveSubjectSemesterCount(
  subjectSemesterCount: number,
  schoolDefault: number,
): number {
  return subjectSemesterCount > 0 ? subjectSemesterCount : schoolDefault;
}

/** Semester di luar jumlah semester aktif mapel diabaikan saat rekap rapor. */
export function isRaporSemesterIgnoredForSubject(
  semesterIndex: number,
  subjectSemesterCount: number,
  schoolDefault: number,
): boolean {
  const effective = effectiveSubjectSemesterCount(
    subjectSemesterCount,
    schoolDefault,
  );
  return semesterIndex >= effective;
}

function hasScore(v: number | null | undefined): boolean {
  return v !== null && v !== undefined && Number.isFinite(v);
}

export function gradeValidationCellKey(
  subjectCode: string,
  aspect: ExamValidationAspect | RaporValidationAspect,
): string {
  return `${subjectCode}|${aspect}`;
}

export function validateExamAspectCell(
  jenisUjian: string,
  aspect: ExamValidationAspect,
  score: number | null | undefined,
): GradeValidationStatus {
  const types = examScoreTypesForSubject(jenisUjian);
  const required =
    (aspect === "tertulis" && types.includes(SCORE_TYPE.UJIAN_MADRASAH)) ||
    (aspect === "praktek" && types.includes(SCORE_TYPE.UJIAN_PRAKTEK));
  if (!required) return "ignored";
  return hasScore(score) ? "filled" : "empty";
}

export function validateRaporAspectCell(
  opts: {
    /** Semester punya minimal satu nilai rapor mapel ini (seluruh siswa). */
    semesterActiveForSubject: boolean;
    aspectMode: RaporAspectMode;
    /** Nilai aspek rapor lain (P/K) pada sel siswa–mapel–semester yang sama. */
    peerScore?: number | null | undefined;
  },
  aspect: RaporValidationAspect,
  score: number | null | undefined,
): GradeValidationStatus {
  if (!opts.semesterActiveForSubject) {
    return "ignored";
  }
  const { aspectMode, peerScore } = opts;
  if (aspectMode === "PENGETAHUAN_ONLY" && aspect === "keterampilan") {
    return "ignored";
  }
  if (aspectMode === "KETERAMPILAN_ONLY" && aspect === "pengetahuan") {
    return "ignored";
  }
  if (hasScore(score)) return "filled";
  if (aspectMode === "BOTH" && hasScore(peerScore)) {
    return "ignored";
  }
  return "empty";
}

/** @deprecated Gunakan validateExamAspectCell per aspek. */
export function validateExamCell(
  jenisUjian: string,
  madrasah: number | null | undefined,
  praktek: number | null | undefined,
): GradeValidationStatus {
  const t = validateExamAspectCell(jenisUjian, "tertulis", madrasah);
  const p = validateExamAspectCell(jenisUjian, "praktek", praktek);
  if (t === "empty" || p === "empty") return "empty";
  if (t === "filled" || p === "filled") return "filled";
  return "ignored";
}

/** @deprecated Gunakan validateRaporAspectCell per aspek. */
export function validateRaporCell(opts: {
  semesterActiveForSubject: boolean;
  aspectMode: RaporAspectMode;
  pengetahuan: number | null | undefined;
  keterampilan: number | null | undefined;
}): GradeValidationStatus {
  const p = validateRaporAspectCell(opts, "pengetahuan", opts.pengetahuan);
  const k = validateRaporAspectCell(opts, "keterampilan", opts.keterampilan);
  if (p === "ignored" && k === "ignored") return "ignored";
  if (p === "empty" || k === "empty") return "empty";
  return "filled";
}
