"use server";

import { z } from "zod";

import { semestersForSchool } from "@/domain/semesters";
import { prisma } from "@/lib/prisma";
import { getSchoolAccessSnapshot } from "@/server/subscription-access";
import { requireTenantAdmin } from "@/server/session";

export async function listAcademicYearsAction() {
  const { schoolId } = await requireTenantAdmin();
  return prisma.academicYear.findMany({
    where: { schoolId },
    orderBy: { label: "desc" },
  });
}

const yearSchema = z.object({
  label: z.string().min(1),
  isActive: z.boolean().optional(),
});

export async function createAcademicYearAction(
  raw: z.infer<typeof yearSchema>,
): Promise<{ ok: true; id: string } | { ok: false; message: string }> {
  let data: z.infer<typeof yearSchema>;
  try {
    data = yearSchema.parse(raw);
  } catch {
    return { ok: false, message: "Data tidak valid." };
  }
  try {
    const { schoolId } = await requireTenantAdmin();
    const label = data.label.trim();

    const access = await getSchoolAccessSnapshot(schoolId);
    const existingCount = await prisma.academicYear.count({
      where: { schoolId },
    });
    if (existingCount >= 1 && !access.canAddAcademicYear) {
      return {
        ok: false,
        message:
          "Paket gratis hanya boleh 1 tahun ajaran. Berlangganan untuk menambah tahun ajaran baru.",
      };
    }

    const activeCount =
      existingCount === 0
        ? 0
        : await prisma.academicYear.count({
            where: { schoolId, isActive: true },
          });

    /**
     * Invariant setelah ada data: tepat satu `isActive` per sekolah.
     * — Tahun pertama selalu dibuat aktif (satu-satunya baris).
     * — Jika data rusak (0 aktif tetapi sudah ada baris lain), baru boleh tambah TA aktif.
     */
    const wantsActive = data.isActive ?? true;
    let createAsActive = wantsActive;
    if (existingCount === 0) {
      createAsActive = true;
    } else if (activeCount === 0) {
      if (!wantsActive) {
        return {
          ok: false,
          message:
            "Saat ini belum ada tahun ajaran aktif. Centang «Jadikan tahun ajaran aktif» atau aktifkan salah satu tahun di daftar.",
        };
      }
      createAsActive = true;
    }

    const existing = await prisma.academicYear.findFirst({
      where: { schoolId, label },
    });
    if (existing) {
      return {
        ok: false,
        message: `Tahun ajaran "${label}" sudah ada. Silakan gunakan label tahun ajaran lain.`,
      };
    }

    const y = await prisma.$transaction(async (tx) => {
      const created = await tx.academicYear.create({
        data: { schoolId, label, isActive: createAsActive },
      });
      if (created.isActive) {
        await tx.academicYear.updateMany({
          where: { schoolId, id: { not: created.id } },
          data: { isActive: false },
        });
      }
      return created;
    });

    const { revalidateTag } = await import("next/cache");
    revalidateTag(`rekap-${schoolId}`, "max");

    return { ok: true, id: y.id };
  } catch (e) {
    return { ok: false, message: (e as Error).message };
  }
}

/** Aktifkan tahun ajaran (yang lain ikut nonaktif). Menonaktifkan eksplisit tidak diizinkan — harus tepat satu aktif bila ada data. */
export async function toggleAcademicYearActiveAction(
  payload: { yearId: string; setActive: boolean },
): Promise<{ ok: true } | { ok: false; message: string }> {
  try {
    const { schoolId } = await requireTenantAdmin();
    const year = await prisma.academicYear.findFirst({
      where: { id: payload.yearId, schoolId },
    });
    if (!year) return { ok: false, message: "Tahun ajaran tidak ditemukan." };

    if (!payload.setActive) {
      if (!year.isActive) {
        return { ok: true };
      }
      return {
        ok: false,
        message:
          "Tidak dapat menonaktifkan tahun ajaran yang sedang aktif — harus ada tepat satu yang aktif. Aktifkan tahun ajaran lain di daftar untuk menggantinya.",
      };
    }

    await prisma.$transaction(async (tx) => {
      await tx.academicYear.updateMany({
        where: { schoolId, id: { not: year.id } },
        data: { isActive: false },
      });
      await tx.academicYear.update({
        where: { id: year.id },
        data: { isActive: true },
      });
    });

    const { revalidateTag } = await import("next/cache");
    revalidateTag(`rekap-${schoolId}`, "max");

    return { ok: true };
  } catch (e) {
    return { ok: false, message: (e as Error).message };
  }
}

