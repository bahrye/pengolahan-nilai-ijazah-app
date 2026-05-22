"use server";

import { Prisma } from "@prisma/client";

import { SCORE_TYPE } from "@/domain/scoreTypes";
import { EXAM_SEMESTER_KEY } from "@/lib/examSemester";
import { resolveTeacherExamInputGate } from "@/lib/exam-input-gate";
import { isUjianTertulisJenis } from "@/lib/school-terminology";
import { allowedGradeTargetsForRole } from "@/server/guru-scope";
import {
  classRoomIdsForActiveAcademicYear,
  studentWhereParticipatingActiveYear,
} from "@/server/active-academic-year-scope";
import { requireGradeMutator, requireUserSchoolId } from "@/server/session";
import { withTenantDb, type TenantDb } from "@/server/tenant-db-context";

import type { UserRole } from "@prisma/client";

export type ScoreGrid = Record<string, Record<string, number | null>>;

type GradeMutatorCtx = {
  userId: string;
  schoolId: string;
  role: UserRole;
};

async function withGradeMutatorDb<T>(
  fn: (db: TenantDb, ctx: GradeMutatorCtx) => Promise<T>,
): Promise<T> {
  const ctx = await requireGradeMutator();
  return withTenantDb(ctx.schoolId, (db) => fn(db, ctx));
}

function subjectFilterForExam(
  jenisUjian: string,
  kind: "madrasah" | "praktek",
): boolean {
  if (kind === "madrasah") {
    return (
      isUjianTertulisJenis(jenisUjian) ||
      jenisUjian === "Keduanya" ||
      jenisUjian === ""
    );
  }
  return jenisUjian === "Ujian Praktek" || jenisUjian === "Keduanya";
}

function canMutateCell(opts: {
  allowed: Set<string> | null;
  studentMeta: Map<string, { classRoomId: string | null }>;
  studentId: string;
  subjectId: string;
}): boolean {
  const { allowed, studentMeta, studentId, subjectId } = opts;
  if (allowed === null) return true;
  const cr = studentMeta.get(studentId)?.classRoomId;
  if (!cr) return false;
  return allowed.has(`${subjectId}|${cr}`);
}

export async function getExamScoreMatrixAction(
  kind: "madrasah" | "praktek",
): Promise<ScoreGrid> {
  return withGradeMutatorDb(async (db, ctx) => {
  const { schoolId, role, userId } = ctx;

  const studentWhere = await studentWhereParticipatingActiveYear(schoolId, db);
  const [students, subjects, grades] = await Promise.all([
    db.student.findMany({
      where: studentWhere,
      select: {
        id: true,
        nisn: true,
        classRoomId: true,
      },
      orderBy: { name: "asc" },
    }),
    db.subject.findMany({
      where: { schoolId },
      select: {
        id: true,
        code: true,
        jenisUjian: true,
      },
      orderBy: { orderNo: "asc" },
    }),
    db.gradeEntry.findMany({
      where: {
        schoolId,
        semesterKey: EXAM_SEMESTER_KEY,
        scoreType:
          kind === "madrasah"
            ? SCORE_TYPE.UJIAN_MADRASAH
            : SCORE_TYPE.UJIAN_PRAKTEK,
      },
      select: {
        studentId: true,
        subjectId: true,
        score: true,
      },
    }),
  ]);

  const subFiltered = subjects.filter((s) =>
    subjectFilterForExam(s.jenisUjian, kind),
  );
  const subSet = new Set(subFiltered.map((s) => s.id));
  const allowed = await allowedGradeTargetsForRole({
    schoolId,
    userId,
    role,
    context: "ujian",
    db,
  });
  const studentMeta = new Map(
    students.map((s) => [s.id, { classRoomId: s.classRoomId }]),
  );

  const grid: ScoreGrid = {};
  for (const st of students) {
    const cr = st.classRoomId;
    if (allowed && (!cr || !subFiltered.some((su) => allowed.has(`${su.id}|${cr}`)))) continue;
    grid[String(st.nisn)] = {};
    for (const su of subFiltered) {
      if (
        allowed &&
        st.classRoomId &&
        !allowed.has(`${su.id}|${st.classRoomId}`)
      )
        continue;
      grid[String(st.nisn)][su.code] = null;
    }
  }

  const subIdToCode = new Map(subjects.map((s) => [s.id, s.code]));
  const nisnById = new Map(students.map((s) => [s.id, String(s.nisn)]));
  for (const g of grades) {
    if (!subSet.has(g.subjectId)) continue;
    const nisn = nisnById.get(g.studentId);
    if (!nisn || !grid[nisn]) continue;
    if (
      !canMutateCell({
        allowed,
        studentMeta,
        studentId: g.studentId,
        subjectId: g.subjectId,
      })
    )
      continue;
    const code = subIdToCode.get(g.subjectId);
    if (!code || !(code in grid[nisn])) continue;
    grid[nisn][code] = g.score.toNumber();
  }

  return grid;
  });
}

