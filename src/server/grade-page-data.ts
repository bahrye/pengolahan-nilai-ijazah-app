import type { ExamInputPolicy } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { requireUserSchoolId } from "@/server/session";

const DEFAULT_EXAM_INPUT: {
  policy: ExamInputPolicy;
  windowStartIso: string | null;
  windowEndIso: string | null;
} = {
  policy: "OPEN",
  windowStartIso: null,
  windowEndIso: null,
};

export async function loadGradePageMaster() {
  const { schoolId, userId, role } = await requireUserSchoolId();

  const activeYear = await prisma.academicYear.findFirst({
    where: { schoolId, isActive: true },
  });
  if (!activeYear)
    return {
      students: [],
      subjects: [],
      classRooms: [],
      examInput: DEFAULT_EXAM_INPUT,
      userRole: role,
    };

  const activeClassRoomIds = new Set(
    (
      await prisma.classRoom.findMany({
        where: { schoolId, academicYearId: activeYear.id },
        select: { id: true },
      })
    ).map((c) => c.id),
  );

  let assignedSubjectIds: Set<string> | null = null;
  let assignedClassRoomIds: Set<string> | null = null;

  if (role === "GURU") {
    const teacher = await prisma.teacher.findFirst({
      where: { schoolId, userId },
      include: {
        assignments: true,
        homeroomClasses: { select: { id: true } },
      },
    });

    const classIds = new Set<string>();
    const subjectIds = new Set<string>();

    // Homeroom classes (for student visibility)
    if (teacher?.homeroomClasses.length) {
      for (const cls of teacher.homeroomClasses) {
        if (activeClassRoomIds.has(cls.id)) classIds.add(cls.id);
      }
    }

    // Teaching assignments
    if (teacher?.assignments.length) {
      for (const a of teacher.assignments) {
        if (activeClassRoomIds.has(a.classRoomId)) {
          classIds.add(a.classRoomId);
          subjectIds.add(a.subjectId);
        }
      }
    }

    if (classIds.size === 0) {
      return {
        students: [],
        subjects: [],
        classRooms: [],
        examInput: DEFAULT_EXAM_INPUT,
        userRole: role,
      };
    }

    assignedClassRoomIds = classIds;
    // Ujian: guru (termasuk wali kelas) hanya mapel yang diajar
    assignedSubjectIds = subjectIds.size > 0 ? subjectIds : null;
  }

  const classRoomFilter = assignedClassRoomIds
    ? [...assignedClassRoomIds]
    : [...activeClassRoomIds];

  const [schoolExam, students, subjects] = await Promise.all([
    prisma.school.findUnique({
      where: { id: schoolId },
      select: {
        examInputPolicy: true,
        examInputWindowStart: true,
        examInputWindowEnd: true,
      },
    }),
    prisma.student.findMany({
      where: {
        schoolId,
        isActive: true,
        classRoomId: { in: classRoomFilter },
      },
      orderBy: [{ className: "asc" }, { name: "asc" }],
    }),
    prisma.subject.findMany({
      where: {
        schoolId,
        ...(assignedSubjectIds
          ? { id: { in: [...assignedSubjectIds] } }
          : {}),
      },
      orderBy: [{ orderNo: "asc" }, { code: "asc" }],
    }),
  ]);

  const classRooms = await prisma.classRoom.findMany({
    where: {
      id: { in: classRoomFilter },
    },
    orderBy: { name: "asc" },
  });

  return {
    students: students.map((s) => ({
      id: s.id,
      nisn: String(s.nisn),
      name: s.name,
      classRoomId: s.classRoomId ?? "",
    })),
    subjects: subjects.map((su) => ({
      id: su.id,
      kode: su.code,
      nama: su.name,
      jenisUjian: su.jenisUjian,
    })),
    classRooms: classRooms.map((c) => ({ id: c.id, name: c.name })),
    examInput: {
      policy: schoolExam?.examInputPolicy ?? DEFAULT_EXAM_INPUT.policy,
      windowStartIso: schoolExam?.examInputWindowStart?.toISOString() ?? null,
      windowEndIso: schoolExam?.examInputWindowEnd?.toISOString() ?? null,
    },
    userRole: role,
  };
}

