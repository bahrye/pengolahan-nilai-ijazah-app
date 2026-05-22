import { prisma } from "@/lib/prisma";
import { requireTenantAdmin } from "@/server/session";

import { GuruPanels } from "./GuruPanels";

export default async function GuruPage() {
  const { schoolId } = await requireTenantAdmin();
  const [teachersRaw, subjects, activeYear, school] = await Promise.all([
    prisma.teacher.findMany({
      where: { schoolId },
      include: { user: true, assignments: { include: { subject: true, classRoom: true } } },
      orderBy: { nama: "asc" },
    }),
    prisma.subject.findMany({
      where: { schoolId },
      orderBy: { code: "asc" },
    }),
    prisma.academicYear.findFirst({ where: { schoolId, isActive: true } }),
    prisma.school.findUnique({ where: { id: schoolId }, select: { namaSekolah: true, isSatminkal: true } }),
  ]);
  const classRooms = activeYear
    ? await prisma.classRoom.findMany({
        where: { academicYearId: activeYear.id },
        orderBy: { name: "asc" },
      })
    : [];

  const teachers = teachersRaw.map((t) => ({
    id: t.id,
    nama: t.nama,
    nip: t.nip,
    isActive: t.user.isActive,
    usesDefaultLoginPin: t.usesDefaultLoginPin,
    user: { email: t.user.email, schoolId: t.user.schoolId },
    assignments: t.assignments.map((a) => ({
      id: a.id,
      subject: { code: a.subject.code, name: a.subject.name },
      classRoom: { name: a.classRoom.name },
    })),
  }));

  return (
    <GuruPanels
      tenantSchoolId={schoolId}
      teachers={teachers}
      subjects={subjects.map((s) => ({
        id: s.id,
        code: s.code,
        name: s.name,
      }))}
      classRooms={classRooms.map((c) => ({
        id: c.id,
        name: `${c.name} (${activeYear?.label ?? "TA"})`,
      }))}
      yearLabel={activeYear?.label ?? "TA"}
      schoolName={school?.namaSekolah ?? undefined}
      canManageCredentials={school?.isSatminkal ?? true}
    />
  );
}