export async function getRaporScoreMatrixAction(
  semesterKey: string,
  jenis: "pengetahuan" | "keterampilan",
): Promise<ScoreGrid> {
  return withGradeMutatorDb(async (db, ctx) => {
  const { schoolId, role, userId } = ctx;
  const scoreType =
    jenis === "pengetahuan"
      ? SCORE_TYPE.PENGETAHUAN
      : SCORE_TYPE.KETERAMPILAN;

  const studentWhere = await studentWhereParticipatingActiveYear(schoolId, db);
  const [students, subjects, grades] = await Promise.all([
    db.student.findMany({
      where: studentWhere,
      select: {
        id: true,
        nisn: true,
        classRoomId: true,
      },
      orderBy: { name: "asc" },
    }),
    db.subject.findMany({
      where: { schoolId },
      select: {
        id: true,
        code: true,
      },
      orderBy: { orderNo: "asc" },
    }),
    db.gradeEntry.findMany({
      where: { schoolId, semesterKey, scoreType },
      select: {
        studentId: true,
        subjectId: true,
        score: true,
      },
    }),
  ]);

  const allowed = await allowedGradeTargetsForRole({
    schoolId,
    userId,
    role,
    context: "rapor",
    db,
  });
  const studentMeta = new Map(
    students.map((s) => [s.id, { classRoomId: s.classRoomId }]),
  );

  const grid: ScoreGrid = {};
  for (const st of students) {
    const anySub =
      !allowed ||
      subjects.some(
        (su) =>
          st.classRoomId && allowed.has(`${su.id}|${st.classRoomId}`),
      );
    if (allowed && !anySub) continue;
    grid[String(st.nisn)] = {};
    for (const su of subjects) {
      if (
        allowed &&
        st.classRoomId &&
        !allowed.has(`${su.id}|${st.classRoomId}`)
      )
        continue;
      grid[String(st.nisn)][su.code] = null;
    }
  }

  const subIdToCode = new Map(subjects.map((s) => [s.id, s.code]));
  const nisnById = new Map(students.map((s) => [s.id, String(s.nisn)]));
  for (const g of grades) {
    const nisn = nisnById.get(g.studentId);
    if (!nisn || !grid[nisn]) continue;
    if (
      !canMutateCell({
        allowed,
        studentMeta,
        studentId: g.studentId,
        subjectId: g.subjectId,
      })
    )
      continue;
    const code = subIdToCode.get(g.subjectId);
    if (!code || !(code in grid[nisn])) continue;
    grid[nisn][code] = g.score.toNumber();
  }

  return grid;
  });
}