/**
 * Load master data for rapor page.
 * For GURU: students in homeroom class OR teaching assignment classes (active year), all subjects.
 * For ADMIN: all students, all subjects.
 */
export async function loadRaporPageMaster() {
  const { schoolId, userId, role } = await requireUserSchoolId();

  const activeYear = await prisma.academicYear.findFirst({
    where: { schoolId, isActive: true },
  });
  if (!activeYear) return { students: [], subjects: [], classRooms: [] };

  const activeClassRooms = await prisma.classRoom.findMany({
    where: { schoolId, academicYearId: activeYear.id },
    select: { id: true, name: true },
  });
  const activeClassRoomIds = new Set(activeClassRooms.map((c) => c.id));

  let guruClassRoomIds: string[] | null = null;

  if (role === "GURU") {
    const teacher = await prisma.teacher.findFirst({
      where: { schoolId, userId },
      include: {
        homeroomClasses: { select: { id: true } },
        assignments: { select: { classRoomId: true } },
      },
    });

    if (teacher) {
      // Priority 1: homeroom classes in active year
      const homeroomIds = teacher.homeroomClasses
        .map((c) => c.id)
        .filter((id) => activeClassRoomIds.has(id));

      if (homeroomIds.length > 0) {
        guruClassRoomIds = homeroomIds;
      } else {
        // Fallback: teaching assignment classes in active year
        const assignmentIds = [
          ...new Set(
            teacher.assignments
              .map((a) => a.classRoomId)
              .filter((id) => activeClassRoomIds.has(id)),
          ),
        ];
        if (assignmentIds.length > 0) {
          guruClassRoomIds = assignmentIds;
        }
      }
    }

    if (!guruClassRoomIds?.length) {
      return { students: [], subjects: [], classRooms: [] };
    }
  }

  const classRoomFilter = guruClassRoomIds ?? [...activeClassRoomIds];

  const [students, subjects] = await Promise.all([
    prisma.student.findMany({
      where: {
        schoolId,
        isActive: true,
        classRoomId: { in: classRoomFilter },
      },
      orderBy: [{ className: "asc" }, { name: "asc" }],
    }),
    prisma.subject.findMany({
      where: { schoolId },
      orderBy: [{ orderNo: "asc" }, { code: "asc" }],
    }),
  ]);

  const classRooms = await prisma.classRoom.findMany({
    where: { id: { in: classRoomFilter } },
    orderBy: { name: "asc" },
  });

  return {
    students: students.map((s) => ({
      id: s.id,
      nisn: String(s.nisn),
      name: s.name,
      classRoomId: s.classRoomId ?? "",
    })),
    subjects: subjects.map((su) => ({
      id: su.id,
      kode: su.code,
      nama: su.name,
      jenisUjian: su.jenisUjian,
    })),
    classRooms: classRooms.map((c) => ({ id: c.id, name: c.name })),
  };
}

/** Check if current guru user can access rapor page (homeroom or has assignments). */
export async function guruIsHomeroom(): Promise<boolean> {
  const { schoolId, userId } = await requireUserSchoolId();
  const teacher = await prisma.teacher.findFirst({
    where: { schoolId, userId },
    include: {
      homeroomClasses: { select: { id: true }, take: 1 },
      assignments: { select: { classRoomId: true }, take: 1 },
    },
  });
  if (!teacher) return false;
  return teacher.homeroomClasses.length > 0 || teacher.assignments.length > 0;
}

export async function loadRaporSemesterOptions(): Promise<
  { key: string; label: string }[]
> {
  const { schoolId } = await requireUserSchoolId();
  const activeYear = await prisma.academicYear.findFirst({
    where: { schoolId, isActive: true },
  });

  if (!activeYear) return [];

  const semesters = await prisma.semester.findMany({
    where: { academicYearId: activeYear.id },
    orderBy: { orderNo: "asc" },
  });

  return semesters.map((s) => ({
    key: s.internalKey,
    label: `${s.label} (${activeYear.label})`,
  }));
}

export async function loadGradingAspectMode() {
  const { schoolId } = await requireUserSchoolId();
  const cfg = await prisma.schoolGradingConfig.findUnique({
    where: { schoolId },
  });
  return cfg?.raporAspectMode ?? "BOTH";
}
