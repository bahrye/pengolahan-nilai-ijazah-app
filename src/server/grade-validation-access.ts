import type { Prisma } from "@prisma/client";

import { homeroomClassRoomIdsForGuruUser } from "@/server/guru-scope";
import { requireTenantAdmin, requireUserSchoolId } from "@/server/session";
import { studentWhereParticipatingActiveYear } from "@/server/active-academic-year-scope";

import type { UserRole } from "@prisma/client";

export type GradeValidationViewer = {
  userId: string;
  schoolId: string;
  role: UserRole;
  /** `null` = seluruh siswa aktif (admin); selain itu hanya kelas wali. */
  homeroomClassRoomIds: string[] | null;
};

/** Admin sekolah / superadmin, atau guru wali kelas. */
export async function requireGradeValidationViewer(): Promise<GradeValidationViewer> {
  try {
    const admin = await requireTenantAdmin();
    return {
      userId: admin.userId,
      schoolId: admin.schoolId,
      role: admin.role,
      homeroomClassRoomIds: null,
    };
  } catch {
    /* bukan admin tenant */
  }

  const ctx = await requireUserSchoolId();
  if (ctx.role !== "GURU") {
    throw new Error("Akses ditolak.");
  }

  const homeroomClassRoomIds = await homeroomClassRoomIdsForGuruUser(
    ctx.userId,
    ctx.schoolId,
  );
  if (homeroomClassRoomIds.length === 0) {
    throw new Error(
      "Hanya wali kelas yang dapat membuka Cek Validasi Nilai. Hubungi administrator jika Anda seharusnya ditetapkan sebagai wali kelas.",
    );
  }

  return {
    userId: ctx.userId,
    schoolId: ctx.schoolId,
    role: ctx.role,
    homeroomClassRoomIds,
  };
}

export async function studentWhereForGradeValidation(
  schoolId: string,
  homeroomClassRoomIds: string[] | null,
): Promise<Prisma.StudentWhereInput> {
  const base = await studentWhereParticipatingActiveYear(schoolId);
  if (!homeroomClassRoomIds?.length) return base;
  return {
    AND: [base, { classRoomId: { in: homeroomClassRoomIds } }],
  };
}