async function persistMatrix(
  db: TenantDb,
  opts: {
  schoolId: string;
  semesterKey: string;
  scoreType: string;
  matrix: ScoreGrid;
  allowedSubjectIds: Set<string>;
  studentIdsByNisn: Map<string, string>;
  subjectIdsByCode: Map<string, string>;
  studentMeta: Map<string, { classRoomId: string | null }>;
  allowedAssignments: Set<string> | null;
  },
) {
  const {
    schoolId,
    semesterKey,
    scoreType,
    matrix,
    allowedSubjectIds,
    studentIdsByNisn,
    subjectIdsByCode,
    studentMeta,
    allowedAssignments,
  } = opts;

  const ops = [];
  for (const [nisn, row] of Object.entries(matrix)) {
    const studentId = studentIdsByNisn.get(nisn);
    if (!studentId) continue;
    for (const [code, val] of Object.entries(row ?? {})) {
      const subjectId = subjectIdsByCode.get(code);
      if (!subjectId || !allowedSubjectIds.has(subjectId)) continue;

      if (
        !canMutateCell({
          allowed: allowedAssignments,
          studentMeta,
          studentId,
          subjectId,
        })
      )
        continue;

      const num =
        val === null || val === undefined ? null : Number(val);
      if (num === null || Number.isNaN(num)) {
        ops.push(
          db.gradeEntry.deleteMany({
            where: {
              schoolId,
              studentId,
              subjectId,
              semesterKey,
              scoreType,
            },
          }),
        );
        continue;
      }
      if (!Number.isFinite(num) || num < 0 || num > 100) {
        throw new Error(
          `Nilai tidak valid untuk NISN ${nisn}, mapel ${code} (gunakan 0–100).`,
        );
      }

      ops.push(
        db.gradeEntry.upsert({
          where: {
            schoolId_studentId_subjectId_semesterKey_scoreType: {
              schoolId,
              studentId,
              subjectId,
              semesterKey,
              scoreType,
            },
          },
          create: {
            schoolId,
            studentId,
            subjectId,
            semesterKey,
            scoreType,
            score: new Prisma.Decimal(num.toFixed(2)),
          },
          update: {
            score: new Prisma.Decimal(num.toFixed(2)),
          },
        }),
      );
    }
  }

  if (ops.length === 0) return;

  const BATCH_SIZE = 500;
  for (let i = 0; i < ops.length; i += BATCH_SIZE) {
    const batch = ops.slice(i, i + BATCH_SIZE);
    await Promise.all(batch);
  }
}

async function gradingWriteContext(
  db: TenantDb,
  ctx: GradeMutatorCtx,
  kind: "madrasah" | "praktek",
) {
  const { schoolId, role, userId } = ctx;
  const studentWhere = await studentWhereParticipatingActiveYear(schoolId, db);
  const students = await db.student.findMany({ where: studentWhere });
  const subjects = await db.subject.findMany({ where: { schoolId } });
  const studentIdsByNisn = new Map(
    students.map((s) => [String(s.nisn), s.id]),
  );
  const studentMeta = new Map(
    students.map((s) => [s.id, { classRoomId: s.classRoomId }]),
  );
  const subjectIdsByCode = new Map(subjects.map((s) => [s.code, s.id]));
  const allowedSubjects = subjects
    .filter((s) => subjectFilterForExam(s.jenisUjian, kind))
    .map((s) => s.id);
  const allowedSet = new Set(allowedSubjects);
  const assignments = await allowedGradeTargetsForRole({
    schoolId,
    userId,
    role,
    context: "ujian",
    db,
  });
  return {
    schoolId,
    students,
    subjects,
    studentIdsByNisn,
    studentMeta,
    subjectIdsByCode,
    allowedSet,
    assignments,
  };
}

async function assertGuruExamInputEditable(
  db: TenantDb,
  ctx: GradeMutatorCtx,
): Promise<void> {
  if (ctx.role !== "GURU") return;
  const school = await db.school.findUnique({
    where: { id: ctx.schoolId },
    select: {
      examInputPolicy: true,
      examInputWindowStart: true,
      examInputWindowEnd: true,
    },
  });
  if (!school) throw new Error("Data sekolah tidak ditemukan.");
  const gate = resolveTeacherExamInputGate({
    policy: school.examInputPolicy,
    windowStart: school.examInputWindowStart,
    windowEnd: school.examInputWindowEnd,
    now: new Date(),
    restrictAsTeacher: true,
  });
  if (gate.locked) {
    throw new Error(
      "Input dan kirim nilai ujian sedang tidak dibuka. Periksa pemberitahuan di halaman nilai ujian atau hubungi Administrator Sekolah.",
    );
  }
}

