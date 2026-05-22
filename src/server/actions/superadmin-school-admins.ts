"use server";

import bcrypt from "bcryptjs";
import { z } from "zod";

import { prisma } from "@/lib/prisma";
import { requireSuperadmin } from "@/server/session";

export type SchoolAdminAccountRow = {
  id: string;
  email: string;
  name: string | null;
  isActive: boolean;
  hasPassword: boolean;
  createdAt: string;
};

async function assertSchoolAdminUser(userId: string, schoolId: string) {
  const user = await prisma.user.findFirst({
    where: {
      id: userId,
      schoolId,
      role: "ADMIN_SEKOLAH",
    },
    select: { id: true, email: true },
  });
  if (!user) {
    throw new Error("Akun administrator sekolah tidak ditemukan untuk sekolah ini.");
  }
  return user;
}

export async function listSchoolAdminAccountsAction(
  schoolId: string,
): Promise<SchoolAdminAccountRow[]> {
  await requireSuperadmin();
  const id = z.string().min(1).parse(schoolId);

  const school = await prisma.school.findUnique({
    where: { id },
    select: { id: true },
  });
  if (!school) {
    throw new Error("Sekolah tidak ditemukan.");
  }

  const users = await prisma.user.findMany({
    where: { schoolId: id, role: "ADMIN_SEKOLAH" },
    orderBy: [{ isActive: "desc" }, { createdAt: "asc" }],
    select: {
      id: true,
      email: true,
      name: true,
      isActive: true,
      passwordHash: true,
      createdAt: true,
    },
  });

  return users.map((u) => ({
    id: u.id,
    email: u.email,
    name: u.name,
    isActive: u.isActive,
    hasPassword: Boolean(u.passwordHash),
    createdAt: u.createdAt.toISOString(),
  }));
}

const userIdSchema = z.object({
  userId: z.string().min(1),
  schoolId: z.string().min(1),
});

export async function setSchoolAdminActiveAction(
  raw: z.infer<typeof userIdSchema> & { isActive: boolean },
): Promise<{ ok: true } | { ok: false; message: string }> {
  try {
    const data = userIdSchema.extend({ isActive: z.boolean() }).parse(raw);
    await requireSuperadmin();
    await assertSchoolAdminUser(data.userId, data.schoolId);

    if (data.isActive) {
      await prisma.$transaction([
        prisma.user.updateMany({
          where: {
            schoolId: data.schoolId,
            role: "ADMIN_SEKOLAH",
            id: { not: data.userId },
          },
          data: { isActive: false },
        }),
        prisma.user.update({
          where: { id: data.userId },
          data: { isActive: true },
        }),
      ]);
    } else {
      await prisma.user.update({
        where: { id: data.userId },
        data: { isActive: false },
      });
    }

    return { ok: true };
  } catch (e) {
    return { ok: false, message: (e as Error).message };
  }
}

export async function deleteSchoolAdminAccountAction(
  raw: z.infer<typeof userIdSchema>,
): Promise<{ ok: true } | { ok: false; message: string }> {
  try {
    const data = userIdSchema.parse(raw);
    const session = await requireSuperadmin();
    await assertSchoolAdminUser(data.userId, data.schoolId);

    if (data.userId === session.user.id) {
      return { ok: false, message: "Tidak dapat menghapus akun Anda sendiri." };
    }

    const target = await prisma.user.findUnique({
      where: { id: data.userId },
      select: { isActive: true },
    });
    if (target?.isActive) {
      const activeCount = await prisma.user.count({
        where: { schoolId: data.schoolId, role: "ADMIN_SEKOLAH", isActive: true },
      });
      if (activeCount <= 1) {
        return {
          ok: false,
          message:
            "Tidak dapat menghapus satu-satunya administrator aktif. Nonaktifkan dulu atau aktifkan admin lain.",
        };
      }
    }

    await prisma.user.delete({ where: { id: data.userId } });
    return { ok: true };
  } catch (e) {
    return { ok: false, message: (e as Error).message };
  }
}

const passwordSchema = z
  .object({
    userId: z.string().min(1),
    schoolId: z.string().min(1),
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

export async function superadminSetSchoolAdminPasswordAction(
  raw: z.infer<typeof passwordSchema>,
): Promise<{ ok: true } | { ok: false; message: string }> {
  try {
    const data = passwordSchema.parse(raw);
    await requireSuperadmin();
    await assertSchoolAdminUser(data.userId, data.schoolId);

    const passwordHash = await bcrypt.hash(data.newPassword, 12);
    await prisma.user.update({
      where: { id: data.userId },
      data: { passwordHash },
    });
    return { ok: true };
  } catch (e) {
    if (e instanceof z.ZodError) {
      return { ok: false, message: e.issues[0]?.message ?? "Data tidak valid." };
    }
    return { ok: false, message: (e as Error).message };
  }
}
