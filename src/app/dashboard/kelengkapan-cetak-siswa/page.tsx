import { prisma } from "@/lib/prisma";
import { requireTenantAdmin } from "@/server/session";
import { studentWhereParticipatingActiveYear } from "@/server/active-academic-year-scope";

import { KelengkapanCetakSiswaClient } from "./KelengkapanCetakSiswaClient";
import type { PrintCompletenessRow } from "./types";

export default async function KelengkapanCetakSiswaPage() {
  const { schoolId } = await requireTenantAdmin();
  const studentWhere = await studentWhereParticipatingActiveYear(schoolId);
  const students = await prisma.student.findMany({
    where: studentWhere,
    orderBy: [{ className: "asc" }, { name: "asc" }],
    select: {
      id: true,
      nisn: true,
      name: true,
      className: true,
      nomorUjian: true,
      ruangUjian: true,
      classRoom: { select: { name: true } },
    },
  });

  const rows: PrintCompletenessRow[] = students.map((s) => ({
    id: s.id,
    nisn: String(s.nisn),
    name: s.name,
    classLabel: s.className ?? s.classRoom?.name ?? null,
    nomorUjian: s.nomorUjian,
    ruangUjian: s.ruangUjian,
  }));

  return <KelengkapanCetakSiswaClient initialRows={rows} />;
}