export async function saveExamScoresAction(
  kind: "madrasah" | "praktek",
  matrix: ScoreGrid,
): Promise<{ ok: true } | { ok: false; message: string }> {
  try {
    await withGradeMutatorDb(async (db, ctx) => {
      await assertGuruExamInputEditable(db, ctx);
      const {
        schoolId,
        studentIdsByNisn,
        subjectIdsByCode,
        allowedSet,
        assignments,
        studentMeta,
      } = await gradingWriteContext(db, ctx, kind);

      const locks = await db.examScoreLock.findMany({
        where: { schoolId },
        select: { subjectId: true },
      });
      const lockedIds = new Set(locks.map((l) => l.subjectId));
      const writableSet = new Set([...allowedSet].filter((id) => !lockedIds.has(id)));

      const scoreType =
        kind === "madrasah"
          ? SCORE_TYPE.UJIAN_MADRASAH
          : SCORE_TYPE.UJIAN_PRAKTEK;

      await persistMatrix(db, {
        schoolId,
        semesterKey: EXAM_SEMESTER_KEY,
        scoreType,
        matrix,
        allowedSubjectIds: writableSet,
        studentIdsByNisn,
        subjectIdsByCode,
        studentMeta,
        allowedAssignments: assignments,
      });

      const { revalidateTag } = await import("next/cache");
      revalidateTag(`rekap-${schoolId}`, "max"); // revalidate specific school
    });
    
    return { ok: true };
  } catch (e) {
    return { ok: false, message: (e as Error).message };
  }
}

async function raporWriteContext(db: TenantDb, ctx: GradeMutatorCtx) {
  const { schoolId, role, userId } = ctx;
  const studentWhere = await studentWhereParticipatingActiveYear(schoolId, db);
  const students = await db.student.findMany({ where: studentWhere });
  const subjects = await db.subject.findMany({ where: { schoolId } });
  const studentIdsByNisn = new Map(
    students.map((s) => [String(s.nisn), s.id]),
  );
  const studentMeta = new Map(
    students.map((s) => [s.id, { classRoomId: s.classRoomId }]),
  );
  const subjectIdsByCode = new Map(subjects.map((s) => [s.code, s.id]));
  const assignments = await allowedGradeTargetsForRole({
    schoolId,
    userId,
    role,
    context: "rapor",
    db,
  });
  const allowedSubjectIds = new Set(subjects.map((s) => s.id));
  return {
    schoolId,
    studentIdsByNisn,
    subjectIdsByCode,
    allowedSubjectIds,
    studentMeta,
    assignments,
  };
}

// ─── Exam score lock (kirim / batal kirim) ───

export type ExamLockInfo = { subjectId: string; code: string; lockedBy: string; lockedAt: string };

export async function getExamLocksAction(): Promise<ExamLockInfo[]> {
  return withGradeMutatorDb(async (db, ctx) => {
  const { schoolId } = ctx;
  const locks = await db.examScoreLock.findMany({
    where: { schoolId },
    include: { subject: { select: { code: true } } },
  });
  return locks.map((l) => ({
    subjectId: l.subjectId,
    code: l.subject.code,
    lockedBy: l.lockedBy,
    lockedAt: l.lockedAt.toISOString(),
  }));
  });
}

export async function submitExamScoresAction(
  subjectIds: string[],
): Promise<{ ok: true } | { ok: false; message: string }> {
  try {
    await withGradeMutatorDb(async (db, ctx) => {
      await assertGuruExamInputEditable(db, ctx);
      const { schoolId, userId } = ctx;
      if (!subjectIds.length) throw new Error("Tidak ada mapel yang dipilih.");

      const valid = await db.subject.findMany({
        where: { schoolId, id: { in: subjectIds } },
        select: { id: true },
      });
      const validIds = new Set(valid.map((s) => s.id));

      const ops = subjectIds
        .filter((id) => validIds.has(id))
        .map((subjectId) =>
          db.examScoreLock.upsert({
            where: { schoolId_subjectId: { schoolId, subjectId } },
            create: { schoolId, subjectId, lockedBy: userId },
            update: { lockedBy: userId, lockedAt: new Date() },
          }),
        );
      if (ops.length) await Promise.all(ops);
    });

    return { ok: true };
  } catch (e) {
    return { ok: false, message: (e as Error).message };
  }
}

