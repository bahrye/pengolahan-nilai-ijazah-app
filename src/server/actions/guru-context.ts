"use server";

import { prisma } from "@/lib/prisma";
import { fetchGuruSchoolContextRowsForUser } from "@/server/guru-school-contexts";
import type { GuruSchoolContextRow } from "@/server/guru-school-contexts";
import { requireAuthStrict } from "@/server/session";

function effectiveContextSchoolId(opts: {
  schoolId: string | null;
  activeSchoolId: string | null;
}): string | null {
  return opts.activeSchoolId ?? opts.schoolId;
}

/** Daftar sekolah tempat guru punya baris Teacher (untuk pemilih konteks). */
export async function listGuruSchoolContextsAction(): Promise<GuruSchoolContextRow[]> {
  const session = await requireAuthStrict();
  const userId = session.user.id;
  if (session.user.role !== "GURU") return [];

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { schoolId: true, activeSchoolId: true },
  });
  if (!user?.schoolId) return [];

  return fetchGuruSchoolContextRowsForUser(userId, user.schoolId);
}

/**
 * Atur sekolah aktif untuk sesi guru (`User.activeSchoolId`).
 * `schoolId` harus punya baris Teacher untuk pengguna ini.
 */
export async function switchGuruActiveSchoolAction(
  schoolId: string | null,
): Promise<{ ok: true; contextSchoolId: string | null } | { ok: false; message: string }> {
  try {
    const session = await requireAuthStrict();
    if (session.user.role !== "GURU") {
      return { ok: false, message: "Hanya akun guru yang dapat mengganti konteks sekolah." };
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { id: true, schoolId: true, activeSchoolId: true },
    });
    if (!user?.schoolId) {
      return { ok: false, message: "Sekolah induk belum ditetapkan untuk akun ini." };
    }

    if (schoolId === null) {
      await prisma.user.update({
        where: { id: user.id },
        data: { activeSchoolId: null },
      });
      const refreshed = await prisma.user.findUnique({
        where: { id: user.id },
        select: { schoolId: true, activeSchoolId: true },
      });
      return {
        ok: true,
        contextSchoolId: effectiveContextSchoolId(
          refreshed ?? { schoolId: user.schoolId, activeSchoolId: null },
        ),
      };
    }

    const teacher = await prisma.teacher.findFirst({
      where: { userId: user.id, schoolId },
      select: { id: true },
    });
    if (!teacher) {
      return { ok: false, message: "Anda tidak memiliki penugasan di sekolah tersebut." };
    }

    await prisma.user.update({
      where: { id: user.id },
      data: { activeSchoolId: schoolId },
    });

    return { ok: true, contextSchoolId: schoolId };
  } catch (e) {
    return { ok: false, message: (e as Error).message };
  }
}
