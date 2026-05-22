import { redirect } from "next/navigation";

import { prisma } from "@/lib/prisma";
import { requireUserSchoolId } from "@/server/session";

import { CetakNilaiClient } from "../../cetak-nilai/CetakNilaiClient";

export default async function GuruCetakNilaiPage() {
  const ctx = await requireUserSchoolId();
  if (ctx.role !== "GURU") {
    redirect("/dashboard");
  }

  const teacher = await prisma.teacher.findFirst({
    where: { userId: ctx.userId, schoolId: ctx.schoolId },
    select: { id: true },
  });
  if (!teacher) {
    redirect("/dashboard");
  }

  const activeYear = await prisma.academicYear.findFirst({
    where: { schoolId: ctx.schoolId, isActive: true },
    select: { id: true },
  });

  const teacherAssigns = await prisma.teachingAssignment.findMany({
    where: { schoolId: ctx.schoolId, teacherId: teacher.id },
    select: { classRoomId: true, subjectId: true },
  });

  const homeroomClasses = activeYear
    ? await prisma.classRoom.findMany({
        where: { 
          schoolId: ctx.schoolId, 
          academicYearId: activeYear.id,
          homeroomTeacherId: teacher.id
        },
        select: { id: true }
      })
    : [];
  const homeroomClassIds = homeroomClasses.map((c) => c.id);

  let homeroomAssigns: { classRoomId: string, subjectId: string }[] = [];
  const lockedSubjectIdsSet = new Set<string>();

  if (homeroomClassIds.length > 0) {
    homeroomAssigns = await prisma.teachingAssignment.findMany({
      where: {
        schoolId: ctx.schoolId,
        classRoomId: { in: homeroomClassIds }
      },
      select: { classRoomId: true, subjectId: true }
    });

    const possibleHomeroomSubjectIds = [...new Set(homeroomAssigns.map((a) => a.subjectId))];
    
    if (possibleHomeroomSubjectIds.length > 0) {
      const locks = await prisma.examScoreLock.findMany({
        where: {
          schoolId: ctx.schoolId,
          subjectId: { in: possibleHomeroomSubjectIds }
        },
        select: { subjectId: true }
      });
      for (const l of locks) {
        lockedSubjectIdsSet.add(l.subjectId);
      }
    }
  }

  const teacherClassIds = teacherAssigns.map((a) => a.classRoomId);
  const classIds = [...new Set([...teacherClassIds, ...homeroomClassIds])];

  const classRooms = activeYear
    ? await prisma.classRoom.findMany({
        where: {
          id: { in: classIds },
          schoolId: ctx.schoolId,
          academicYearId: activeYear.id,
        },
        orderBy: { name: "asc" },
        select: { id: true, name: true, academicYear: { select: { label: true } } },
      })
    : [];

  const subjectIdsByClassRoomId: Record<string, string[]> = {};
  for (const c of classRooms) {
    subjectIdsByClassRoomId[c.id] = [];
  }
  
  for (const a of teacherAssigns) {
    const list = subjectIdsByClassRoomId[a.classRoomId];
    if (list && !list.includes(a.subjectId)) {
      list.push(a.subjectId);
    }
  }

  for (const a of homeroomAssigns) {
    const list = subjectIdsByClassRoomId[a.classRoomId];
    if (list && !list.includes(a.subjectId)) {
      list.push(a.subjectId);
    }
  }

  const allowedSubjectIds = new Set<string>();
  for (const ids of Object.values(subjectIdsByClassRoomId)) {
    for (const id of ids) {
      allowedSubjectIds.add(id);
    }
  }
  const subjectIds = [...allowedSubjectIds];
  
  // Also make sure we get the locks for the teacher's own subjects, 
  // since they also need to be disabled if not locked.
  if (teacherAssigns.length > 0) {
    const locksForTeacher = await prisma.examScoreLock.findMany({
      where: {
        schoolId: ctx.schoolId,
        subjectId: { in: teacherAssigns.map(a => a.subjectId) }
      },
      select: { subjectId: true }
    });
    for (const l of locksForTeacher) {
      lockedSubjectIdsSet.add(l.subjectId);
    }
  }

  const subjects = await prisma.subject.findMany({
    where: { schoolId: ctx.schoolId, id: { in: subjectIds } },
    orderBy: [{ orderNo: "asc" }, { code: "asc" }],
    select: { id: true, code: true, name: true },
  });

  return (
    <CetakNilaiClient
      variant="teacher"
      classRooms={classRooms.map((c) => ({
        id: c.id,
        name: `${c.name} (${c.academicYear.label})`,
      }))}
      subjects={subjects}
      subjectIdsByClassRoomId={subjectIdsByClassRoomId}
      lockedSubjectIds={Array.from(lockedSubjectIdsSet)}
      isHomeroomTeacher={homeroomClassIds.length > 0}
    />
  );
}
