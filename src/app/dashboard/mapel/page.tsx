import { prisma } from "@/lib/prisma";
import { syncSubjectSemesterCountsForSchool } from "@/lib/subject-semester-sync";
import { requireTenantAdmin } from "@/server/session";

import { MapelBulk } from "./MapelBulk";

export default async function MapelPage() {
  const { schoolId } = await requireTenantAdmin();
  await syncSubjectSemesterCountsForSchool(schoolId);
  const [school, rows] = await Promise.all([
    prisma.school.findUnique({
      where: { id: schoolId },
      select: { jenjang: true },
    }),
    prisma.subject.findMany({
      where: { schoolId },
      orderBy: [{ orderNo: "asc" }, { code: "asc" }],
    }),
  ]);
  const list = rows.map((x, i) => ({
    id: x.id,
    row: i + 1,
    kode: x.code,
    nama: x.name,
    kelompok: x.kelompok,
    jenisUjian: x.jenisUjian,
    orderNo: x.orderNo,
    semesterCount: x.semesterCount,
  }));

  return <MapelBulk initial={list} schoolJenjang={school?.jenjang ?? null} />;
}
