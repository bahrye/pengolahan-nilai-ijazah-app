import {
  buildActiveSemesterKeysBySubject,
  countActiveSemesters,
  RAPOR_SCORE_TYPES,
  type RaporSemesterActivityRow,
} from "@/domain/subject-active-semesters";
import { EXAM_SEMESTER_KEY } from "@/lib/examSemester";
import { prisma } from "@/lib/prisma";
import { defaultTenantDb, type TenantDb } from "@/server/tenant-db-context";

export type SubjectSemesterActivity = {
  subjectId: string;
  subjectCode: string;
  activeSemesterKeys: Set<string>;
  activeSemesterCount: number;
};

async function orderedSemesterKeysForSchool(
  schoolId: string,
  db: TenantDb = defaultTenantDb(),
): Promise<string[]> {
  const activeYear = await db.academicYear.findFirst({
    where: { schoolId, isActive: true },
    select: { id: true },
  });
  if (!activeYear) return [];

  const semesters = await db.semester.findMany({
    where: { schoolId, academicYearId: activeYear.id },
    orderBy: { orderNo: "asc" },
    select: { internalKey: true },
  });
  return semesters.map((s) => s.internalKey);
}

async function loadRaporActivityRows(
  schoolId: string,
  semesterKeys: readonly string[],
  db: TenantDb = defaultTenantDb(),
): Promise<RaporSemesterActivityRow[]> {
  if (semesterKeys.length === 0) return [];

  const rows = await db.gradeEntry.findMany({
    where: {
      schoolId,
      semesterKey: { in: [...semesterKeys] },
      scoreType: { in: [...RAPOR_SCORE_TYPES] },
    },
    select: { subjectId: true, semesterKey: true },
    distinct: ["subjectId", "semesterKey"],
  });

  return rows.filter((r) => r.semesterKey !== EXAM_SEMESTER_KEY);
}

/** Peta kode mapel → semester yang punya minimal satu nilai rapor (seluruh siswa). */
export async function loadActiveSemesterKeysBySubjectCode(
  schoolId: string,
): Promise<Map<string, Set<string>>> {
  const orderedKeys = await orderedSemesterKeysForSchool(schoolId);
  const subjects = await prisma.subject.findMany({
    where: { schoolId },
    select: { id: true, code: true },
  });
  if (subjects.length === 0) return new Map();

  const activityRows = await loadRaporActivityRows(schoolId, orderedKeys);
  const byId = buildActiveSemesterKeysBySubject(
    orderedKeys,
    subjects.map((s) => s.id),
    activityRows,
  );

  const byCode = new Map<string, Set<string>>();
  for (const su of subjects) {
    byCode.set(su.code, new Set(byId.get(su.id) ?? []));
  }
  return byCode;
}

/**
 * Hitung ulang `Subject.semesterCount` dari nilai rapor yang sudah diinput.
 * Dipanggil saat buka halaman Mapel dan setelah simpan nilai rapor.
 */
export async function syncSubjectSemesterCountsForSchool(
  schoolId: string,
  db: TenantDb = defaultTenantDb(),
): Promise<{ updated: number; orderedSemesterKeys: string[] }> {
  const orderedKeys = await orderedSemesterKeysForSchool(schoolId, db);
  const subjects = await db.subject.findMany({
    where: { schoolId },
    select: { id: true },
  });
  if (subjects.length === 0) {
    return { updated: 0, orderedSemesterKeys: orderedKeys };
  }

  const activityRows = await loadRaporActivityRows(schoolId, orderedKeys, db);
  const activeBySubject = buildActiveSemesterKeysBySubject(
    orderedKeys,
    subjects.map((s) => s.id),
    activityRows,
  );

  let updated = 0;
  const updates = subjects.map((su) => {
    const active = activeBySubject.get(su.id) ?? new Set<string>();
    const count = countActiveSemesters(orderedKeys, active);
    return db.subject.update({
      where: { id: su.id },
      data: { semesterCount: count },
    });
  });
  if (updates.length > 0) {
    await Promise.all(updates);
  }
  updated = subjects.length;

  return { updated, orderedSemesterKeys: orderedKeys };
}
