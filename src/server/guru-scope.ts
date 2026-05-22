import { prisma } from "@/lib/prisma";
import { classRoomIdsForActiveAcademicYear } from "@/server/active-academic-year-scope";
import { defaultTenantDb, type TenantDb } from "@/server/tenant-db-context";

import type { UserRole } from "@prisma/client";

/**
 * Daftar kombinasi (subjectId, classRoomId) yang boleh di-edit guru.
 * Admin/Superadmin boleh semua kombinasi (null = tidak difilter).
 *
 * context:
 * - "rapor": Wali kelas mendapat akses semua mapel untuk kelas homeroom.
 * - "ujian": Semua guru (termasuk wali kelas) hanya mapel yang diajar.
 */
export async function allowedGradeTargetsForRole(opts: {
  schoolId: string;
  userId: string;
  role: UserRole;
  context?: "rapor" | "ujian";
  db?: TenantDb;
}): Promise<Set<string> | null> {
  const { schoolId, userId, role, context = "ujian", db = defaultTenantDb() } = opts;
  if (role === "ADMIN_SEKOLAH" || role === "SUPERADMIN") return null;
  if (role !== "GURU") throw new Error("Peran tidak mendukung input nilai.");

  const teacher = await db.teacher.findFirst({
    where: { schoolId, userId },
    include: {
      assignments: true,
      homeroomClasses: { select: { id: true } },
    },
  });

  const activeClassIds = await classRoomIdsForActiveAcademicYear(schoolId, db);
  const activeSet = new Set(activeClassIds);

  const out = new Set<string>();

  // Wali kelas + rapor context: full access to all subjects for homeroom classes
  if (context === "rapor" && teacher?.homeroomClasses.length) {
    const allSubjects = await db.subject.findMany({
      where: { schoolId },
      select: { id: true },
    });
    for (const cls of teacher.homeroomClasses) {
      if (!activeSet.has(cls.id)) continue;
      for (const sub of allSubjects) {
        out.add(`${sub.id}|${cls.id}`);
      }
    }
  }

  // Teaching assignments: access specific subjects in specific classes
  if (teacher?.assignments.length) {
    for (const a of teacher.assignments) {
      if (!activeSet.has(a.classRoomId)) continue;
      out.add(`${a.subjectId}|${a.classRoomId}`);
    }
  }

  return out;
}

/** ID kelas di mana pengguna adalah wali kelas; kosong jika bukan guru / bukan wali. */
export async function homeroomClassRoomIdsForGuruUser(
  userId: string,
  schoolId: string,
  db: TenantDb = defaultTenantDb(),
): Promise<string[]> {
  const teacher = await db.teacher.findFirst({
    where: { schoolId, userId },
    include: { homeroomClasses: { select: { id: true } } },
  });
  const raw = teacher?.homeroomClasses.map((c) => c.id) ?? [];
  const activeSet = new Set(await classRoomIdsForActiveAcademicYear(schoolId, db));
  return raw.filter((id) => activeSet.has(id));
}
