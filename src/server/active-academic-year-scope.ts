import type { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { defaultTenantDb, type TenantDb } from "@/server/tenant-db-context";

/** ID kelas pada tahun ajaran yang sedang aktif untuk sekolah ini. */
export async function classRoomIdsForActiveAcademicYear(
  schoolId: string,
  db: TenantDb = defaultTenantDb(),
): Promise<string[]> {
  const activeYear = await db.academicYear.findFirst({
    where: { schoolId, isActive: true },
    select: { id: true },
  });
  if (!activeYear) return [];
  const rooms = await db.classRoom.findMany({
    where: { schoolId, academicYearId: activeYear.id },
    select: { id: true },
  });
  return rooms.map((r) => r.id);
}

/**
 * Daftar siswa admin (master siswa): kelas yang termasuk TA aktif saja.
 * Tidak memfilter `Student.isActive` agar siswa dinonaktifkan tetap terlihat di kohort tersebut.
 */
export async function studentWhereAdminRosterActiveYear(
  schoolId: string,
  db: TenantDb = defaultTenantDb(),
): Promise<Prisma.StudentWhereInput> {
  const ids = await classRoomIdsForActiveAcademicYear(schoolId, db);
  if (ids.length === 0) {
    return { schoolId, id: { in: [] } };
  }
  return {
    schoolId,
    OR: [{ classRoomId: { in: ids } }, { classRoomId: null }],
  };
}

/**
 * Siswa yang ikut input/rekap pada TA aktif: kelas TA aktif + `Student.isActive`.
 */
export async function studentWhereParticipatingActiveYear(
  schoolId: string,
  db: TenantDb = defaultTenantDb(),
): Promise<Prisma.StudentWhereInput> {
  const ids = await classRoomIdsForActiveAcademicYear(schoolId, db);
  if (ids.length === 0) {
    return { schoolId, id: { in: [] } };
  }
  return {
    schoolId,
    isActive: true,
    classRoomId: { in: ids },
  };
}

/** Pastikan kelas (`ClassRoom`) milik tahun ajaran aktif sebelum menempelkan siswa. */
export async function assertClassRoomBelongsToActiveAcademicYear(
  schoolId: string,
  classRoomId: string | null | undefined,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const cid = typeof classRoomId === "string" ? classRoomId.trim() : "";
  if (!cid) {
    return { ok: false, message: "Pilih kelas pada tahun ajaran yang sedang aktif." };
  }
  const ids = await classRoomIdsForActiveAcademicYear(schoolId);
  if (ids.length === 0) {
    return {
      ok: false,
      message: "Belum ada tahun ajaran aktif atau belum ada kelas pada tahun tersebut.",
    };
  }
  if (!ids.includes(cid)) {
    return { ok: false, message: "Kelas tidak termasuk tahun ajaran yang sedang aktif." };
  }
  return { ok: true };
}
