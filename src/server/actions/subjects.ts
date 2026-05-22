"use server";

import { z } from "zod";

import { prisma } from "@/lib/prisma";
import { normalizeJenisUjianForSchool } from "@/lib/school-terminology";
import { requireTenantAdmin } from "@/server/session";

import type { SchoolLevel } from "@prisma/client";

export type SubjectRow = {
  id: string;
  row: number;
  kode: string;
  nama: string;
  kelompok: string | null;
  jenisUjian: string;
  orderNo: number;
  semesterCount: number;
};

async function schoolJenjangForBulk(schoolId: string): Promise<SchoolLevel | null> {
  const school = await prisma.school.findUnique({
    where: { id: schoolId },
    select: { jenjang: true },
  });
  return school?.jenjang ?? null;
}

async function reloadSubjects(schoolId: string): Promise<SubjectRow[]> {
  const rows = await prisma.subject.findMany({
    where: { schoolId },
    orderBy: [{ orderNo: "asc" }, { code: "asc" }],
  });
  return rows.map((x, i) => ({
    id: x.id,
    row: i + 1,
    kode: x.code,
    nama: x.name,
    kelompok: x.kelompok,
    jenisUjian: x.jenisUjian,
    orderNo: x.orderNo,
    semesterCount: x.semesterCount,
  }));
}

/* ────────── Bulk import ────────── */

const item = z.object({
  kode: z.string().min(1),
  nama: z.string().min(1),
  kelompok: z.string().optional(),
  jenisUjian: z.string().optional(),
});

export async function bulkCreateSubjectsAction(
  itemsIn: z.infer<typeof item>[],
): Promise<{ ok: true; list: SubjectRow[] } | { ok: false; message: string }> {
  try {
    const parsed = z.array(item).parse(itemsIn);
    const { schoolId } = await requireTenantAdmin();
    const jenjang = await schoolJenjangForBulk(schoolId);

    const existingCount = await prisma.subject.count({ where: { schoolId } });

    await prisma.$transaction(
      parsed.map((it, i) =>
        prisma.subject.upsert({
          where: {
            schoolId_code: { schoolId, code: it.kode.trim() },
          },
          create: {
            schoolId,
            code: it.kode.trim(),
            name: it.nama.trim(),
            kelompok: it.kelompok?.trim() || null,
            jenisUjian: normalizeJenisUjianForSchool(it.jenisUjian, jenjang),
            orderNo: existingCount + i + 1,
          },
          update: {
            name: it.nama.trim(),
            kelompok: it.kelompok?.trim() || null,
            jenisUjian: normalizeJenisUjianForSchool(it.jenisUjian, jenjang),
          },
        }),
      ),
    );

    const { revalidateTag } = await import("next/cache");
    revalidateTag(`rekap-${schoolId}`, "max");

    return { ok: true, list: await reloadSubjects(schoolId) };
  } catch (e) {
    return { ok: false, message: (e as Error).message };
  }
}

/* ────────── Edit mapel ────────── */

const editSchema = z.object({
  id: z.string().min(1),
  kode: z.string().min(1),
  nama: z.string().min(1),
  kelompok: z.string().optional(),
  jenisUjian: z.string().optional(),
});

export async function editSubjectAction(
  raw: z.infer<typeof editSchema>,
): Promise<{ ok: true; list: SubjectRow[] } | { ok: false; message: string }> {
  const parsed = editSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, message: "Data tidak valid." };
  const data = parsed.data;

  try {
    const { schoolId } = await requireTenantAdmin();
    const [existing, school] = await Promise.all([
      prisma.subject.findFirst({
        where: { id: data.id, schoolId },
      }),
      prisma.school.findUnique({
        where: { id: schoolId },
        select: { jenjang: true },
      }),
    ]);
    if (!existing) return { ok: false, message: "Mapel tidak ditemukan." };

    await prisma.subject.update({
      where: { id: data.id },
      data: {
        code: data.kode.trim(),
        name: data.nama.trim(),
        kelompok: data.kelompok?.trim() || null,
        jenisUjian: normalizeJenisUjianForSchool(
          data.jenisUjian,
          school?.jenjang ?? null,
        ),
      },
    });

    const { syncSubjectSemesterCountsForSchool } = await import(
      "@/lib/subject-semester-sync"
    );
    await syncSubjectSemesterCountsForSchool(schoolId);

    const { revalidateTag } = await import("next/cache");
    revalidateTag(`rekap-${schoolId}`, "max");

    return { ok: true, list: await reloadSubjects(schoolId) };
  } catch (e) {
    return { ok: false, message: (e as Error).message };
  }
}

/* ────────── Hapus mapel ────────── */

export async function deleteSubjectAction(
  payload: { subjectId: string },
): Promise<{ ok: true; list: SubjectRow[] } | { ok: false; message: string }> {
  try {
    const { schoolId } = await requireTenantAdmin();
    const subj = await prisma.subject.findFirst({
      where: { id: payload.subjectId, schoolId },
      select: { id: true },
    });
    if (!subj) return { ok: false, message: "Mapel tidak ditemukan." };

    await prisma.$transaction(async (tx) => {
      await tx.gradeEntry.deleteMany({ where: { subjectId: subj.id } });
      await tx.teachingAssignment.deleteMany({ where: { subjectId: subj.id } });
      await tx.subject.delete({ where: { id: subj.id } });
    });

    const { revalidateTag } = await import("next/cache");
    revalidateTag(`rekap-${schoolId}`, "max");

    return { ok: true, list: await reloadSubjects(schoolId) };
  } catch (e) {
    return { ok: false, message: (e as Error).message };
  }
}

/* ────────── Update urutan batch ────────── */

export async function updateSubjectOrderAction(
  items: { id: string; orderNo: number }[],
): Promise<{ ok: true; list: SubjectRow[] } | { ok: false; message: string }> {
  try {
    const { schoolId } = await requireTenantAdmin();

    const orderNos = items.map((it) => it.orderNo);
    const unique = new Set(orderNos);
    if (unique.size !== orderNos.length) {
      return { ok: false, message: "Nomor urutan tidak boleh ada yang sama." };
    }

    const ids = items.map((it) => it.id);
    const owned = await prisma.subject.findMany({
      where: { schoolId, id: { in: ids } },
      select: { id: true },
    });
    if (owned.length !== ids.length) {
      return { ok: false, message: "Satu atau lebih mapel tidak ditemukan di sekolah Anda." };
    }

    await prisma.$transaction(
      items.map((it) =>
        prisma.subject.update({
          where: { id: it.id, schoolId },
          data: { orderNo: it.orderNo },
        }),
      ),
    );

    const { revalidateTag } = await import("next/cache");
    revalidateTag(`rekap-${schoolId}`, "max");

    return { ok: true, list: await reloadSubjects(schoolId) };
  } catch (e) {
    return { ok: false, message: (e as Error).message };
  }
}
