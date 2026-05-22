"use server";

import { z } from "zod";

import { prisma } from "@/lib/prisma";
import { requireTenantAdmin } from "@/server/session";

const assignSchema = z.object({
  teacherId: z.string(),
  subjectId: z.string(),
  classRoomId: z.string(),
});

export async function createTeachingAssignmentAction(
  raw: z.infer<typeof assignSchema>,
): Promise<{ ok: true } | { ok: false; message: string }> {
  let data: z.infer<typeof assignSchema>;
  try {
    data = assignSchema.parse(raw);
  } catch {
    return { ok: false, message: "Data tidak valid." };
  }
  try {
    const { schoolId } = await requireTenantAdmin();
    const [teacher, subject, classRoom] = await Promise.all([
      prisma.teacher.findFirst({
        where: { id: data.teacherId, schoolId },
        select: { id: true },
      }),
      prisma.subject.findFirst({
        where: { id: data.subjectId, schoolId },
        select: { id: true },
      }),
      prisma.classRoom.findFirst({
        where: { id: data.classRoomId, schoolId },
        select: { id: true },
      }),
    ]);
    if (!teacher || !subject || !classRoom) {
      return {
        ok: false,
        message: "Guru, mapel, atau kelas tidak ditemukan di sekolah Anda.",
      };
    }
    await prisma.teachingAssignment.create({
      data: {
        schoolId,
        teacherId: data.teacherId,
        subjectId: data.subjectId,
        classRoomId: data.classRoomId,
      },
    });
    return { ok: true };
  } catch (e) {
    return {
      ok: false,
      message:
        e instanceof Error
          ? e.message
          : "Gagal (kombinasi mungkin sudah ada atau data tidak konsisten).",
    };
  }
}

export async function deleteTeachingAssignmentAction(id: string) {
  const { schoolId } = await requireTenantAdmin();
  await prisma.teachingAssignment.deleteMany({ where: { id, schoolId } });
  return { ok: true as const };
}
