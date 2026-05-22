import { prisma } from "@/lib/prisma";

export type GuruSchoolContextRow = {
  schoolId: string;
  namaSekolah: string | null;
  isSatminkal: boolean;
  isHome: boolean;
};

/** Sekolah tempat pengguna punya baris `Teacher` (guru). */
export async function fetchGuruSchoolContextRowsForUser(
  userId: string,
  homeSchoolId: string | null,
): Promise<GuruSchoolContextRow[]> {
  const teachers = await prisma.teacher.findMany({
    where: { userId },
    include: {
      school: { select: { id: true, namaSekolah: true, isSatminkal: true, isActive: true } },
    },
    orderBy: { school: { namaSekolah: "asc" } },
  });
  return teachers
    .filter((t) => t.school.isActive)
    .map((t) => ({
    schoolId: t.schoolId,
    namaSekolah: t.school.namaSekolah,
    isSatminkal: t.school.isSatminkal,
    isHome: homeSchoolId != null && t.schoolId === homeSchoolId,
  }));
}
