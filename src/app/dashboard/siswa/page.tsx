import { prisma } from "@/lib/prisma";
import { requireTenantAdmin } from "@/server/session";
import { studentWhereAdminRosterActiveYear } from "@/server/active-academic-year-scope";
import { getSchoolAccessSnapshot } from "@/server/subscription-access";
import { studentsToRows } from "@/server/student-serialize";

import { SiswaClient } from "./SiswaClient";

export default async function SiswaPage() {
  const { schoolId } = await requireTenantAdmin();
  const studentWhere = await studentWhereAdminRosterActiveYear(schoolId);
  const [students, activeYear, access] = await Promise.all([
    prisma.student.findMany({
      where: studentWhere,
      include: {
        classRoom: true,
        user: { select: { isActive: true } },
      },
      orderBy: [{ className: "asc" }, { name: "asc" }],
    }),
    prisma.academicYear.findFirst({ where: { schoolId, isActive: true } }),
    getSchoolAccessSnapshot(schoolId),
  ]);
  const classRooms = activeYear
    ? await prisma.classRoom.findMany({
        where: { academicYearId: activeYear.id },
        orderBy: { name: "asc" },
      })
    : [];

  return (
    <SiswaClient
      initial={studentsToRows(students)}
      classRooms={classRooms.map((c) => ({
        id: c.id,
        name: `${c.name} (${activeYear?.label ?? "TA aktif"})`,
      }))}
      canGenerateLoginCards={access.canGenerateStudentLoginCards}
    />
  );
}
