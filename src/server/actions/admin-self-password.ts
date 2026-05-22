"use server";

import bcrypt from "bcryptjs";
import { z } from "zod";

import { prisma } from "@/lib/prisma";
import { requirePlatformSchoolAdmin } from "@/server/session";

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

export type ChangeAdminOwnPasswordInput = z.infer<typeof changeSchema>;

export async function changeAdminOwnPasswordAction(
  raw: ChangeAdminOwnPasswordInput,
): Promise<{ ok: true } | { ok: false; message: string }> {
  let data: ChangeAdminOwnPasswordInput;
  try {
    data = changeSchema.parse(raw);
  } catch (e) {
    if (e instanceof z.ZodError) {
      return { ok: false, message: e.issues[0]?.message ?? "Data tidak valid." };
    }
    return { ok: false, message: "Data tidak valid." };
  }

  try {
    const ctx = await requirePlatformSchoolAdmin();
    if (ctx.role !== "ADMIN_SEKOLAH") {
      return { ok: false, message: "Hanya Administrator Sekolah yang dapat mengubah sandi di sini." };
    }

    const user = await prisma.user.findUnique({
      where: { id: ctx.userId },
      select: { passwordHash: true },
    });
    if (!user?.passwordHash) {
      return {
        ok: false,
        message:
          "Akun ini tidak memakai sandi email (mis. hanya Google). Hubungi pengelola sistem jika perlu bantuan.",
      };
    }

    const match = await bcrypt.compare(data.currentPassword, user.passwordHash);
    if (!match) {
      return { ok: false, message: "Sandi lama salah." };
    }

    if (data.currentPassword === data.newPassword) {
      return { ok: false, message: "Sandi baru harus berbeda dari sandi lama." };
    }

    const passwordHash = await bcrypt.hash(data.newPassword, 12);
    await prisma.user.update({
      where: { id: ctx.userId },
      data: { passwordHash },
    });

    return { ok: true };
  } catch (e) {
    return { ok: false, message: (e as Error).message };
  }
}
