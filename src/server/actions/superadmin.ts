"use server";

import type { UserRole } from "@prisma/client";
import { UserRole as UserRoleEnum } from "@prisma/client";
import { z } from "zod";

import { schoolLevelSchema } from "@/domain/school-levels";
import { SCORE_TYPE } from "@/domain/scoreTypes";
import {
  formatInstantInTimeZone,
  INDONESIA_WIB_TIME_ZONE,
} from "@/lib/indonesia-timezone";
import { prisma } from "@/lib/prisma";
import { requireSuperadmin } from "@/server/session";
import { runWithRlsBypass, type TenantDb } from "@/server/tenant-db-context";

import type { SchoolLevel } from "@prisma/client";

export type SuperadminSchoolListItem = {
  id: string;
  namaSekolah: string | null;
  schoolCode: string;
  jenjang: SchoolLevel | null;
  npsn: string | null;
  isActive: boolean;
  studentCount: number;
  classRoomCount: number;
  hasUjianGrade: boolean;
  hasRaporGrade: boolean;
  registeredAt: string;
  registeredAtLabel: string;
};

async function loadSchoolGradeFlags(
  db: TenantDb,
  schoolIds: string[],
): Promise<{ ujian: Set<string>; rapor: Set<string> }> {
  if (schoolIds.length === 0) {
    return { ujian: new Set(), rapor: new Set() };
  }

  const [ujianHits, raporHits] = await Promise.all([
    db.gradeEntry.findMany({
      where: {
        schoolId: { in: schoolIds },
        scoreType: { in: [SCORE_TYPE.UJIAN_MADRASAH, SCORE_TYPE.UJIAN_PRAKTEK] },
      },
      select: { schoolId: true },
      distinct: ["schoolId"],
    }),
    db.gradeEntry.findMany({
      where: {
        schoolId: { in: schoolIds },
        scoreType: { in: [SCORE_TYPE.PENGETAHUAN, SCORE_TYPE.KETERAMPILAN] },
      },
      select: { schoolId: true },
      distinct: ["schoolId"],
    }),
  ]);

  return {
    ujian: new Set(ujianHits.map((h) => h.schoolId)),
    rapor: new Set(raporHits.map((h) => h.schoolId)),
  };
}

export async function listSchoolsAction(
  activeOnly = true,
): Promise<SuperadminSchoolListItem[]> {
  await requireSuperadmin();
  return runWithRlsBypass(async (db) => {
    const rows = await db.school.findMany({
      where: activeOnly ? { isActive: true } : { isActive: false },
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        namaSekolah: true,
        schoolCode: true,
        jenjang: true,
        npsn: true,
        isActive: true,
        createdAt: true,
        _count: {
          select: {
            students: true,
            classRooms: true,
          },
        },
      },
    });

    const schoolIds = rows.map((r) => r.id);
    const gradeFlags = await loadSchoolGradeFlags(db, schoolIds);

    return rows.map((r) => ({
      id: r.id,
      namaSekolah: r.namaSekolah,
      schoolCode: r.schoolCode,
      jenjang: r.jenjang,
      npsn: r.npsn,
      isActive: r.isActive,
      studentCount: r._count.students,
      classRoomCount: r._count.classRooms,
      hasUjianGrade: gradeFlags.ujian.has(r.id),
      hasRaporGrade: gradeFlags.rapor.has(r.id),
      registeredAt: r.createdAt.toISOString(),
      registeredAtLabel: formatInstantInTimeZone(r.createdAt, INDONESIA_WIB_TIME_ZONE),
    }));
  });
}

const createSchool = z.object({
  namaSekolah: z.string().min(1),
  jenjang: schoolLevelSchema.optional(),
});

export async function createSchoolSuperadminAction(
  raw: z.infer<typeof createSchool>,
): Promise<{ ok: true; id: string } | { ok: false; message: string }> {
  let data: z.infer<typeof createSchool>;
  try {
    data = createSchool.parse(raw);
  } catch {
    return { ok: false, message: "Data tidak valid." };
  }
  try {
    await requireSuperadmin();
    const s = await prisma.school.create({
      data: {
        namaSekolah: data.namaSekolah.trim(),
        jenjang: data.jenjang ?? "MTS",
        raporSemesterCount: 5,
        isSatminkal: true,
      },
    });
    await prisma.schoolGradingConfig.create({ data: { schoolId: s.id } });
    await prisma.schoolSubscription.create({ data: { schoolId: s.id } });
    return { ok: true, id: s.id };
  } catch (e) {
    return { ok: false, message: (e as Error).message };
  }
}

const assignUser = z.object({
  email: z.string().email(),
  schoolId: z.string().min(1).nullable(),
  role: z.nativeEnum(UserRoleEnum),
});

export async function assignUserSchoolAction(
  raw: z.infer<typeof assignUser>,
): Promise<{ ok: true } | { ok: false; message: string }> {
  let data: z.infer<typeof assignUser>;
  try {
    data = assignUser.parse(raw);
  } catch {
    return { ok: false, message: "Data tidak valid." };
  }
  try {
    await requireSuperadmin();
    const user = await prisma.user.findUnique({
      where: { email: data.email.trim().toLowerCase() },
    });
    if (!user) {
      return {
        ok: false,
        message: "Pengguna belum pernah login — minta pengguna login Google terlebih dahulu.",
      };
    }
    await prisma.user.update({
      where: { id: user.id },
      data: {
        schoolId: data.schoolId,
        role: data.role as UserRole,
      },
    });
    return { ok: true };
  } catch (e) {
    return { ok: false, message: (e as Error).message };
  }
}

const schoolActiveSchema = z.object({
  schoolId: z.string().min(1),
  isActive: z.boolean(),
});

export async function setSchoolActiveFlagAction(
  raw: z.infer<typeof schoolActiveSchema>,
): Promise<{ ok: true } | { ok: false; message: string }> {
  let data: z.infer<typeof schoolActiveSchema>;
  try {
    data = schoolActiveSchema.parse(raw);
  } catch {
    return { ok: false, message: "Data tidak valid." };
  }
  try {
    await requireSuperadmin();
    await prisma.school.update({
      where: { id: data.schoolId },
      data: { isActive: data.isActive },
    });
    return { ok: true };
  } catch (e) {
    return { ok: false, message: (e as Error).message };
  }
}