/** Isi baris Semester dari pola jenjang sekolah (untuk tahun ajaran baru). */
export async function seedSemestersForYearAction(
  academicYearId: string,
  opts?: { force?: boolean },
): Promise<{ ok: true; warning?: string } | { ok: false; message: string; needsConfirm?: boolean }> {
  const { schoolId } = await requireTenantAdmin();
  const year = await prisma.academicYear.findFirst({
    where: { id: academicYearId, schoolId },
  });
  if (!year) return { ok: false, message: "Tahun ajaran tidak ditemukan." };
  const school = await prisma.school.findUnique({ where: { id: schoolId } });
  if (!school?.jenjang)
    return { ok: false, message: "Atur jenjang sekolah di Data Sekolah terlebih dahulu." };

  const keys = semestersForSchool(school.jenjang, school.raporSemesterCount);
  const labels: Record<string, string> = {
    k4_ganjil: "Kls 4 Ganjil",
    k4_genap: "Kls 4 Genap",
    k5_ganjil: "Kls 5 Ganjil",
    k5_genap: "Kls 5 Genap",
    k6_ganjil: "Kls 6 Ganjil",
    k6_genap: "Kls 6 Genap",
    k7_ganjil: "Kls 7 Ganjil",
    k7_genap: "Kls 7 Genap",
    k8_ganjil: "Kls 8 Ganjil",
    k8_genap: "Kls 8 Genap",
    k9_ganjil: "Kls 9 Ganjil",
    k9_genap: "Kls 9 Genap",
    k10_ganjil: "Kls 10 Ganjil",
    k10_genap: "Kls 10 Genap",
    k11_ganjil: "Kls 11 Ganjil",
    k11_genap: "Kls 11 Genap",
    k12_ganjil: "Kls 12 Ganjil",
    k12_genap: "Kls 12 Genap",
    paud_1: "Semester 1",
    paud_2: "Semester 2",
    paud_3: "Semester 3",
    paud_4: "Semester 4",
    paud_5: "Semester 5",
    paud_6: "Semester 6",
  };

  const keySet = new Set(keys);

  const existingSemesters = await prisma.semester.findMany({
    where: { schoolId, academicYearId },
  });
  const removedKeys = existingSemesters
    .filter((s) => !keySet.has(s.internalKey))
    .map((s) => s.internalKey);

  let warning: string | undefined;

  if (removedKeys.length > 0 && !opts?.force) {
    const gradesInRemoved = await prisma.gradeEntry.count({
      where: {
        schoolId,
        semesterKey: { in: removedKeys },
      },
    });

    if (gradesInRemoved > 0) {
      const removedLabels = removedKeys.map((k) => labels[k] ?? k).join(", ");
      return {
        ok: false,
        needsConfirm: true,
        message: `Terdapat ${gradesInRemoved} data nilai rapor pada semester yang akan diabaikan (${removedLabels}). Data nilai tidak akan dihapus, namun tidak akan diperhitungkan dalam rekap nilai ijazah. Lanjutkan?`,
      };
    }
  }

  if (removedKeys.length > 0) {
    await prisma.semester.deleteMany({
      where: { schoolId, academicYearId, internalKey: { in: removedKeys } },
    });
    const removedLabels = removedKeys.map((k) => labels[k] ?? k).join(", ");
    warning = `Semester yang tidak lagi termasuk pola (${removedLabels}) telah dihapus dari daftar semester. Data nilai tetap tersimpan.`;
  }

  await prisma.$transaction(
    keys.map((k, i) =>
      prisma.semester.upsert({
        where: {
          academicYearId_internalKey: {
            academicYearId,
            internalKey: k,
          },
        },
        create: {
          schoolId,
          academicYearId,
          internalKey: k,
          label: labels[k] ?? k,
          orderNo: i,
        },
        update: { label: labels[k] ?? k, orderNo: i },
      }),
    ),
  );

  const { revalidateTag } = await import("next/cache");
  revalidateTag(`rekap-${schoolId}`, "max");

  return { ok: true, warning };
}

export async function listSemestersForYearAction(academicYearId: string) {
  const { schoolId } = await requireTenantAdmin();
  return prisma.semester.findMany({
    where: { schoolId, academicYearId },
    orderBy: { orderNo: "asc" },
  });
}

const classSchema = z.object({
  academicYearId: z.string(),
  name: z.string().min(1),
});

