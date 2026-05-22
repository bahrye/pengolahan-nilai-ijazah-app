"use server";

import { z } from "zod";

import { prisma } from "@/lib/prisma";
import { requireSuperadmin } from "@/server/session";

const schoolIdSchema = z.object({
  schoolId: z.string().min(1),
});

export async function enterSuperadminSchoolAction(
  raw: z.infer<typeof schoolIdSchema>,
): Promise<
  | { ok: true; schoolName: string | null }
  | { ok: false; message: string }
> {
  let data: z.infer<typeof schoolIdSchema>;
  try {
    data = schoolIdSchema.parse(raw);
  } catch {
    return { ok: false, message: "Data tidak valid." };
  }

  try {
    const session = await requireSuperadmin();
    const school = await prisma.school.findFirst({
      where: { id: data.schoolId, isActive: true },
      select: { id: true, namaSekolah: true },
    });
    if (!school) {
      return {
        ok: false,
        message: "Sekolah tidak ditemukan atau sudah dinonaktifkan.",
      };
    }

    await prisma.user.update({
      where: { id: session.user.id },
      data: { activeSchoolId: school.id },
    });

    return { ok: true, schoolName: school.namaSekolah };
  } catch (e) {
    return { ok: false, message: (e as Error).message };
  }
}

export async function exitSuperadminSchoolAction(): Promise<
  { ok: true } | { ok: false; message: string }
> {
  try {
    const session = await requireSuperadmin();
    await prisma.user.update({
      where: { id: session.user.id },
      data: { activeSchoolId: null },
    });
    return { ok: true };
  } catch (e) {
    return { ok: false, message: (e as Error).message };
  }
}
