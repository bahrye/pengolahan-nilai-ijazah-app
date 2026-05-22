"use server";

import { z } from "zod";

import { prisma } from "@/lib/prisma";
import { requireTenantAdmin } from "@/server/session";

const saveSchema = z.object({
  examInputPolicy: z.enum(["LOCKED", "OPEN", "LIMITED"]),
  examInputWindowStartIso: z.string().nullable(),
  examInputWindowEndIso: z.string().nullable(),
});

export async function saveExamInputSettingsAction(
  raw: unknown,
): Promise<{ ok: true } | { ok: false; message: string }> {
  try {
    const { schoolId } = await requireTenantAdmin();
    const parsed = saveSchema.safeParse(raw);
    if (!parsed.success) {
      return { ok: false, message: "Data tidak valid." };
    }
    const { examInputPolicy, examInputWindowStartIso, examInputWindowEndIso } = parsed.data;

    let examInputWindowStart: Date | null = null;
    let examInputWindowEnd: Date | null = null;
    if (examInputPolicy === "LIMITED") {
      if (!examInputWindowStartIso?.trim() || !examInputWindowEndIso?.trim()) {
        return {
          ok: false,
          message: "Mode Terbatas wajib diisi waktu mulai dan waktu selesai.",
        };
      }
      const a = new Date(examInputWindowStartIso);
      const b = new Date(examInputWindowEndIso);
      if (Number.isNaN(a.getTime()) || Number.isNaN(b.getTime())) {
        return { ok: false, message: "Tanggal atau waktu jendela tidak valid." };
      }
      if (a.getTime() >= b.getTime()) {
        return { ok: false, message: "Waktu selesai harus setelah waktu mulai." };
      }
      examInputWindowStart = a;
      examInputWindowEnd = b;
    }

    await prisma.school.update({
      where: { id: schoolId },
      data: {
        examInputPolicy,
        examInputWindowStart,
        examInputWindowEnd,
      },
    });
    return { ok: true };
  } catch (e) {
    return { ok: false, message: (e as Error).message };
  }
}
