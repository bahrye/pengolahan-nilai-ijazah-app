import { prisma } from "@/lib/prisma";

/** Pesan saat sekolah dinonaktifkan superadmin (login / sesi). */
export const SCHOOL_DEACTIVATED_MESSAGE =
  "Sekolah ini telah dinonaktifkan. Hubungi superadmin jika perlu diaktifkan kembali.";

export const LOGIN_QUERY_SCHOOL_DEACTIVATED = "school_deactivated";

export const CREDENTIALS_ERROR_SCHOOL_DEACTIVATED = "school_deactivated";

export async function isSchoolActiveForAccess(
  schoolId: string | null | undefined,
): Promise<boolean> {
  if (!schoolId?.trim()) return false;
  const school = await prisma.school.findUnique({
    where: { id: schoolId },
    select: { isActive: true },
  });
  return school?.isActive === true;
}