export async function createClassRoomAction(
  raw: z.infer<typeof classSchema>,
): Promise<{ ok: true } | { ok: false; message: string }> {
  let data: z.infer<typeof classSchema>;
  try {
    data = classSchema.parse(raw);
  } catch {
    return { ok: false, message: "Data tidak valid." };
  }
  try {
    const { schoolId } = await requireTenantAdmin();
    await prisma.classRoom.create({
      data: {
        schoolId,
        academicYearId: data.academicYearId,
        name: data.name.trim(),
      },
    });
    return { ok: true };
  } catch (e) {
    return { ok: false, message: (e as Error).message };
  }
}

export type ClassRoomItem = {
  id: string;
  name: string;
  homeroomTeacherId: string | null;
  homeroomTeacherName: string | null;
};

export async function listClassRoomsAction(
  academicYearId: string,
): Promise<ClassRoomItem[]> {
  const { schoolId } = await requireTenantAdmin();
  const rows = await prisma.classRoom.findMany({
    where: { schoolId, academicYearId },
    orderBy: { name: "asc" },
    include: { homeroomTeacher: { select: { id: true, nama: true } } },
  });
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    homeroomTeacherId: r.homeroomTeacherId,
    homeroomTeacherName: r.homeroomTeacher?.nama ?? null,
  }));
}

/* ────────── Edit kelas ────────── */

const editClassSchema = z.object({
  classRoomId: z.string().min(1),
  name: z.string().min(1),
});

export async function editClassRoomAction(
  raw: z.infer<typeof editClassSchema>,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const parsed = editClassSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, message: "Data tidak valid." };
  try {
    const { schoolId } = await requireTenantAdmin();
    const existing = await prisma.classRoom.findFirst({
      where: { id: parsed.data.classRoomId, schoolId },
    });
    if (!existing) return { ok: false, message: "Kelas tidak ditemukan." };
    const newName = parsed.data.name.trim();
    await prisma.$transaction(async (tx) => {
      await tx.classRoom.update({
        where: { id: parsed.data.classRoomId },
        data: { name: newName },
      });
      await tx.student.updateMany({
        where: { classRoomId: parsed.data.classRoomId },
        data: { className: newName },
      });
    });

    const { revalidateTag } = await import("next/cache");
    revalidateTag(`rekap-${schoolId}`, "max");

    return { ok: true };
  } catch (e) {
    return { ok: false, message: (e as Error).message };
  }
}

/* ────────── Hapus kelas ────────── */

export async function deleteClassRoomAction(
  payload: { classRoomId: string },
): Promise<{ ok: true } | { ok: false; message: string }> {
  try {
    const { schoolId } = await requireTenantAdmin();
    const cr = await prisma.classRoom.findFirst({
      where: { id: payload.classRoomId, schoolId },
    });
    if (!cr) return { ok: false, message: "Kelas tidak ditemukan." };
    await prisma.$transaction(async (tx) => {
      await tx.student.updateMany({
        where: { classRoomId: cr.id },
        data: { classRoomId: null, className: null },
      });
      await tx.teachingAssignment.deleteMany({ where: { classRoomId: cr.id } });
      await tx.classRoom.delete({ where: { id: cr.id } });
    });

    const { revalidateTag } = await import("next/cache");
    revalidateTag(`rekap-${schoolId}`, "max");

    return { ok: true };
  } catch (e) {
    return { ok: false, message: (e as Error).message };
  }
}

/* ────────── Set wali kelas ────────── */

const setHomeroomSchema = z.object({
  classRoomId: z.string().min(1),
  teacherId: z.string().nullable(),
});

export async function setHomeroomTeacherAction(
  raw: z.infer<typeof setHomeroomSchema>,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const parsed = setHomeroomSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, message: "Data tidak valid." };
  try {
    const { schoolId } = await requireTenantAdmin();
    const cr = await prisma.classRoom.findFirst({
      where: { id: parsed.data.classRoomId, schoolId },
    });
    if (!cr) return { ok: false, message: "Kelas tidak ditemukan." };
    await prisma.classRoom.update({
      where: { id: cr.id },
      data: { homeroomTeacherId: parsed.data.teacherId },
    });
    return { ok: true };
  } catch (e) {
    return { ok: false, message: (e as Error).message };
  }
}

/* ────────── List guru (untuk dropdown wali kelas) ────────── */

export async function listTeachersForSchoolAction(): Promise<
  { id: string; nama: string }[]
> {
  const { schoolId } = await requireTenantAdmin();
  return prisma.teacher.findMany({
    where: { schoolId },
    orderBy: { nama: "asc" },
    select: { id: true, nama: true },
  });
}
