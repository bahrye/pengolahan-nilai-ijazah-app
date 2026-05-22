"use server";

import { z } from "zod";

import type { RekapitulasiResult } from "@/domain/rekapitulasi";
import { freeTierDummyAnnouncementAt } from "@/lib/free-pengumuman-schedule";
import { normalizeTimeZone } from "@/lib/indonesia-timezone";
import { prisma } from "@/lib/prisma";
import { hasPremiumMenuAccess } from "@/lib/subscription/premium-access";
import { runRekapForSchool } from "@/lib/rekap-service";
import { getSchoolAccessSnapshot } from "@/server/subscription-access";
import { requireTenantAdmin, requireUserSchoolId } from "@/server/session";
import { getCachedFullRekapForSchool } from "@/lib/rekap-cache";

const adminPreviewSyncSchema = z.object({
  clientTimeZone: z.string().optional(),
});

/** Pratinjau jadwal pengumuman untuk admin sekolah (tanpa data siswa). */
export async function pengumumanAdminPreviewSyncAction(
  raw?: unknown,
): Promise<
  | {
      ok: true;
      serverNowIso: string;
      announcementAtIso: string | null;
      /** Jadwal contoh (besok 10:00 waktu lokal) untuk sekolah tanpa langganan premium. */
      isDummySchedule?: boolean;
      /** Zona waktu yang dipakai menghitung jadwal contoh. */
      scheduleTimeZone?: string;
    }
  | { ok: false; message: string }
> {
  try {
    const { schoolId } = await requireTenantAdmin();
    const serverNow = new Date();
    const [school, access] = await Promise.all([
      prisma.school.findUnique({
        where: { id: schoolId },
        select: { graduationAnnouncementAt: true },
      }),
      getSchoolAccessSnapshot(schoolId),
    ]);

    if (!hasPremiumMenuAccess(access)) {
      const parsed = adminPreviewSyncSchema.safeParse(raw ?? {});
      const scheduleTimeZone = normalizeTimeZone(
        parsed.success ? parsed.data.clientTimeZone : undefined,
      );
      const dummyAt = freeTierDummyAnnouncementAt(serverNow, scheduleTimeZone);
      return {
        ok: true,
        serverNowIso: serverNow.toISOString(),
        announcementAtIso: dummyAt.toISOString(),
        isDummySchedule: true,
        scheduleTimeZone,
      };
    }

    return {
      ok: true,
      serverNowIso: serverNow.toISOString(),
      announcementAtIso: school?.graduationAnnouncementAt?.toISOString() ?? null,
      isDummySchedule: false,
    };
  } catch (e) {
    return { ok: false, message: (e as Error).message };
  }
}

export async function pengumumanSiswaSyncAction(): Promise<
  | {
      ok: true;
      serverNowIso: string;
      announcementAtIso: string | null;
      hasAck: boolean;
    }
  | { ok: false; message: string }
> {
  try {
    const { userId, schoolId, role } = await requireUserSchoolId();
    if (role !== "SISWA") {
      return { ok: false, message: "Halaman ini hanya untuk akun siswa." };
    }
    const serverNow = new Date();
    const [student, school] = await Promise.all([
      prisma.student.findFirst({
        where: { schoolId, userId },
        select: { graduationAnnouncementAckAt: true },
      }),
      prisma.school.findUnique({
        where: { id: schoolId },
        select: { graduationAnnouncementAt: true },
      }),
    ]);
    if (!student) {
      return { ok: false, message: "Profil siswa belum tertaut dengan akun ini." };
    }
    return {
      ok: true,
      serverNowIso: serverNow.toISOString(),
      announcementAtIso: school?.graduationAnnouncementAt?.toISOString() ?? null,
      hasAck: student.graduationAnnouncementAckAt != null,
    };
  } catch (e) {
    return { ok: false, message: (e as Error).message };
  }
}