export async function unsubmitExamScoresAction(
  subjectIds: string[],
): Promise<{ ok: true } | { ok: false; message: string }> {
  try {
    await withGradeMutatorDb(async (db, ctx) => {
      await assertGuruExamInputEditable(db, ctx);
      const { schoolId } = ctx;
      if (!subjectIds.length) throw new Error("Tidak ada mapel yang dipilih.");

      await db.examScoreLock.deleteMany({
        where: { schoolId, subjectId: { in: subjectIds } },
      });
    });

    return { ok: true };
  } catch (e) {
    return { ok: false, message: (e as Error).message };
  }
}

// ─── Rapor score lock (kunci / buka kunci) ───

export type RaporLockInfo = { subjectId: string; code: string; lockedBy: string; lockedAt: string };

export async function getRaporLocksAction(
  semesterKey: string,
): Promise<RaporLockInfo[]> {
  return withGradeMutatorDb(async (db, ctx) => {
  const { schoolId } = ctx;
  const locks = await db.raporScoreLock.findMany({
    where: { schoolId, semesterKey },
    include: { subject: { select: { code: true } } },
  });
  return locks.map((l) => ({
    subjectId: l.subjectId,
    code: l.subject.code,
    lockedBy: l.lockedBy,
    lockedAt: l.lockedAt.toISOString(),
  }));
  });
}

export async function lockRaporScoresAction(
  semesterKey: string,
  subjectIds: string[],
): Promise<{ ok: true } | { ok: false; message: string }> {
  try {
    await withGradeMutatorDb(async (db, ctx) => {
      const { schoolId, userId } = ctx;
      if (!subjectIds.length) throw new Error("Tidak ada mapel yang dipilih.");

      const valid = await db.subject.findMany({
        where: { schoolId, id: { in: subjectIds } },
        select: { id: true },
      });
      const validIds = new Set(valid.map((s) => s.id));

      const ops = subjectIds
        .filter((id) => validIds.has(id))
        .map((subjectId) =>
          db.raporScoreLock.upsert({
            where: { schoolId_subjectId_semesterKey: { schoolId, subjectId, semesterKey } },
            create: { schoolId, subjectId, semesterKey, lockedBy: userId },
            update: { lockedBy: userId, lockedAt: new Date() },
          }),
        );
      if (ops.length) await Promise.all(ops);
    });

    return { ok: true };
  } catch (e) {
    return { ok: false, message: (e as Error).message };
  }
}

export async function unlockRaporScoresAction(
  semesterKey: string,
  subjectIds: string[],
): Promise<{ ok: true } | { ok: false; message: string }> {
  try {
    await withGradeMutatorDb(async (db, ctx) => {
      const { schoolId } = ctx;
      if (!subjectIds.length) throw new Error("Tidak ada mapel yang dipilih.");

      await db.raporScoreLock.deleteMany({
        where: { schoolId, semesterKey, subjectId: { in: subjectIds } },
      });
    });

    return { ok: true };
  } catch (e) {
    return { ok: false, message: (e as Error).message };
  }
}

export async function saveRaporScoresAction(
  semesterKey: string,
  jenis: "pengetahuan" | "keterampilan",
  matrix: ScoreGrid,
): Promise<{ ok: true } | { ok: false; message: string }> {
  try {
    await withGradeMutatorDb(async (db, ctx) => {
      const {
        schoolId,
        studentIdsByNisn,
        subjectIdsByCode,
        allowedSubjectIds,
        studentMeta,
        assignments,
      } = await raporWriteContext(db, ctx);

      const locks = await db.raporScoreLock.findMany({
        where: { schoolId, semesterKey },
        select: { subjectId: true },
      });
      const lockedIds = new Set(locks.map((l) => l.subjectId));
      const writableSet = new Set([...allowedSubjectIds].filter((id) => !lockedIds.has(id)));

      const scoreType =
        jenis === "pengetahuan"
          ? SCORE_TYPE.PENGETAHUAN
          : SCORE_TYPE.KETERAMPILAN;

      await persistMatrix(db, {
        schoolId,
        semesterKey,
        scoreType,
        matrix,
        allowedSubjectIds: writableSet,
        studentIdsByNisn,
        subjectIdsByCode,
        studentMeta,
        allowedAssignments: assignments,
      });

      const { syncSubjectSemesterCountsForSchool } = await import(
        "@/lib/subject-semester-sync"
      );
      await syncSubjectSemesterCountsForSchool(schoolId, db);

      const { revalidateTag } = await import("next/cache");
      revalidateTag(`rekap-${schoolId}`, "max"); // revalidate specific school
    });

    return { ok: true };
  } catch (e) {
    return { ok: false, message: (e as Error).message };
  }
}

