import { cache } from "react";

import { auth } from "@/auth";

import type { UserRole } from "@prisma/client";

export const requireAuthStrict = cache(async () => {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");
  return session;
});

/** Admin sekolah / superadmin; `schoolId` boleh null saat onboarding (belum ada sekolah). */
export const requirePlatformSchoolAdmin = cache(async (): Promise<{
  userId: string;
  schoolId: string | null;
  role: UserRole;
}> => {
  const session = await requireAuthStrict();
  const role = session.user.role;
  if (role !== "ADMIN_SEKOLAH" && role !== "SUPERADMIN") {
    throw new Error("Butuh akses Administrator Sekolah.");
  }
  return {
    userId: session.user.id,
    schoolId: session.user.schoolId ?? null,
    role,
  };
});

/** Wajib sudah ada sekolah (multi-tenant). */
export const requireTenantAdmin = cache(async (): Promise<{
  userId: string;
  schoolId: string;
  role: UserRole;
}> => {
  const ctx = await requirePlatformSchoolAdmin();
  if (!ctx.schoolId) {
    throw new Error('Lengkapi "Data Sekolah" untuk mengaktifkan data master.');
  }
  return ctx as {
    userId: string;
    schoolId: string;
    role: UserRole;
  };
});

const GRADE_MUTATOR_ROLES: ReadonlySet<UserRole> = new Set([
  "GURU",
  "ADMIN_SEKOLAH",
  "SUPERADMIN",
]);

/** Guru atau admin sekolah — input / kunci nilai (bukan siswa). */
export const requireGradeMutator = cache(async (): Promise<{
  userId: string;
  schoolId: string;
  role: UserRole;
}> => {
  const ctx = await requireUserSchoolId();
  if (!GRADE_MUTATOR_ROLES.has(ctx.role)) {
    throw new Error("Tidak diizinkan mengubah nilai.");
  }
  return ctx;
});

/** Konteks sekolah untuk Guru / Siswa / admin yang beroperasi atas satu sekolah. */
export const requireUserSchoolId = cache(async (): Promise<{
  userId: string;
  schoolId: string;
  role: UserRole;
}> => {
  const session = await requireAuthStrict();
  const schoolId = session.user.schoolId;
  if (!schoolId) {
    throw new Error(
      "Sekolah belum ditetapkan — hubungi Administrator atau lengkapi data sekolah.",
    );
  }
  return {
    userId: session.user.id,
    schoolId,
    role: session.user.role,
  };
});

export const requireSuperadmin = cache(async () => {
  const session = await requireAuthStrict();
  if (session.user.role !== "SUPERADMIN") {
    throw new Error("Hanya Superadmin yang dapat melakukan aksi ini.");
  }
  return session;
});