export async function pengumumanSiswaAmbilStatusKelulusanAction(): Promise<
  | {
      ok: true;
      kelulusan: "LULUS" | "TIDAK LULUS";
      rataRataDisplay: string;
    }
  | { ok: false; message: string }
> {
  try {
    const { userId, schoolId, role } = await requireUserSchoolId();
    if (role !== "SISWA") {
      return { ok: false, message: "Halaman ini hanya untuk akun siswa." };
    }
    const student = await prisma.student.findFirst({
      where: { schoolId, userId },
      select: {
        nisn: true,
        graduationAnnouncementAckAt: true,
      },
    });
    if (!student?.graduationAnnouncementAckAt) {
      return { ok: false, message: "Anda belum mengecek pengumuman kelulusan." };
    }
    const school = await prisma.school.findUnique({
      where: { id: schoolId },
      select: { graduationAnnouncementAt: true },
    });
    if (!school?.graduationAnnouncementAt) {
      return { ok: false, message: "Jadwal pengumuman tidak tersedia." };
    }
    const now = new Date();
    if (now.getTime() < school.graduationAnnouncementAt.getTime()) {
      return { ok: false, message: "Pengumuman belum dibuka." };
    }

    const full = await getCachedFullRekapForSchool(schoolId);
    const serialized = JSON.parse(JSON.stringify(full)) as RekapitulasiResult;
    const row = serialized.rowsIjazah.find(
      (r) => r.nisn === student.nisn.toString().trim(),
    );
    const status = row?.status;
    if (!row || (status !== "LULUS" && status !== "TIDAK LULUS")) {
      return {
        ok: false,
        message:
          "Status kelulusan belum dapat ditentukan. Pastikan data nilai dan mata pelajaran sudah lengkap.",
      };
    }
    return {
      ok: true,
      kelulusan: status,
      rataRataDisplay: row.rataRataDisplay,
    };
  } catch (e) {
    return { ok: false, message: (e as Error).message };
  }
}

export async function pengumumanSiswaSelesaiCekKelulusanAction(): Promise<
  | {
      ok: true;
      kelulusan: "LULUS" | "TIDAK LULUS";
      rataRataDisplay: string;
    }
  | { ok: false; message: string }
> {
  try {
    const { userId, schoolId, role } = await requireUserSchoolId();
    if (role !== "SISWA") {
      return { ok: false, message: "Halaman ini hanya untuk akun siswa." };
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
        select: { graduationAnnouncementAt: true },
      }),
    ]);
    if (!student) {
      return { ok: false, message: "Profil siswa belum tertaut dengan akun ini." };
    }
    if (!school?.graduationAnnouncementAt) {
      return { ok: false, message: "Jadwal pengumuman belum diatur oleh sekolah." };
    }
    const now = new Date();
    if (now.getTime() < school.graduationAnnouncementAt.getTime()) {
      return { ok: false, message: "Pengumuman belum dibuka. Tunggu hingga waktu yang ditetapkan." };
    }

    const ackAt = student.graduationAnnouncementAckAt ?? now;
    await prisma.student.update({
      where: { id: student.id },
      data: { graduationAnnouncementAckAt: ackAt },
    });

    const full = await getCachedFullRekapForSchool(schoolId);
    const serialized = JSON.parse(JSON.stringify(full)) as RekapitulasiResult;
    const row = serialized.rowsIjazah.find(
      (r) => r.nisn === student.nisn.toString().trim(),
    );
    const status = row?.status;
    if (!row || (status !== "LULUS" && status !== "TIDAK LULUS")) {
      return {
        ok: false,
        message:
          "Status kelulusan belum dapat ditentukan. Pastikan data nilai dan mata pelajaran sudah lengkap.",
      };
    }
    return {
      ok: true,
      kelulusan: status,
      rataRataDisplay: row.rataRataDisplay,
    };
  } catch (e) {
    return { ok: false, message: (e as Error).message };
  }
}
