"use server";

import { z } from "zod";

import {
  validateExamAspectCell,
  validateRaporAspectCell,
  type ExamValidationAspect,
  type GradeValidationStatus,
  type RaporValidationAspect,
} from "@/domain/grade-validation";
import { SCORE_TYPE } from "@/domain/scoreTypes";
import { uniqueClassLabelsSorted } from "@/lib/class-name-sort";
import { EXAM_SEMESTER_KEY } from "@/lib/examSemester";
import {
  buildSubjectGroups,
  gradeValidationCellKey,
  type GradeValidationBoard,
  type GradeValidationStudent,
  type GradeValidationSubject,
  type GradeValidationSubjectGroup,
} from "@/lib/grade-validation-board";
import { prisma } from "@/lib/prisma";
import { loadActiveSemesterKeysBySubjectCode } from "@/lib/subject-semester-sync";
import {
  requireGradeValidationViewer,
  studentWhereForGradeValidation,
} from "@/server/grade-validation-access";

import type { RaporAspectMode } from "@prisma/client";

const paramsSchema = z.object({
  kind: z.enum(["ujian", "rapor"]),
  semesterKey: z.string().optional(),
});

const GRADE_QUERY_CHUNK = 250;

function decimalToNum(score: { toNumber(): number }): number {
  return score.toNumber();
}

async function findExamGrades(
  schoolId: string,
  studentIds: string[],
): Promise<
  {
    studentId: string;
    subjectId: string;
    scoreType: string;
    score: { toNumber(): number };
  }[]
> {
  if (studentIds.length === 0) return [];
  const rows: {
    studentId: string;
    subjectId: string;
    scoreType: string;
    score: { toNumber(): number };
  }[] = [];
  for (let i = 0; i < studentIds.length; i += GRADE_QUERY_CHUNK) {
    const chunk = studentIds.slice(i, i + GRADE_QUERY_CHUNK);
    const part = await prisma.gradeEntry.findMany({
      where: {
        schoolId,
        studentId: { in: chunk },
        semesterKey: EXAM_SEMESTER_KEY,
        scoreType: {
          in: [SCORE_TYPE.UJIAN_MADRASAH, SCORE_TYPE.UJIAN_PRAKTEK],
        },
      },
      select: {
        studentId: true,
        subjectId: true,
        scoreType: true,
        score: true,
      },
    });
    rows.push(...part);
  }
  return rows;
}

async function findRaporGrades(
  schoolId: string,
  studentIds: string[],
  semesterKey: string,
  scoreType: typeof SCORE_TYPE.PENGETAHUAN | typeof SCORE_TYPE.KETERAMPILAN,
): Promise<
  { studentId: string; subjectId: string; score: { toNumber(): number } }[]
> {
  if (studentIds.length === 0) return [];
  const rows: {
    studentId: string;
    subjectId: string;
    score: { toNumber(): number };
  }[] = [];
  for (let i = 0; i < studentIds.length; i += GRADE_QUERY_CHUNK) {
    const chunk = studentIds.slice(i, i + GRADE_QUERY_CHUNK);
    const part = await prisma.gradeEntry.findMany({
      where: {
        schoolId,
        studentId: { in: chunk },
        semesterKey,
        scoreType,
      },
      select: { studentId: true, subjectId: true, score: true },
    });
    rows.push(...part);
  }
  return rows;
}

function serializeBoard(board: GradeValidationBoard): GradeValidationBoard {
  return JSON.parse(JSON.stringify(board)) as GradeValidationBoard;
}

function initCellsForGroups(
  students: GradeValidationStudent[],
  subjectGroups: GradeValidationSubjectGroup[],
  kind: "ujian" | "rapor",
  raporDefaults?: {
    semesterKey: string;
    aspectMode: RaporAspectMode;
    activeBySubjectCode: Map<string, Set<string>>;
  },
): Record<string, Record<string, GradeValidationStatus>> {
  const cells: Record<string, Record<string, GradeValidationStatus>> = {};
  for (const st of students) {
    cells[st.nisn] = {};
    for (const group of subjectGroups) {
      const semesterActive =
        raporDefaults?.activeBySubjectCode.get(group.code)?.has(
          raporDefaults.semesterKey,
        ) ?? false;
      for (const col of group.columns) {
        const key = gradeValidationCellKey(group.code, col.aspect);
        if (kind === "ujian") {
          cells[st.nisn][key] = validateExamAspectCell(
            group.jenisUjian,
            col.aspect as ExamValidationAspect,
            undefined,
          );
        } else if (raporDefaults) {
          cells[st.nisn][key] = validateRaporAspectCell(
            {
              semesterActiveForSubject: semesterActive,
              aspectMode: raporDefaults.aspectMode,
            },
            col.aspect as RaporValidationAspect,
            undefined,
          );
        } else {
          cells[st.nisn][key] = "ignored";
        }
      }
    }
  }
  return cells;
}

