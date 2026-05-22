"use server";

import { z } from "zod";

import { prisma } from "@/lib/prisma";
import { cancelTugasTambahanRequestsForPengajarOnHost } from "@/server/guru-tugas-request-sync";
import { requireTenantAdmin } from "@/server/session";

function counterpartySchoolIdForRequest(r: {
  initiatedBySchoolId: string;
  homeTeacher: { schoolId: string };
  hostSchoolId: string;
}): string {
  return r.initiatedBySchoolId === r.homeTeacher.schoolId ? r.hostSchoolId : r.homeTeacher.schoolId;
}

export async function searchSchoolsByNpsnAction(
  npsnRaw: string,
): Promise<{ id: string; namaSekolah: string | null; npsn: string | null }[]> {
  const { schoolId } = await requireTenantAdmin();
  const npsn = npsnRaw.replace(/\D/g, "");
  if (npsn.length < 4) return [];

  const rows = await prisma.school.findMany({
    where: {
      npsn: { contains: npsn },
      NOT: { id: schoolId },
    },
    select: { id: true, namaSekolah: true, npsn: true },
    orderBy: { namaSekolah: "asc" },
    take: 25,
  });
  return rows;
}

const createSchema = z.object({
  homeTeacherId: z.string().min(1),
  hostSchoolId: z.string().min(1),
});

export async function createGuruTugasTambahanRequestAction(
  raw: z.infer<typeof createSchema>,
): Promise<{ ok: true; id: string } | { ok: false; message: string }> {
  let data: z.infer<typeof createSchema>;
  try {
    data = createSchema.parse(raw);
  } catch {
    return { ok: false, message: "Data tidak valid." };
  }

  try {
    const { schoolId, userId } = await requireTenantAdmin();

    const homeTeacher = await prisma.teacher.findUnique({
      where: { id: data.homeTeacherId },
      include: { school: { select: { id: true, isSatminkal: true, namaSekolah: true } } },
    });
    if (!homeTeacher) return { ok: false, message: "Guru induk tidak ditemukan." };
    if (!homeTeacher.school.isSatminkal) {
      return {
        ok: false,
        message: `Guru induk harus terdaftar di sekolah satminkal. Sekolah asal guru (${homeTeacher.school.namaSekolah ?? homeTeacher.schoolId}) bukan satminkal.`,
      };
    }

    const host = await prisma.school.findUnique({
      where: { id: data.hostSchoolId },
      select: { id: true, namaSekolah: true },
    });
    if (!host) return { ok: false, message: "Sekolah tujuan tidak ditemukan." };

    if (homeTeacher.schoolId === data.hostSchoolId) {
      return { ok: false, message: "Sekolah tujuan harus berbeda dari sekolah induk guru." };
    }

    const initiatorIsHomeSatminkal = schoolId === homeTeacher.schoolId;
    const initiatorIsHostSchool = schoolId === data.hostSchoolId;

    if (!initiatorIsHomeSatminkal && !initiatorIsHostSchool) {
      return {
        ok: false,
        message: "Permohonan harus diajukan dari sekolah induk guru (satminkal) atau dari sekolah tujuan tugas.",
      };
    }

    if (initiatorIsHomeSatminkal && data.hostSchoolId === schoolId) {
      return { ok: false, message: "Sekolah tujuan harus berbeda dari sekolah induk (satminkal) Anda." };
    }

    if (initiatorIsHostSchool) {
      if (data.hostSchoolId !== schoolId) {
        return { ok: false, message: "Sekolah tujuan tugas harus sekolah Anda sendiri." };
      }
      if (homeTeacher.schoolId === schoolId) {
        return {
          ok: false,
          message: "Guru induk harus berasal dari sekolah satminkal lain (bukan sekolah Anda).",
        };
      }
    }

    const existingTeacherAtHost = await prisma.teacher.findFirst({
      where: { userId: homeTeacher.userId, schoolId: data.hostSchoolId },
      select: { id: true },
    });
    if (existingTeacherAtHost) {
      return { ok: false, message: "Guru ini sudah memiliki tugas di sekolah tujuan." };
    }

    const pending = await prisma.guruTugasTambahanRequest.findFirst({
      where: {
        homeTeacherId: homeTeacher.id,
        hostSchoolId: data.hostSchoolId,
        status: "PENDING",
      },
      select: { id: true },
    });
    if (pending) {
      return { ok: false, message: "Sudah ada permohonan tertunda untuk kombinasi guru dan sekolah ini." };
    }

    const row = await prisma.guruTugasTambahanRequest.create({
      data: {
        homeTeacherId: homeTeacher.id,
        hostSchoolId: data.hostSchoolId,
        initiatedByUserId: userId,
        initiatedBySchoolId: schoolId,
        status: "PENDING",
      },
      select: { id: true },
    });

    return { ok: true, id: row.id };
  } catch (e) {
    return { ok: false, message: (e as Error).message };
  }
}

