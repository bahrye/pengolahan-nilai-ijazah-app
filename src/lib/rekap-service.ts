import type { Prisma } from "@prisma/client";

import { computeRekapitulasi } from "@/domain/rekapitulasi";
import { semestersForSchool } from "@/domain/semesters";
import { assembleRekapInput } from "@/lib/rekap-loader";
import { prisma } from "@/lib/prisma";
import { syncSubjectSemesterCountsForSchool } from "@/lib/subject-semester-sync";
import { studentWhereParticipatingActiveYear } from "@/server/active-academic-year-scope";
import { withTenantDb, type TenantDb } from "@/server/tenant-db-context";

export type RunRekapForSchoolOptions = {
  /** Batasi siswa ke kelas wali (satu atau lebih). */
  homeroomClassRoomIds?: string[];
  /** Hanya hitung siswa dengan ID ini (mis. SKL / pratinjau per siswa — jauh lebih cepat). */
  studentIds?: string[];
};

export async function runRekapForSchool(schoolId: string, opts?: RunRekapForSchoolOptions) {
  return withTenantDb(schoolId, (db) => runRekapForSchoolInDb(db, schoolId, opts));
}

export async function runRekapForSchoolInDb(
  db: TenantDb,
  schoolId: string,
  opts?: RunRekapForSchoolOptions,
) {
  await syncSubjectSemesterCountsForSchool(schoolId, db);

  const classFilter = opts?.homeroomClassRoomIds;
  const activeStudentWhere = await studentWhereParticipatingActiveYear(schoolId, db);
  let studentWhere: Prisma.StudentWhereInput | undefined = activeStudentWhere;
  if (classFilter && classFilter.length > 0) {
    studentWhere = {
      AND: [activeStudentWhere, { classRoomId: { in: classFilter } }],
    };
  }
  const onlyStudentIds = opts?.studentIds?.filter(Boolean);
  if (onlyStudentIds && onlyStudentIds.length > 0) {
    studentWhere = {
      AND: [studentWhere, { id: { in: onlyStudentIds } }],
    };
  }

  const [schoolRaw, grading, activeYear] = await Promise.all([
    db.school.findUnique({
      where: { id: schoolId },
      include: {
        students: {
          where: studentWhere,
          orderBy: [{ className: "asc" }, { name: "asc" }],
        },
        subjects: { orderBy: [{ orderNo: "asc" }, { code: "asc" }] },
      },
    }),
    db.schoolGradingConfig.findUnique({ where: { schoolId } }),
    db.academicYear.findFirst({
      where: { schoolId, isActive: true },
    }),
  ]);

  const semestersDb = activeYear
    ? await db.semester.findMany({
        where: { academicYearId: activeYear.id },
        orderBy: { orderNo: "asc" },
      })
    : [];

  if (!schoolRaw)
    throw new Error("Data sekolah tidak ditemukan untuk perhitungan rekap.");

  const gradingSafe = grading ?? {
    bobotUjian: 40,
    bobotRapor: 60,
    kkm: 75,
    raporAspectMode: "BOTH" as const,
  };

  /** Prefer semester dari master aktif tahun ajaran; fallback ke pola jenjang. */
  let semesterKeys: string[];
  if (semestersDb.length > 0) {
    semesterKeys = semestersDb.map((s) => s.internalKey);
  } else {
    semesterKeys = semestersForSchool(
      schoolRaw.jenjang,
      schoolRaw.raporSemesterCount,
    );
  }

  const studentIds = schoolRaw.students.map((s) => s.id);
  const grades =
    studentIds.length > 0
      ? await db.gradeEntry.findMany({
          where: { schoolId, studentId: { in: studentIds } },
        })
      : [];

  const input = assembleRekapInput({
    school: schoolRaw,
    grading: {
      bobotUjian: Number(gradingSafe.bobotUjian),
      bobotRapor: Number(gradingSafe.bobotRapor),
      kkm: Number(gradingSafe.kkm),
      raporAspectMode: gradingSafe.raporAspectMode,
    },
    grades,
    semesterKeys,
  });

  return computeRekapitulasi(input);
}
