import type { RaporAspectMode } from "@prisma/client";

import {
  examScoreTypesForSubject,
  gradeValidationCellKey,
  type ExamValidationAspect,
  type GradeValidationStatus,
  type RaporValidationAspect,
} from "@/domain/grade-validation";
import { SCORE_TYPE } from "@/domain/scoreTypes";

export type { GradeValidationStatus };

export type GradeValidationStudent = {
  nisn: string;
  name: string;
  classLabel: string | null;
};

export type GradeValidationSubject = {
  code: string;
  name: string;
  jenisUjian: string;
  semesterCount: number;
};

export type GradeValidationAspectColumn = {
  aspect: ExamValidationAspect | RaporValidationAspect;
  /** Label singkat sub-kolom (T, P, P, K). */
  shortLabel: string;
  /** Nama lengkap untuk tooltip. */
  fullLabel: string;
};

export type GradeValidationSubjectGroup = GradeValidationSubject & {
  columns: GradeValidationAspectColumn[];
};

export type GradeValidationBoard = {
  kind: "ujian" | "rapor";
  /** Kelas yang punya siswa (urut untuk filter tampilan; kelas tanpa siswa tidak disertakan). */
  classOptions: string[];
  students: GradeValidationStudent[];
  subjects: GradeValidationSubject[];
  /** Kolom per mapel + aspek; diisi server, klien bisa bangun ulang dari `subjects` jika kosong. */
  subjectGroups?: GradeValidationSubjectGroup[];
  cells: Record<string, Record<string, GradeValidationStatus>>;
  semesterKey: string | null;
  semesterOptions: { key: string; label: string }[];
  defaultSemesterCount: number;
  raporAspectMode: RaporAspectMode;
};

export function buildSubjectGroups(
  kind: "ujian" | "rapor",
  subjects: GradeValidationSubject[],
): GradeValidationSubjectGroup[] {
  return subjects.map((su) => {
    if (kind === "ujian") {
      const types = examScoreTypesForSubject(su.jenisUjian);
      const columns: GradeValidationAspectColumn[] = [];
      if (types.includes(SCORE_TYPE.UJIAN_MADRASAH)) {
        columns.push({
          aspect: "tertulis",
          shortLabel: "T",
          fullLabel: "Tertulis",
        });
      }
      if (types.includes(SCORE_TYPE.UJIAN_PRAKTEK)) {
        columns.push({
          aspect: "praktek",
          shortLabel: "P",
          fullLabel: "Praktik",
        });
      }
      return { ...su, columns };
    }
    return {
      ...su,
      columns: [
        {
          aspect: "pengetahuan",
          shortLabel: "P",
          fullLabel: "Pengetahuan",
        },
        {
          aspect: "keterampilan",
          shortLabel: "K",
          fullLabel: "Keterampilan",
        },
      ],
    };
  });
}

export { gradeValidationCellKey };
