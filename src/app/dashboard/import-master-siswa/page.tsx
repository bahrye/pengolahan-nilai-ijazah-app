import { prisma } from "@/lib/prisma";
import { studentWhereAdminRosterActiveYear } from "@/server/active-academic-year-scope";
import { requireTenantAdmin } from "@/server/session";

import { ImportMasterSiswaClient } from "./ImportMasterSiswaClient";

export default async function ImportMasterSiswaPage() {
  const { schoolId } = await requireTenantAdmin();
  const studentWhere = await studentWhereAdminRosterActiveYear(schoolId);
  const [activeYear, existingStudents] = await Promise.all([
    prisma.academicYear.findFirst({
      where: { schoolId, isActive: true },
      select: { label: true },
    }),
    prisma.student.findMany({
      where: studentWhere,
      select: { nisn: true },
    }),
  ]);

  return (
    <ImportMasterSiswaClient
      activeYearLabel={activeYear?.label ?? null}
      existingNisns={existingStudents.map((s) => s.nisn)}
    />
  );
}
