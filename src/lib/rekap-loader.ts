import type { GradeEntry, School, Student, Subject } from "@prisma/client";
import type { RaporAspectMode } from "@prisma/client";

import type { RekapitulasiInput, ScoreMatrix } from "@/domain/rekapitulasi";
import { SCORE_TYPE } from "@/domain/scoreTypes";
import { EXAM_SEMESTER_KEY } from "@/lib/examSemester";

type SchoolPack = School & {
  students: Student[];
  subjects: Subject[];
};

/**
 * Merakit input rekap dari baris Prisma.
 * `semesterKeys` harus urutan yang dipakai untuk pembagi rata-rata rapor.
 */
export function assembleRekapInput(params: {
  school: SchoolPack;
  grading: {
    bobotUjian: number;
    bobotRapor: number;
    kkm: number;
    raporAspectMode: RaporAspectMode;
  };
  grades: GradeEntry[];
  semesterKeys: readonly string[];
}): RekapitulasiInput {
  const { school, grading, grades, semesterKeys } = params;

  const studentsPack = [...school.students].sort((a, b) =>
    (a.name || "").localeCompare(b.name || "", "id"),
  );

  const students = studentsPack.map((s) => ({
    nisn: String(s.nisn),
    name: s.name,
    className: s.className,
  }));

  const mapel = school.subjects.map((x) => ({
    kode: x.code,
    nama: x.name,
    semesterCount: x.semesterCount,
  }));

  const semestersForJenjang = [...semesterKeys];

  const sidToNisn = new Map(studentsPack.map((s) => [s.id, String(s.nisn)]));

  const nilaiUjianMadrasah = emptyMatrix(studentsPack, school.subjects);
  const nilaiUjianPraktek = emptyMatrix(studentsPack, school.subjects);
  const raporP: Record<string, ScoreMatrix> = {};
  const raporK: Record<string, ScoreMatrix> = {};

  for (const sm of semestersForJenjang) {
    raporP[sm] = emptyMatrix(studentsPack, school.subjects);
    raporK[sm] = emptyMatrix(studentsPack, school.subjects);
  }

  const subjById = new Map(school.subjects.map((su) => [su.id, su.code]));

  for (const g of grades) {
    const nisn = sidToNisn.get(g.studentId);
    const kode = subjById.get(g.subjectId);
    if (!nisn || !kode) continue;
    const v = decimalToNum(g.score);

    if (
      g.semesterKey === EXAM_SEMESTER_KEY &&
      g.scoreType === SCORE_TYPE.UJIAN_MADRASAH
    ) {
      nilaiUjianMadrasah[nisn][kode] = v;
      continue;
    }
    if (
      g.semesterKey === EXAM_SEMESTER_KEY &&
      g.scoreType === SCORE_TYPE.UJIAN_PRAKTEK
    ) {
      nilaiUjianPraktek[nisn][kode] = v;
      continue;
    }
    if (g.scoreType === SCORE_TYPE.PENGETAHUAN && raporP[g.semesterKey]?.[nisn]) {
      raporP[g.semesterKey][nisn][kode] = v;
      continue;
    }
    if (
      g.scoreType === SCORE_TYPE.KETERAMPILAN &&
      raporK[g.semesterKey]?.[nisn]
    ) {
      raporK[g.semesterKey][nisn][kode] = v;
    }
  }

  return {
    students,
    mapel,
    bobotUjian: grading.bobotUjian,
    bobotRapor: grading.bobotRapor,
    kkm: grading.kkm,
    defaultSemesterCount: school.raporSemesterCount,
    raporAspectMode: grading.raporAspectMode,
    semestersForJenjang,
    nilaiUjianMadrasah,
    nilaiUjianPraktek,
    raporPengetahuanBySemester: raporP,
    raporKeterampilanBySemester: raporK,
  };
}

function emptyMatrix(students: Student[], subjects: Subject[]): ScoreMatrix {
  const m: ScoreMatrix = {};
  for (const s of students) {
    const nisn = String(s.nisn);
    m[nisn] = {};
    for (const sub of subjects) {
      m[nisn][sub.code] = undefined;
    }
  }
  return m;
}

function decimalToNum(score: { toString(): string }) {
  const n = parseFloat(score.toString());
  return Number.isFinite(n) ? n : NaN;
}
