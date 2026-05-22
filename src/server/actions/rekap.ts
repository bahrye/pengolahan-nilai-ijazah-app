"use server";

import type { RekapitulasiResult, RekapStudentRow } from "@/domain/rekapitulasi";
import { runRekapForSchool } from "@/lib/rekap-service";
import { getCachedFullRekapForSchool } from "@/lib/rekap-cache";
import { prisma } from "@/lib/prisma";
import { shouldMaskStudentIjazahRekap } from "@/lib/student-ijazah-visibility";
import { homeroomClassRoomIdsForGuruUser } from "@/server/guru-scope";
import { requireUserSchoolId } from "@/server/session";

export async function recomputeRekapitulasiAction(): Promise<
  | { ok: true; result: RekapitulasiResult; bobotUjian: number; bobotRapor: number }
  | { ok: false; message: string }
> {
  try {
    const { schoolId, role, userId } = await requireUserSchoolId();
    if (role === "SISWA") {
      return { ok: false, message: "Tidak diizinkan." };
    }

    let homeroomClassRoomIds: string[] | undefined;
    if (role === "GURU") {
      const ids = await homeroomClassRoomIdsForGuruUser(userId, schoolId);
      if (ids.length === 0) {
        return { ok: false, message: "Hanya wali kelas yang dapat menghitung rekap nilai ijazah." };
      }
      homeroomClassRoomIds = ids;
    }

    const grading = await prisma.schoolGradingConfig.findUnique({ where: { schoolId } });
    const bobotUjian = Number(grading?.bobotUjian ?? 40);
    const bobotRapor = Number(grading?.bobotRapor ?? 60);

    let computed;
    if (homeroomClassRoomIds && homeroomClassRoomIds.length > 0) {
      computed = await runRekapForSchool(schoolId, { homeroomClassRoomIds });
    } else {
      computed = await getCachedFullRekapForSchool(schoolId);
    }

    return {
      ok: true,
      result: JSON.parse(JSON.stringify(computed)) as RekapitulasiResult,
      bobotUjian,
      bobotRapor,
    };
  } catch (e) {
    return { ok: false, message: (e as Error).message };
  }
}

export async function studentRekapAction(): Promise<
  | { ok: true; row: RekapStudentRow | null; maskScores: boolean }
  | { ok: false; message: string }
> {
  try {
    const { userId, schoolId, role } = await requireUserSchoolId();
    if (role !== "SISWA") {
      return { ok: false, message: "Hanya untuk akun siswa." };
    }
    const [student, school] = await Promise.all([
      prisma.student.findFirst({
        where: { schoolId, userId },
        select: {
          id: true,
          nisn: true,
          graduationAnnouncementAckAt: true,
        },
      }),
      prisma.school.findUnique({
        where: { id: schoolId },
        select: {
          graduationAnnouncementAt: true,
          ijazahRekapVisibility: true,
        },
      }),
    ]);
    if (!student) {
      return { ok: false, message: "Profil siswa belum tertaut dengan akun ini." };
    }
    
    // Gunakan full cache agar 0 DB query!
    const full = await getCachedFullRekapForSchool(schoolId);
    const serialized = JSON.parse(JSON.stringify(full)) as RekapitulasiResult;
    const row = serialized.rowsIjazah.find(
      (r) => r.nisn === student.nisn.toString().trim()
    ) ?? null;

    const now = new Date();
    const maskScores = shouldMaskStudentIjazahRekap({
      graduationAnnouncementAt: school?.graduationAnnouncementAt ?? null,
      ijazahRekapVisibility: school?.ijazahRekapVisibility ?? "AFTER_CHECK_ANNOUNCEMENT",
      graduationAnnouncementAckAt: student.graduationAnnouncementAckAt,
      now,
    });
    return { ok: true, row, maskScores };
  } catch (e) {
    return { ok: false, message: (e as Error).message };
  }
}
