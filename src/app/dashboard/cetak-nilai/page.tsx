import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { requireTenantAdmin } from "@/server/session";

import { CetakNilaiClient } from "./CetakNilaiClient";

export default async function CetakNilaiPage() {
  const session = await auth();
  if (session?.user?.role === "GURU") {
    redirect("/dashboard/guru/cetak-nilai");
  }

  const { schoolId } = await requireTenantAdmin();

  const activeYear = await prisma.academicYear.findFirst({
    where: { schoolId, isActive: true },
  });
  const classRooms = activeYear
    ? await prisma.classRoom.findMany({
        where: { academicYearId: activeYear.id },
        orderBy: { name: "asc" },
        select: { id: true, name: true },
      })
    : [];

  const roomIds = classRooms.map((c) => c.id);
  const assigns =
    roomIds.length > 0
      ? await prisma.teachingAssignment.findMany({
          where: { schoolId, classRoomId: { in: roomIds } },
          select: { classRoomId: true, subjectId: true },
        })
      : [];

  const subjectIdsByClassRoomId: Record<string, string[]> = {};
  for (const c of classRooms) {
    subjectIdsByClassRoomId[c.id] = [];
  }
  for (const a of assigns) {
    const list = subjectIdsByClassRoomId[a.classRoomId];
    if (list && !list.includes(a.subjectId)) {
      list.push(a.subjectId);
    }
  }

  const allSubjectIds = [...new Set(assigns.map((a) => a.subjectId))];
  const subjects = await prisma.subject.findMany({
    where: { schoolId, id: { in: allSubjectIds } },
    orderBy: [{ orderNo: "asc" }, { code: "asc" }],
    select: { id: true, code: true, name: true },
  });

  return (
    <CetakNilaiClient
      variant="admin"
      classRooms={classRooms.map((c) => ({
        id: c.id,
        name: `${c.name} (${activeYear?.label ?? "TA aktif"})`,
      }))}
      subjects={subjects}
      subjectIdsByClassRoomId={subjectIdsByClassRoomId}
    />
  );
}