/** Jenis nilai ujian yang relevan per mapel (selaras filter input ujian). */
function examScoreTypesForSubject(jenisUjian: string): (typeof SCORE_TYPE)[keyof typeof SCORE_TYPE][] {
  if (jenisUjian === "Ujian Praktek") return [SCORE_TYPE.UJIAN_PRAKTEK];
  if (jenisUjian === "Keduanya") {
    return [SCORE_TYPE.UJIAN_MADRASAH, SCORE_TYPE.UJIAN_PRAKTEK];
  }
  if (isUjianTertulisJenis(jenisUjian)) return [SCORE_TYPE.UJIAN_MADRASAH];
  return [SCORE_TYPE.UJIAN_MADRASAH];
}

export type ExamSubmitStatusRow = {
  assignmentId: string;
  teacherName: string;
  subjectCode: string;
  subjectName: string;
  className: string;
  /** Belum ada nilai tersimpan; ada nilai tapi mapel belum dikunci; mapel sudah dikirim (kunci). */
  status: "empty" | "progress" | "done";
  filledCells: number;
  totalCells: number;
  progressPercent: number;
  /** ISO waktu kunci nilai ujian mapel (ditampilkan di zona waktu perangkat pengguna). */
  lockedAt: string | null;
  submitterLabel: string | null;
};

/** Ringkasan status kirim nilai ujian per guru–mapel–kelas (admin: seluruh sekolah; guru: semua guru di kelas yang ia ajar / wali). */
export async function getExamSubmitStatusBoardAction(): Promise<
  { ok: true; rows: ExamSubmitStatusRow[] } | { ok: false; message: string }
