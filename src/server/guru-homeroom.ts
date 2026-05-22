import { cache } from "react";

import { prisma } from "@/lib/prisma";

/** Guru adalah wali kelas di sekolah konteks sesi saat ini. */
export const getGuruIsHomeroom = cache(
  async (userId: string, schoolId: string): Promise<boolean> => {
    const teacher = await prisma.teacher.findFirst({
      where: { userId, schoolId },
      select: { homeroomClasses: { select: { id: true }, take: 1 } },
    });
    return (teacher?.homeroomClasses.length ?? 0) > 0;
  },
);