export async function getGradeValidationBoardAction(
  raw: unknown,
): Promise<
  { ok: true; board: GradeValidationBoard } | { ok: false; message: string }
> {
  try {
    const parsed = paramsSchema.safeParse(raw);
    if (!parsed.success) {
      return { ok: false, message: "Parameter tidak valid." };
    }

    const viewer = await requireGradeValidationViewer();
    const { schoolId } = viewer;
    const kind = parsed.data.kind;
    const requestedSemesterKey = parsed.data.semesterKey?.trim() ?? "";

    const activeYear = await prisma.academicYear.findFirst({
      where: { schoolId, isActive: true },
    });
    if (!activeYear) {
      return {
        ok: true,
        board: serializeBoard(emptyBoard(kind, [], [], 5, "BOTH", [], null, [])),
      };
    }

    const [school, grading, semestersDb, studentWhere] = await Promise.all([
      prisma.school.findUnique({
        where: { id: schoolId },
        select: { raporSemesterCount: true },
      }),
      prisma.schoolGradingConfig.findUnique({ where: { schoolId } }),
      prisma.semester.findMany({
        where: { academicYearId: activeYear.id },
        orderBy: { orderNo: "asc" },
      }),
      studentWhereForGradeValidation(schoolId, viewer.homeroomClassRoomIds),
    ]);

    const defaultSemesterCount = school?.raporSemesterCount ?? 5;
    const raporAspectMode = grading?.raporAspectMode ?? "BOTH";

    const semesterOptions = semestersDb.map((s) => ({
      key: s.internalKey,
      label: `${s.label} (${activeYear.label})`,
    }));

    const [studentsRaw, subjectsRaw] = await Promise.all([
      prisma.student.findMany({
        where: studentWhere,
        orderBy: [{ className: "asc" }, { name: "asc" }],
        select: {
          id: true,
          nisn: true,
          name: true,
          className: true,
          classRoom: { select: { name: true } },
        },
      }),
      prisma.subject.findMany({
        where: { schoolId },
        orderBy: [{ orderNo: "asc" }, { code: "asc" }],
        select: {
          id: true,
          code: true,
          name: true,
          jenisUjian: true,
          semesterCount: true,
        },
      }),
    ]);

    const students: GradeValidationStudent[] = studentsRaw.map((s) => ({
      nisn: String(s.nisn),
      name: s.name,
      classLabel: s.className ?? s.classRoom?.name ?? null,
    }));

    const classOptions = uniqueClassLabelsSorted(students);

    const subjects: GradeValidationSubject[] = subjectsRaw.map((su) => ({
      code: su.code,
      name: su.name,
      jenisUjian: su.jenisUjian,
      semesterCount: su.semesterCount,
    }));

    if (studentsRaw.length === 0 || subjectsRaw.length === 0) {
      return {
        ok: true,
        board: serializeBoard(
          emptyBoard(
            kind,
            students,
            subjects,
            defaultSemesterCount,
            raporAspectMode,
            semesterOptions,
            undefined,
            classOptions,
          ),
        ),
      };
    }

    const studentIds = studentsRaw.map((s) => s.id);
    const sidToNisn = new Map(studentsRaw.map((s) => [s.id, String(s.nisn)]));
    const subjectGroups = buildSubjectGroups(kind, subjects);

    if (kind === "ujian") {
      const cells = initCellsForGroups(students, subjectGroups, "ujian");
      const grades = await findExamGrades(schoolId, studentIds);
      const subIdToCode = new Map(subjectsRaw.map((su) => [su.id, su.code]));
      const examScores = new Map<string, { m?: number; p?: number }>();

      for (const g of grades) {
        const nisn = sidToNisn.get(g.studentId);
        const code = subIdToCode.get(g.subjectId);
        if (!nisn || !code) continue;
        const key = `${nisn}|${code}`;
        const row = examScores.get(key) ?? {};
        const v = decimalToNum(g.score);
        if (g.scoreType === SCORE_TYPE.UJIAN_MADRASAH) row.m = v;
        else row.p = v;
        examScores.set(key, row);
      }

      for (const st of students) {
        for (const group of subjectGroups) {
          const scores = examScores.get(`${st.nisn}|${group.code}`);
          for (const col of group.columns) {
            const cellKey = gradeValidationCellKey(group.code, col.aspect);
            const score =
              col.aspect === "tertulis" ? scores?.m : scores?.p;
            cells[st.nisn][cellKey] = validateExamAspectCell(
              group.jenisUjian,
              col.aspect as ExamValidationAspect,
              score,
            );
          }
        }
      }

      return {
        ok: true,
        board: serializeBoard({
          kind: "ujian",
          classOptions,
          students,
          subjects,
          subjectGroups,
          cells,
          semesterKey: null,
          semesterOptions,
          defaultSemesterCount,
          raporAspectMode,
        }),
      };
    }

    const semesterKey =
      requestedSemesterKey ||
      semesterOptions[0]?.key ||
      semestersDb[0]?.internalKey ||
      "";

    if (!semesterKey || !semestersDb.some((s) => s.internalKey === semesterKey)) {
      return {
        ok: true,
        board: serializeBoard(
          emptyBoard(
            "rapor",
            students,
            subjects,
            defaultSemesterCount,
            raporAspectMode,
            semesterOptions,
            semesterKey || null,
            classOptions,
          ),
        ),
      };
    }

    const [gradesP, gradesK, activeBySubjectCode] = await Promise.all([
      findRaporGrades(schoolId, studentIds, semesterKey, SCORE_TYPE.PENGETAHUAN),
      findRaporGrades(schoolId, studentIds, semesterKey, SCORE_TYPE.KETERAMPILAN),
      loadActiveSemesterKeysBySubjectCode(schoolId),
    ]);

    const subIdToCode = new Map(subjectsRaw.map((su) => [su.id, su.code]));
    const pMap = new Map<string, number>();
    const kMap = new Map<string, number>();

    for (const g of gradesP) {
      const nisn = sidToNisn.get(g.studentId);
      const code = subIdToCode.get(g.subjectId);
      if (!nisn || !code) continue;
      pMap.set(`${nisn}|${code}`, decimalToNum(g.score));
    }
    for (const g of gradesK) {
      const nisn = sidToNisn.get(g.studentId);
      const code = subIdToCode.get(g.subjectId);
      if (!nisn || !code) continue;
      kMap.set(`${nisn}|${code}`, decimalToNum(g.score));
    }

    const raporCtx = {
      semesterKey,
      aspectMode: raporAspectMode,
      activeBySubjectCode,
    };
    const cells = initCellsForGroups(students, subjectGroups, "rapor", raporCtx);

    for (const st of students) {
      for (const group of subjectGroups) {
        const semesterActive =
          activeBySubjectCode.get(group.code)?.has(semesterKey) ?? false;
        const raporOpts = {
          semesterActiveForSubject: semesterActive,
          aspectMode: raporAspectMode,
        };
        const pScore = pMap.get(`${st.nisn}|${group.code}`);
        const kScore = kMap.get(`${st.nisn}|${group.code}`);
        for (const col of group.columns) {
          const cellKey = gradeValidationCellKey(group.code, col.aspect);
          const score = col.aspect === "pengetahuan" ? pScore : kScore;
          const peer = col.aspect === "pengetahuan" ? kScore : pScore;
          cells[st.nisn][cellKey] = validateRaporAspectCell(
            { ...raporOpts, peerScore: peer },
            col.aspect as RaporValidationAspect,
            score,
          );
        }
      }
    }

    return {
      ok: true,
      board: serializeBoard({
        kind: "rapor",
        classOptions,
        students,
        subjects,
        subjectGroups,
        cells,
        semesterKey,
        semesterOptions,
        defaultSemesterCount,
        raporAspectMode,
      }),
    };
  } catch (e) {
    console.error("[getGradeValidationBoardAction]", e);
    return {
      ok: false,
      message:
        e instanceof Error
          ? e.message
          : "Gagal memuat validasi nilai. Coba muat ulang.",
    };
  }
}

function emptyBoard(
  kind: "ujian" | "rapor",
  students: GradeValidationStudent[],
  subjects: GradeValidationSubject[],
  defaultSemesterCount: number,
  raporAspectMode: RaporAspectMode,
  semesterOptions: { key: string; label: string }[] = [],
  semesterKey: string | null = null,
  classOptions: string[] = [],
): GradeValidationBoard {
  const subjectGroups = buildSubjectGroups(kind, subjects);
  const cells = initCellsForGroups(
    students,
    subjectGroups,
    kind,
    kind === "rapor" && semesterKey
      ? {
          semesterKey,
          aspectMode: raporAspectMode,
          activeBySubjectCode: new Map(),
        }
      : undefined,
  );
  return {
    kind,
    classOptions,
    students,
    subjects,
    subjectGroups,
    cells,
    semesterKey,
    semesterOptions,
    defaultSemesterCount,
    raporAspectMode,
  };
}