export async function listGuruTugasTambahanPendingForMeAction() {
  const { schoolId } = await requireTenantAdmin();
  const rows = await prisma.guruTugasTambahanRequest.findMany({
    where: {
      status: "PENDING",
      OR: [{ hostSchoolId: schoolId }, { homeTeacher: { schoolId } }],
    },
    include: {
      homeTeacher: {
        include: {
          user: { select: { email: true } },
          school: { select: { namaSekolah: true, npsn: true } },
        },
      },
      hostSchool: { select: { namaSekolah: true, npsn: true } },
      initiatedBy: { select: { name: true, email: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return rows
    .filter((r) => counterpartySchoolIdForRequest(r) === schoolId)
    .map((r) => ({
      id: r.id,
      createdAt: r.createdAt.toISOString(),
      homeTeacher: {
        id: r.homeTeacher.id,
        nama: r.homeTeacher.nama,
        nip: r.homeTeacher.nip,
        email: r.homeTeacher.user.email,
        schoolNama: r.homeTeacher.school.namaSekolah,
        schoolNpsn: r.homeTeacher.school.npsn,
      },
      hostSchool: {
        nama: r.hostSchool.namaSekolah,
        npsn: r.hostSchool.npsn,
      },
      initiatedBySchoolId: r.initiatedBySchoolId,
      initiatedBy: {
        name: r.initiatedBy.name,
        email: r.initiatedBy.email,
      },
    }));
}

export async function listGuruTugasTambahanMineAction() {
  const { schoolId } = await requireTenantAdmin();
  return prisma.guruTugasTambahanRequest.findMany({
    where: { initiatedBySchoolId: schoolId },
    include: {
      homeTeacher: {
        include: {
          user: { select: { email: true } },
          school: { select: { namaSekolah: true, npsn: true } },
        },
      },
      hostSchool: { select: { namaSekolah: true, npsn: true, isSatminkal: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 80,
  });
}

const decideSchema = z.object({
  requestId: z.string().min(1),
  approve: z.boolean(),
  rejectReason: z.string().optional().nullable(),
});

export async function decideGuruTugasTambahanRequestAction(
  raw: z.infer<typeof decideSchema>,
): Promise<{ ok: true } | { ok: false; message: string }> {
  let data: z.infer<typeof decideSchema>;
  try {
    data = decideSchema.parse(raw);
  } catch {
    return { ok: false, message: "Data tidak valid." };
  }

  try {
    const { schoolId, userId } = await requireTenantAdmin();

    const reqRow = await prisma.guruTugasTambahanRequest.findUnique({
      where: { id: data.requestId },
      include: {
        homeTeacher: {
          include: { school: { select: { id: true, isSatminkal: true } }, user: true },
        },
      },
    });
    if (!reqRow) return { ok: false, message: "Permohonan tidak ditemukan." };
    if (reqRow.status !== "PENDING") return { ok: false, message: "Permohonan sudah diproses." };

    const counterpartyId = counterpartySchoolIdForRequest(reqRow);
    if (counterpartyId !== schoolId) {
      return { ok: false, message: "Anda bukan pihak yang berwenang menyetujui permohonan ini." };
    }

    if (!reqRow.homeTeacher.school.isSatminkal) {
      return { ok: false, message: "Guru induk tidak lagi di sekolah satminkal — permohonan tidak valid." };
    }

    if (!data.approve) {
      const reason = (data.rejectReason ?? "").trim();
      if (!reason) return { ok: false, message: "Alasan penolakan wajib diisi." };
      await prisma.guruTugasTambahanRequest.update({
        where: { id: reqRow.id },
        data: {
          status: "REJECTED",
          decidedByUserId: userId,
          decidedBySchoolId: schoolId,
          decidedAt: new Date(),
          rejectReason: reason,
        },
      });
      return { ok: true };
    }

    const existing = await prisma.teacher.findFirst({
      where: { userId: reqRow.homeTeacher.userId, schoolId: reqRow.hostSchoolId },
    });
    if (existing) {
      await prisma.guruTugasTambahanRequest.update({
        where: { id: reqRow.id },
        data: {
          status: "APPROVED",
          decidedByUserId: userId,
          decidedBySchoolId: schoolId,
          decidedAt: new Date(),
        },
      });
      return { ok: true };
    }

    await prisma.$transaction(async (tx) => {
      await tx.teacher.create({
        data: {
          schoolId: reqRow.hostSchoolId,
          userId: reqRow.homeTeacher.userId,
          nama: reqRow.homeTeacher.nama,
          nip: reqRow.homeTeacher.nip,
        },
      });
      await tx.guruTugasTambahanRequest.update({
        where: { id: reqRow.id },
        data: {
          status: "APPROVED",
          decidedByUserId: userId,
          decidedBySchoolId: schoolId,
          decidedAt: new Date(),
        },
      });
    });

    return { ok: true };
  } catch (e) {
    return { ok: false, message: (e as Error).message };
  }
}

const cancelSchema = z.object({ requestId: z.string().min(1) });

export async function cancelGuruTugasTambahanRequestAction(
  raw: z.infer<typeof cancelSchema>,
): Promise<{ ok: true } | { ok: false; message: string }> {
  let data: z.infer<typeof cancelSchema>;
  try {
    data = cancelSchema.parse(raw);
  } catch {
    return { ok: false, message: "Data tidak valid." };
  }
  try {
    const { schoolId, userId } = await requireTenantAdmin();
    const row = await prisma.guruTugasTambahanRequest.findUnique({
      where: { id: data.requestId },
    });
    if (!row) return { ok: false, message: "Permohonan tidak ditemukan." };
    if (row.status !== "PENDING") return { ok: false, message: "Permohonan sudah tidak bisa dibatalkan." };
    if (row.initiatedBySchoolId !== schoolId) {
      return { ok: false, message: "Hanya sekolah pengaju yang dapat membatalkan." };
    }
    await prisma.guruTugasTambahanRequest.update({
      where: { id: row.id },
      data: {
        status: "CANCELLED",
        decidedByUserId: userId,
        decidedBySchoolId: schoolId,
        decidedAt: new Date(),
        rejectReason: "Dibatalkan oleh pengaju.",
      },
    });
    return { ok: true };
  } catch (e) {
    return { ok: false, message: (e as Error).message };
  }
}

const revokeApprovedNonSatHostSchema = z.object({ requestId: z.string().min(1) });

/**
 * Sekolah induk membatalkan penugasan **setelah** sekolah tujuan menyetujui: menghapus baris `Teacher`
 * di sekolah host + menandai permohonan dibatalkan. Dipakai admin satminkal untuk permohonan keluar
 * yang sudah `APPROVED` (host boleh satminkal atau non-satminkal di data).
 */
export async function revokeApprovedGuruTugasTambahanNonSatHostAction(
  raw: z.infer<typeof revokeApprovedNonSatHostSchema>,
): Promise<{ ok: true } | { ok: false; message: string }> {
  let data: z.infer<typeof revokeApprovedNonSatHostSchema>;
  try {
    data = revokeApprovedNonSatHostSchema.parse(raw);
  } catch {
    return { ok: false, message: "Data tidak valid." };
  }

  try {
    const { schoolId, userId } = await requireTenantAdmin();

    const tenant = await prisma.school.findUnique({
      where: { id: schoolId },
      select: { isSatminkal: true },
    });
    if (!tenant?.isSatminkal) {
      return {
        ok: false,
        message: "Hanya admin sekolah satminkal induk yang dapat membatalkan lewat menu ini.",
      };
    }

    const row = await prisma.guruTugasTambahanRequest.findUnique({
      where: { id: data.requestId },
      include: {
        homeTeacher: {
          include: { school: { select: { id: true } }, user: { select: { id: true } } },
        },
      },
    });
    if (!row) return { ok: false, message: "Permohonan tidak ditemukan." };
    if (row.status !== "APPROVED") {
      return {
        ok: false,
        message: "Hanya permohonan yang sudah disetujui sekolah tujuan yang dapat dibatalkan di sini.",
      };
    }
    if (row.initiatedBySchoolId !== schoolId) {
      return { ok: false, message: "Permohonan ini tidak diajukan dari sekolah Anda." };
    }
    if (row.homeTeacher.schoolId !== schoolId) {
      return { ok: false, message: "Hanya sekolah induk guru yang dapat membatalkan penugasan ini." };
    }

    const teacherAtHost = await prisma.teacher.findFirst({
      where: { userId: row.homeTeacher.userId, schoolId: row.hostSchoolId },
      select: { id: true },
    });

    await prisma.$transaction(async (tx) => {
      await tx.user.updateMany({
        where: { id: row.homeTeacher.userId, activeSchoolId: row.hostSchoolId },
        data: { activeSchoolId: null },
      });
      if (teacherAtHost) {
        await tx.teacher.delete({ where: { id: teacherAtHost.id } });
      }
      await cancelTugasTambahanRequestsForPengajarOnHost(tx, {
        hostSchoolId: row.hostSchoolId,
        pengajarUserId: row.homeTeacher.userId,
        homeSchoolId: row.homeTeacher.schoolId,
        decidedByUserId: userId,
        decidedBySchoolId: schoolId,
        rejectReason: teacherAtHost
          ? "Dibatalkan oleh sekolah induk setelah persetujuan sekolah tujuan (tugas tambahan)."
          : "Dibatalkan oleh sekolah induk; penugasan di sekolah tujuan sudah dihapus (disinkronkan).",
      });
    });

    return { ok: true };
  } catch (e) {
    return { ok: false, message: (e as Error).message };
  }
}

/** Guru induk di sekolah ini (untuk form ajukan) — hanya baris yang `User.schoolId` = sekolah ini (bukan pengajar tambahan). */
export async function listHomeTeachersForTugasAction() {
  const { schoolId } = await requireTenantAdmin();
  const school = await prisma.school.findUnique({
    where: { id: schoolId },
    select: { isSatminkal: true },
  });
  if (!school?.isSatminkal) return [];

  return prisma.teacher.findMany({
    where: {
      schoolId,
      user: { schoolId },
    },
    include: { user: { select: { email: true } } },
    orderBy: { nama: "asc" },
  });
}

/** Guru dari sekolah satminkal lain (cari NPSN) — hanya guru induk di sekolah itu (`User.schoolId` sama dengan sekolah), bukan pengajar tambahan dari sekolah lain. */
export async function listTeachersAtSchoolByIdForPickerAction(targetSchoolId: string) {
  const { schoolId } = await requireTenantAdmin();
  const [mine, target] = await Promise.all([
    prisma.school.findUnique({ where: { id: schoolId }, select: { isSatminkal: true } }),
    prisma.school.findUnique({
      where: { id: targetSchoolId },
      select: { id: true, isSatminkal: true, namaSekolah: true },
    }),
  ]);
  if (!target?.isSatminkal) {
    return { ok: false as const, message: "Sekolah yang dipilih harus sekolah satminkal (induk guru)." };
  }
  if (targetSchoolId === schoolId) {
    return { ok: false as const, message: "Pilih sekolah lain." };
  }
  if (mine?.isSatminkal) {
    return {
      ok: false as const,
      message: "Untuk sekolah satminkal, pilih guru dari daftar internal sekolah Anda (bukan lewat NPSN sekolah lain).",
    };
  }

  const teachers = await prisma.teacher.findMany({
    where: {
      schoolId: targetSchoolId,
      user: { schoolId: targetSchoolId },
    },
    include: { user: { select: { email: true } } },
    orderBy: { nama: "asc" },
    take: 200,
  });

  return { ok: true as const, teachers };
}