> {
  try {
    const { schoolId, role, userId } = await requireUserSchoolId();
    if (role === "SISWA") {
      return { ok: false, message: "Tidak diizinkan." };
    }

    return withTenantDb(schoolId, async (db) => {
    const activeClassIds = await classRoomIdsForActiveAcademicYear(schoolId, db);
    const activeSet = new Set(activeClassIds);

    let assignmentWhere: { schoolId: string; classRoomId?: { in: string[] } };
    if (activeClassIds.length === 0) {
      return { ok: true, rows: [] };
    }

    if (role === "GURU") {
      const teacher = await db.teacher.findFirst({
        where: { schoolId, userId },
        select: {
          id: true,
          assignments: { select: { classRoomId: true } },
          homeroomClasses: { select: { id: true } },
        },
      });
      if (!teacher) {
        return { ok: false, message: "Data guru tidak ditemukan." };
      }
      const classIdsSet = new Set<string>();
      for (const a of teacher.assignments) {
        if (activeSet.has(a.classRoomId)) classIdsSet.add(a.classRoomId);
      }
      for (const c of teacher.homeroomClasses) {
        if (activeSet.has(c.id)) classIdsSet.add(c.id);
      }
      const myClassIds = [...classIdsSet];
      if (myClassIds.length === 0) {
        return { ok: true, rows: [] };
      }
      assignmentWhere = { schoolId, classRoomId: { in: myClassIds } };
    } else {
      assignmentWhere = { schoolId, classRoomId: { in: activeClassIds } };
    }

    const assignments = await db.teachingAssignment.findMany({
      where: assignmentWhere,
      include: {
        teacher: { select: { nama: true } },
        subject: { select: { id: true, code: true, name: true, jenisUjian: true } },
        classRoom: { select: { name: true } },
      },
    });

    const classIds = [...new Set(assignments.map((a) => a.classRoomId))];
    const participatingWhere = await studentWhereParticipatingActiveYear(schoolId, db);
    const students =
      assignments.length === 0
        ? []
        : await db.student.findMany({
            where:
              classIds.length > 0
                ? {
                    AND: [
                      participatingWhere,
                      { classRoomId: { in: classIds } },
                    ],
                  }
                : participatingWhere,
            select: { id: true, classRoomId: true },
          });
    const studentIds = students.map((s) => s.id);

    const [locks, grades] = await Promise.all([
      db.examScoreLock.findMany({
        where: { schoolId },
        select: { subjectId: true, lockedBy: true, lockedAt: true },
      }),
      studentIds.length > 0
        ? db.gradeEntry.findMany({
            where: {
              schoolId,
              semesterKey: EXAM_SEMESTER_KEY,
              scoreType: { in: [SCORE_TYPE.UJIAN_MADRASAH, SCORE_TYPE.UJIAN_PRAKTEK] },
              studentId: { in: studentIds },
            },
            select: { studentId: true, subjectId: true, scoreType: true },
          })
        : Promise.resolve([]),
    ]);

    const lockBySubject = new Map(
      locks.map((l) => [
        l.subjectId,
        { lockedBy: l.lockedBy, lockedAt: l.lockedAt.toISOString() },
      ]),
    );

    const lockerIds = [...new Set(locks.map((l) => l.lockedBy))];
    const lockerUsers =
      lockerIds.length > 0
        ? await db.user.findMany({
            where: { id: { in: lockerIds } },
            select: { id: true, name: true, email: true, role: true },
          })
        : [];
    const lockerLabel = new Map(
      lockerUsers.map((u) => {
        if (u.role === "ADMIN_SEKOLAH") {
          return [u.id, "Admin Sekolah"] as const;
        }
        return [u.id, (u.name?.trim() || u.email || u.id) as string] as const;
      }),
    );

    const gradeKey = (studentId: string, subjectId: string, scoreType: string) =>
      `${studentId}|${subjectId}|${scoreType}`;
    const gradeSet = new Set(grades.map((g) => gradeKey(g.studentId, g.subjectId, g.scoreType)));

    const studentsByClass = new Map<string, string[]>();
    for (const s of students) {
      if (!s.classRoomId) continue;
      const arr = studentsByClass.get(s.classRoomId) ?? [];
      arr.push(s.id);
      studentsByClass.set(s.classRoomId, arr);
    }

    const rows: ExamSubmitStatusRow[] = [];

    const sorted = [...assignments].sort((a, b) => {
      const tn = a.teacher.nama.localeCompare(b.teacher.nama, "id");
      if (tn !== 0) return tn;
      const sc = a.subject.code.localeCompare(b.subject.code, "id");
      if (sc !== 0) return sc;
      return a.classRoom.name.localeCompare(b.classRoom.name, "id");
    });

    for (const a of sorted) {
      const types = examScoreTypesForSubject(a.subject.jenisUjian);
      const studIds = studentsByClass.get(a.classRoomId) ?? [];
      const totalCells = studIds.length * types.length;

      let filledCells = 0;
      for (const sid of studIds) {
        for (const st of types) {
          if (gradeSet.has(gradeKey(sid, a.subjectId, st))) filledCells++;
        }
      }

      const lock = lockBySubject.get(a.subjectId);
      const locked = !!lock;
      const status: ExamSubmitStatusRow["status"] = locked
        ? "done"
        : filledCells > 0
          ? "progress"
          : "empty";

      const progressPercent =
        totalCells <= 0 ? 0 : Math.min(100, Math.round((filledCells / totalCells) * 100));

      rows.push({
        assignmentId: a.id,
        teacherName: a.teacher.nama,
        subjectCode: a.subject.code,
        subjectName: a.subject.name,
        className: a.classRoom.name,
        status,
        filledCells,
        totalCells,
        progressPercent: locked ? 100 : progressPercent,
        lockedAt: lock?.lockedAt ?? null,
        submitterLabel: lock ? (lockerLabel.get(lock.lockedBy) ?? null) : null,
      });
    }

    return { ok: true as const, rows };
    });
  } catch (e) {
    return { ok: false, message: (e as Error).message };
  }
}
