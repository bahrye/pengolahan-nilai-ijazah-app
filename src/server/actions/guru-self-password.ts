"use server";

import bcrypt from "bcryptjs";
import { z } from "zod";

import { prisma } from "@/lib/prisma";
import { requireUserSchoolId } from "@/server/session";

const changeSchema = z
  .object({
    currentPassword: z.string().min(1, "Sandi lama wajib diisi."),
    newPassword: z
      .string()
      .min(8, "Sandi baru minimal 8 karakter.")
      .max(128, "Sandi baru terlalu panjang."),
    confirmPassword: z.string().min(1, "Konfirmasi sandi wajib diisi."),
  })
  .refine((d) => d.newPassword === d.confirmPassword, {
    message: "Konfirmasi sandi tidak cocok.",
    path: ["confirmPassword"],
  });

export type ChangeGuruOwnPasswordInput = z.infer<typeof changeSchema>;

export async function changeGuruOwnPasswordAction(
  raw: ChangeGuruOwnPasswordInput,
): Promise<{ ok: true } | { ok: false; message: string; fieldErrors?: Record<string, string> }> {
  let data: ChangeGuruOwnPasswordInput;
  try {
    data = changeSchema.parse(raw);
  } catch (e) {
    if (e instanceof z.ZodError) {
      const fieldErrors: Record<string, string> = {};
      for (const iss of e.issues) {
        const k = iss.path[0];
        if (typeof k === "string" && !fieldErrors[k]) fieldErrors[k] = iss.message;
      }
      return {
        ok: false,
        message: e.issues[0]?.message ?? "Data tidak valid.",
        fieldErrors,
      };
    }
    return { ok: false, message: "Data tidak valid." };
  }

  try {
    const ctx = await requireUserSchoolId();
    if (ctx.role !== "GURU") {
      return { ok: false, message: "Hanya akun guru yang dapat mengubah sandi di sini." };
    }

    const user = await prisma.user.findUnique({
      where: { id: ctx.userId },
      select: { passwordHash: true },
    });
    if (!user?.passwordHash) {
      return {
        ok: false,
        message: "Akun ini tidak memakai sandi email. Hubungi administrator sekolah.",
      };
    }

    const match = await bcrypt.compare(data.currentPassword, user.passwordHash);
    if (!match) {
      return { ok: false, message: "Sandi lama salah.", fieldErrors: { currentPassword: "Sandi lama salah." } };
    }

    if (data.currentPassword === data.newPassword) {
      return {
        ok: false,
        message: "Sandi baru harus berbeda dari sandi lama.",
        fieldErrors: { newPassword: "Sandi baru harus berbeda dari sandi lama." },
      };
    }

    const passwordHash = await bcrypt.hash(data.newPassword, 12);

    await prisma.$transaction([
      prisma.user.update({
        where: { id: ctx.userId },
        data: { passwordHash },
      }),
      prisma.teacher.updateMany({
        where: { userId: ctx.userId },
        data: { lastPlainPassword: null, usesDefaultLoginPin: false },
      }),
    ]);

    return { ok: true };
  } catch (e) {
    return { ok: false, message: (e as Error).message };
  }
}
