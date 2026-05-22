import { prisma } from "@/lib/prisma";
import { requirePlatformSchoolAdmin } from "@/server/session";

export async function loadSchoolFormData() {
  const { userId, schoolId } = await requirePlatformSchoolAdmin();
  if (!schoolId) {
    return {
      userId,
      schoolId: null as string | null,
      school: null,
    };
  }
  const school = await prisma.school.findUnique({
    where: { id: schoolId },
    include: { gradingConfig: true },
  });
  return {
    userId,
    schoolId,
    school,
  };
}
