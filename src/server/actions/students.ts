"use server";

import bcrypt from "bcryptjs";
import { z } from "zod";

import { prisma } from "@/lib/prisma";
import { passwordFromBirthDate, studentLoginEmail } from "@/lib/student-login";
import {
  assertClassRoomBelongsToActiveAcademicYear,
  studentWhereAdminRosterActiveYear,
} from "@/server/active-academic-year-scope";
import { requireTenantAdmin, requireUserSchoolId } from "@/server/session";
import {
  assertCanAddStudents,
  getSchoolAccessSnapshot,
  recordStudentAdds,
} from "@/server/subscription-access";
import { normalizeImportedClassName } from "@/lib/student-import-excel";
import { studentsToRows } from "@/server/student-serialize";

export type StudentListItem = ReturnType<typeof studentsToRows>[number];

export type StudentQuotaPayload = {
  studentAddsUsed: number;
  studentAddsRemaining: number;
};

// ─── NISN duplicate check across schools ───

async function checkNisnInOtherSchools(
  nisn: string,
  currentSchoolId: string,
): Promise<string | null> {
  const other = await prisma.student.findFirst({
    where: { nisn, schoolId: { not: currentSchoolId } },
    include: { school: { select: { namaSekolah: true } } },
  });
  return other?.school?.namaSekolah ?? (other ? "sekolah lain" : null);
}

export async function checkNisnDuplicateAction(
  nisn: string,
): Promise<{ found: boolean; schoolName?: string }> {
  const { schoolId } = await requireTenantAdmin();
  const schoolName = await checkNisnInOtherSchools(nisn, schoolId);
  if (schoolName) return { found: true, schoolName };
  return { found: false };
}

const createSchema = z.object({
  nisn: z.string().regex(/^\d{10}$/, "NISN harus tepat 10 digit angka."),
  nis: z.string().optional().nullable(),
  nomorUjian: z.string().optional().nullable(),
  name: z.string().min(1),
  gender: z.string().optional().nullable(),
  birthPlace: z.string().optional().nullable(),
  birthDate: z.string().min(1, "Tanggal lahir wajib diisi."),
  address: z.string().optional().nullable(),
  phone: z.string().optional().nullable(),
  emailSiswa: z.string().optional().nullable(),
  tahunMasuk: z.number().nullable().optional(),
  tahunLulus: z.number().nullable().optional(),
  tampilkanTranskrip: z.enum(["YA", "TIDAK"]).optional(),
  className: z.string().optional().nullable(),
  classRoomId: z.string().optional().nullable(),
  ruangUjian: z.string().optional().nullable(),
});

const editSchema = z.object({
  id: z.string().min(1),
  nisn: z.string().regex(/^\d{10}$/, "NISN harus tepat 10 digit angka."),
  name: z.string().min(1),
  gender: z.string().optional().nullable(),
  birthPlace: z.string().optional().nullable(),
  birthDate: z.string().min(1, "Tanggal lahir wajib diisi."),
  className: z.string().optional().nullable(),
  classRoomId: z.string().optional().nullable(),
});

async function ensureStudentUserAccount(args: {
  schoolId: string;
  studentId: string;
  nisn: string;
  studentName: string;
  birthDate: Date;
}) {
  const email = studentLoginEmail(args.nisn);
  const plainPassword = passwordFromBirthDate(args.birthDate);
  const passwordHash = await bcrypt.hash(plainPassword, 12);

  const existing = await prisma.user.findUnique({ where: { email } });
  let userId: string;
  if (existing) {
    const upd = await prisma.user.update({
      where: { id: existing.id },
      data: {
        name: args.studentName,
        schoolId: args.schoolId,
        role: "SISWA",
        passwordHash,
        isActive: true,
      },
      select: { id: true },
    });
    userId = upd.id;
  } else {
    const created = await prisma.user.create({
      data: {
        name: args.studentName,
        email,
        schoolId: args.schoolId,
        role: "SISWA",
        passwordHash,
        isActive: true,
      },
      select: { id: true },
    });
    userId = created.id;
  }

  await prisma.student.update({
    where: { id: args.studentId },
    data: {
      userId,
      emailSiswa: email,
    },
  });
}

export async function createStudentAction(
  raw: z.infer<typeof createSchema>,
): Promise<
  | { ok: true; list: StudentListItem[]; warning?: string; quota?: StudentQuotaPayload }
  | { ok: false; message: string }
> {
  let data: z.infer<typeof createSchema>;
  try {
    data = createSchema.parse(raw);
  } catch {
    return { ok: false, message: "Data tidak valid." };
  }
  try {
    const { schoolId } = await requireTenantAdmin();
    const birthDate = new Date(`${data.birthDate}T12:00:00`);
    if (Number.isNaN(birthDate.getTime())) {
      return { ok: false, message: "Tanggal lahir tidak valid." };
    }

    const dupSchool = await checkNisnInOtherSchools(data.nisn.trim(), schoolId);

    if (data.classRoomId) {
      const roomOk = await assertClassRoomBelongsToActiveAcademicYear(
        schoolId,
        data.classRoomId,
      );
      if (!roomOk.ok) return { ok: false, message: roomOk.message };
    }

    const quota = await assertCanAddStudents(schoolId, 1);
    if (!quota.ok) return quota;

    const created = await prisma.student.create({
      data: {
        schoolId,
        nisn: data.nisn.trim(),
        nis: data.nis?.trim() || null,
        nomorUjian: data.nomorUjian?.trim() || null,
        name: data.name.trim(),
        gender: data.gender ?? null,
        birthPlace: data.birthPlace?.trim() || null,
        birthDate,
        address: data.address ?? null,
        phone: data.phone ?? null,
        emailSiswa: data.emailSiswa ?? null,
        tahunMasuk: data.tahunMasuk ?? null,
        tahunLulus: data.tahunLulus ?? null,
        tampilkanTranskrip: data.tampilkanTranskrip === "YA",
        className: data.className?.trim() ?? null,
        classRoomId: data.classRoomId || null,
        ruangUjian: data.ruangUjian ?? null,
      },
      select: { id: true, nisn: true, name: true, birthDate: true },
    });

    const access = await getSchoolAccessSnapshot(schoolId);
    if (access.canGenerateStudentLoginCards) {
      await ensureStudentUserAccount({
        schoolId,
        studentId: created.id,
        nisn: created.nisn,
        studentName: created.name,
        birthDate: created.birthDate ?? birthDate,
      });
    }

    await recordStudentAdds(schoolId, 1);

    const list = await reloadStudents(schoolId);
    const snapAfter = await getSchoolAccessSnapshot(schoolId);

    const { revalidateTag } = await import("next/cache");
    revalidateTag(`rekap-${schoolId}`, "max");

    return {
      ok: true,
      list,
      warning: dupSchool
        ? `NISN ${data.nisn} juga terdaftar di ${dupSchool}. Pastikan data siswa sudah benar.`
        : undefined,
      quota: snapAfter.isSubscribed
        ? undefined
        : {
            studentAddsUsed: snapAfter.studentAddsUsed,
            studentAddsRemaining: snapAfter.studentAddsRemaining,
          },
    };
  } catch (e) {
    return { ok: false, message: (e as Error).message };
  }
}

export async function linkStudentAccountAction(payload: {
  studentId: string;
  email: string;
}) {
  const { schoolId } = await requireTenantAdmin();
  const email = payload.email.trim().toLowerCase();
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user)
    return { ok: false as const, message: "Pengguna belum login Google." };
  const rosterWhere = await studentWhereAdminRosterActiveYear(schoolId);
  const st = await prisma.student.findFirst({
    where: { AND: [rosterWhere, { id: payload.studentId }] },
  });
  if (!st) return { ok: false as const, message: "Siswa tidak ditemukan." };
  await prisma.$transaction([
    prisma.user.update({
      where: { id: user.id },
      data: { schoolId, role: "SISWA" },
    }),
    prisma.student.update({
      where: { id: st.id },
      data: { userId: user.id },
    }),
  ]);
  return { ok: true as const };
}

const provisionOneSchema = z.object({
  studentId: z.string().min(1),
});

export async function provisionStudentLoginAction(
  payload: z.infer<typeof provisionOneSchema>,
): Promise<
  | { ok: true; email: string; password: string }
  | { ok: false; message: string }
> {
  const parsed = provisionOneSchema.safeParse(payload);
  if (!parsed.success) return { ok: false, message: "Data tidak valid." };

  const { schoolId } = await requireTenantAdmin();
  const access = await getSchoolAccessSnapshot(schoolId);
  if (!access.canGenerateStudentLoginCards) {
    return {
      ok: false,
      message: "Generate kartu login siswa hanya tersedia untuk sekolah berlangganan.",
    };
  }
  const rosterWhere = await studentWhereAdminRosterActiveYear(schoolId);
  const st = await prisma.student.findFirst({
    where: { AND: [rosterWhere, { id: parsed.data.studentId }] },
    select: { id: true, nisn: true, name: true, birthDate: true },
  });
  if (!st) return { ok: false, message: "Siswa tidak ditemukan." };
  if (!st.birthDate) return { ok: false, message: "Tanggal lahir siswa belum diisi." };

  await ensureStudentUserAccount({
    schoolId,
    studentId: st.id,
    nisn: st.nisn,
    studentName: st.name,
    birthDate: st.birthDate,
  });
  return {
    ok: true,
    email: studentLoginEmail(st.nisn),
    password: passwordFromBirthDate(st.birthDate),
  };
}

const provisionClassSchema = z.object({
  classRoomId: z.string().optional().nullable(),
});

export async function provisionStudentLoginsByClassAction(
  payload: z.infer<typeof provisionClassSchema>,
): Promise<{ ok: true; count: number } | { ok: false; message: string }> {
  const parsed = provisionClassSchema.safeParse(payload);
  if (!parsed.success) return { ok: false, message: "Data tidak valid." };

  const { schoolId } = await requireTenantAdmin();
  const access = await getSchoolAccessSnapshot(schoolId);
  if (!access.canGenerateStudentLoginCards) {
    return {
      ok: false,
      message: "Generate kartu login siswa hanya tersedia untuk sekolah berlangganan.",
    };
  }
  const rosterWhere = await studentWhereAdminRosterActiveYear(schoolId);
  const where = parsed.data.classRoomId
    ? {
        AND: [rosterWhere, { classRoomId: parsed.data.classRoomId }],
      }
    : rosterWhere;
  const students = await prisma.student.findMany({
    where,
    select: { id: true, nisn: true, name: true, birthDate: true },
    orderBy: [{ className: "asc" }, { name: "asc" }],
  });
  const invalid = students.find((s) => !s.birthDate);
  if (invalid) {
    return {
      ok: false,
      message: `Tanggal lahir belum diisi untuk siswa ${invalid.nisn} - ${invalid.name}.`,
    };
  }

  for (const s of students) {
    const bd = s.birthDate;
    if (!bd) continue;
    await ensureStudentUserAccount({
      schoolId,
      studentId: s.id,
      nisn: s.nisn,
      studentName: s.name,
      birthDate: bd,
    });
  }

  return { ok: true, count: students.length };
}

/* ────────── Edit siswa ────────── */

export async function editStudentAction(
  raw: z.infer<typeof editSchema>,
): Promise<{ ok: true; list: StudentListItem[]; warning?: string } | { ok: false; message: string }> {
  const parsed = editSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, message: "Data tidak valid." };
  const data = parsed.data;

  try {
    const { schoolId } = await requireTenantAdmin();
    const rosterWhere = await studentWhereAdminRosterActiveYear(schoolId);
    const existing = await prisma.student.findFirst({
      where: { AND: [rosterWhere, { id: data.id }] },
    });
    if (!existing) return { ok: false, message: "Siswa tidak ditemukan." };

    const birthDate = new Date(`${data.birthDate}T12:00:00`);
    if (Number.isNaN(birthDate.getTime()))
      return { ok: false, message: "Tanggal lahir tidak valid." };

    const dupSchool = await checkNisnInOtherSchools(data.nisn.trim(), schoolId);

    const nextRoomId = data.classRoomId?.trim() ? data.classRoomId.trim() : null;
    if (nextRoomId !== existing.classRoomId && nextRoomId) {
      const roomOk = await assertClassRoomBelongsToActiveAcademicYear(schoolId, nextRoomId);
      if (!roomOk.ok) return { ok: false, message: roomOk.message };
    }

    await prisma.student.update({
      where: { id: data.id },
      data: {
        nisn: data.nisn.trim(),
        name: data.name.trim(),
        gender: data.gender ?? null,
        birthPlace: data.birthPlace?.trim() || null,
        birthDate,
        className: data.className?.trim() ?? null,
        classRoomId: nextRoomId,
      },
    });

    if (existing.userId) {
      await ensureStudentUserAccount({
        schoolId,
        studentId: data.id,
        nisn: data.nisn.trim(),
        studentName: data.name.trim(),
        birthDate,
      });
    }

    const { revalidateTag } = await import("next/cache");
    revalidateTag(`rekap-${schoolId}`, "max");

    return {
      ok: true,
      list: await reloadStudents(schoolId),
      warning: dupSchool
        ? `NISN ${data.nisn} juga terdaftar di ${dupSchool}. Pastikan data siswa sudah benar.`
        : undefined,
    };
  } catch (e) {
    return { ok: false, message: (e as Error).message };
  }
}

/* ────────── Hapus siswa ────────── */

export async function deleteStudentAction(
  payload: { studentId: string },
): Promise<{ ok: true; list: StudentListItem[] } | { ok: false; message: string }> {
  try {
    const { schoolId } = await requireTenantAdmin();
    const rosterWhere = await studentWhereAdminRosterActiveYear(schoolId);
    const st = await prisma.student.findFirst({
      where: { AND: [rosterWhere, { id: payload.studentId }] },
      select: { id: true, userId: true },
    });
    if (!st) return { ok: false, message: "Siswa tidak ditemukan." };

    await prisma.$transaction(async (tx) => {
      await tx.gradeEntry.deleteMany({ where: { studentId: st.id } });
      await tx.student.delete({ where: { id: st.id } });
      if (st.userId) {
        await tx.user.delete({ where: { id: st.userId } }).catch(() => {});
      }
    });

    const { revalidateTag } = await import("next/cache");
    revalidateTag(`rekap-${schoolId}`, "max");

    return { ok: true, list: await reloadStudents(schoolId) };
  } catch (e) {
    return { ok: false, message: (e as Error).message };
  }
}

/* ────────── Hapus massal siswa ────────── */

export async function bulkDeleteStudentsAction(
  payload: { studentIds: string[] },
): Promise<{ ok: true; list: StudentListItem[]; deleted: number } | { ok: false; message: string }> {
  try {
    const { schoolId } = await requireTenantAdmin();
    const rosterWhere = await studentWhereAdminRosterActiveYear(schoolId);
    const students = await prisma.student.findMany({
      where: { AND: [rosterWhere, { id: { in: payload.studentIds } }] },
      select: { id: true, userId: true },
    });
    if (students.length === 0) return { ok: false, message: "Tidak ada siswa yang ditemukan." };

    await prisma.$transaction(async (tx) => {
      const ids = students.map((s) => s.id);
      await tx.gradeEntry.deleteMany({ where: { studentId: { in: ids } } });
      await tx.student.deleteMany({ where: { id: { in: ids } } });
      const userIds = students.map((s) => s.userId).filter(Boolean) as string[];
      if (userIds.length > 0) {
        await tx.user.deleteMany({ where: { id: { in: userIds } } });
      }
    });

    const { revalidateTag } = await import("next/cache");
    revalidateTag(`rekap-${schoolId}`, "max");

    return { ok: true, list: await reloadStudents(schoolId), deleted: students.length };
  } catch (e) {
    return { ok: false, message: (e as Error).message };
  }
}

/* ────────── Nonaktifkan / aktifkan siswa ────────── */

export async function toggleStudentActiveAction(
  payload: { studentId: string },
): Promise<{ ok: true; list: StudentListItem[] } | { ok: false; message: string }> {
  try {
    const { schoolId } = await requireTenantAdmin();
    const rosterWhere = await studentWhereAdminRosterActiveYear(schoolId);
    const st = await prisma.student.findFirst({
      where: { AND: [rosterWhere, { id: payload.studentId }] },
      select: { id: true, isActive: true },
    });
    if (!st) return { ok: false, message: "Siswa tidak ditemukan." };

    const newActive = !st.isActive;
    await prisma.student.update({
      where: { id: st.id },
      data: { isActive: newActive },
    });

    return { ok: true, list: await reloadStudents(schoolId) };
  } catch (e) {
    return { ok: false, message: (e as Error).message };
  }
}

const setLoginActiveSchema = z.object({
  studentId: z.string().min(1),
  active: z.boolean(),
});

export async function setStudentLoginActiveAction(
  raw: z.infer<typeof setLoginActiveSchema>,
): Promise<{ ok: true; list: StudentListItem[] } | { ok: false; message: string }> {
  const parsed = setLoginActiveSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, message: "Data tidak valid." };
  try {
    const { schoolId } = await requireTenantAdmin();
    const rosterWhere = await studentWhereAdminRosterActiveYear(schoolId);
    const st = await prisma.student.findFirst({
      where: { AND: [rosterWhere, { id: parsed.data.studentId }] },
      select: { id: true, userId: true },
    });
    if (!st) return { ok: false, message: "Siswa tidak ditemukan." };
    if (!st.userId) {
      return {
        ok: false,
        message:
          "Akun login belum dibuat. Gunakan tombol Kartu untuk membuat akun terlebih dahulu.",
      };
    }
    await prisma.user.update({
      where: { id: st.userId },
      data: { isActive: parsed.data.active },
    });
    return { ok: true, list: await reloadStudents(schoolId) };
  } catch (e) {
    return { ok: false, message: (e as Error).message };
  }
}

const bulkSetLoginSchema = z.object({
  studentIds: z.array(z.string()).min(1),
  active: z.boolean(),
});

export async function bulkSetStudentLoginActiveAction(
  raw: z.infer<typeof bulkSetLoginSchema>,
): Promise<
  | { ok: true; list: StudentListItem[]; updated: number; skippedNoAccount: number }
  | { ok: false; message: string }
> {
  const parsed = bulkSetLoginSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, message: "Data tidak valid." };
  try {
    const { schoolId } = await requireTenantAdmin();
    const rosterWhere = await studentWhereAdminRosterActiveYear(schoolId);
    const students = await prisma.student.findMany({
      where: { AND: [rosterWhere, { id: { in: parsed.data.studentIds } }] },
      select: { userId: true },
    });
    const userIds = students.map((s) => s.userId).filter(Boolean) as string[];
    const skippedNoAccount = students.length - userIds.length;
    if (userIds.length === 0) {
      return {
        ok: false,
        message:
          "Tidak ada siswa terpilih yang memiliki akun login. Buat akun lewat tombol Kartu terlebih dahulu.",
      };
    }
    await prisma.user.updateMany({
      where: { id: { in: userIds } },
      data: { isActive: parsed.data.active },
    });
    return {
      ok: true,
      list: await reloadStudents(schoolId),
      updated: userIds.length,
      skippedNoAccount,
    };
  } catch (e) {
    return { ok: false, message: (e as Error).message };
  }
}

const bulkMoveClassSchema = z.object({
  studentIds: z.array(z.string()).min(2),
  targetClassRoomId: z.string().min(1),
});

function studentClassGroupKey(s: {
  classRoomId: string | null;
  className: string | null;
}): string {
  if (s.classRoomId) return `room:${s.classRoomId}`;
  return `name:${(s.className ?? "").trim().toLowerCase()}`;
}

export async function bulkMoveStudentsClassAction(
  raw: z.infer<typeof bulkMoveClassSchema>,
): Promise<
  | { ok: true; list: StudentListItem[]; moved: number }
  | { ok: false; message: string }
> {
  const parsed = bulkMoveClassSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, message: "Data tidak valid." };

  try {
    const { schoolId } = await requireTenantAdmin();
    const roomOk = await assertClassRoomBelongsToActiveAcademicYear(
      schoolId,
      parsed.data.targetClassRoomId,
    );
    if (!roomOk.ok) return { ok: false, message: roomOk.message };

    const targetRoom = await prisma.classRoom.findFirst({
      where: { id: parsed.data.targetClassRoomId, schoolId },
      select: { id: true, name: true },
    });
    if (!targetRoom) {
      return { ok: false, message: "Kelas tujuan tidak ditemukan." };
    }

    const rosterWhere = await studentWhereAdminRosterActiveYear(schoolId);
    const students = await prisma.student.findMany({
      where: { AND: [rosterWhere, { id: { in: parsed.data.studentIds } }] },
      select: { id: true, classRoomId: true, className: true },
    });

    if (students.length !== parsed.data.studentIds.length) {
      return { ok: false, message: "Beberapa siswa tidak ditemukan atau tidak pada tahun ajaran aktif." };
    }
    if (students.length < 2) {
      return { ok: false, message: "Pilih minimal dua siswa." };
    }

    const groupKeys = new Set(students.map((s) => studentClassGroupKey(s)));
    if (groupKeys.size !== 1) {
      return {
        ok: false,
        message: "Siswa yang dipilih harus berasal dari kelas yang sama.",
      };
    }

    if (students.every((s) => s.classRoomId === targetRoom.id)) {
      return { ok: false, message: "Kelas tujuan sama dengan kelas siswa saat ini." };
    }

    await prisma.student.updateMany({
      where: { id: { in: students.map((s) => s.id) } },
      data: {
        classRoomId: targetRoom.id,
        className: targetRoom.name,
      },
    });

    const { revalidateTag } = await import("next/cache");
    revalidateTag(`rekap-${schoolId}`, "max");

    return {
      ok: true,
      list: await reloadStudents(schoolId),
      moved: students.length,
    };
  } catch (e) {
    return { ok: false, message: (e as Error).message };
  }
}

/* ────────── Import siswa dari Excel ────────── */

const importRowSchema = z.object({
  excelRow: z.number().int().positive().optional(),
  nisn: z.string().min(1),
  name: z.string().min(1),
  gender: z.string().optional(),
  birthPlace: z.string().optional(),
  birthDate: z.string().min(1),
  className: z.string().optional(),
  classRoomName: z.string().optional(),
  nomorUjian: z.string().optional(),
  ruangUjian: z.string().optional(),
  parentGuardianName: z.string().optional(),
  sklLetterNumber: z.string().optional(),
  nis: z.string().optional(),
});

export type ImportSkip = { row: number; nisn: string; name: string; reason: string };
export type ImportWarning = { row: number; nisn: string; name: string; message: string };

type ImportPrepared = {
  excelRow: number;
  nisn: string;
  name: string;
  gender: string | null;
  birthPlace: string | null;
  birthDate: Date;
  className: string | null;
  classRoomId: string | null;
  nomorUjian: string | null;
  ruangUjian: string;
  parentGuardianName: string | null;
  sklLetterNumber: string | null;
  nis: string | null;
};

async function ensureClassRoomsForImport(
  schoolId: string,
  activeYearId: string,
  classMap: Map<string, string>,
  classNames: string[],
): Promise<number> {
  const unique = [
    ...new Set(
      classNames
        .map((n) => normalizeImportedClassName(n))
        .filter((n): n is string => Boolean(n)),
    ),
  ];
  const toCreate = unique.filter((name) => !classMap.has(name.toLowerCase().trim()));
  if (toCreate.length === 0) return 0;

  let created = 0;
  for (const name of toCreate) {
    try {
      const cr = await prisma.classRoom.create({
        data: { schoolId, academicYearId: activeYearId, name },
      });
      classMap.set(name.toLowerCase().trim(), cr.id);
      created += 1;
    } catch {
      /* mungkin race — muat ulang di bawah */
    }
  }

  if (created < toCreate.length) {
    const refreshed = await prisma.classRoom.findMany({
      where: { schoolId, academicYearId: activeYearId },
      select: { id: true, name: true },
    });
    for (const c of refreshed) {
      classMap.set(c.name.toLowerCase().trim(), c.id);
    }
  }

  return created;
}

async function importStudentsRowsCore(
  schoolId: string,
  rows: unknown[],
): Promise<{
  imported: number;
  classesCreated: number;
  skipped: ImportSkip[];
  warnings: ImportWarning[];
}> {
  const activeYear = await prisma.academicYear.findFirst({
    where: { schoolId, isActive: true },
  });
  const classRooms = activeYear
    ? await prisma.classRoom.findMany({
        where: { schoolId, academicYearId: activeYear.id },
        select: { id: true, name: true },
      })
    : [];
  const classMap = new Map(classRooms.map((c) => [c.name.toLowerCase().trim(), c.id]));

  const skipped: ImportSkip[] = [];
  const prepared: ImportPrepared[] = [];

  for (let i = 0; i < rows.length; i++) {
    const raw = rows[i] as Record<string, unknown>;
    const excelRow =
      typeof raw?.excelRow === "number" && Number.isFinite(raw.excelRow)
        ? Math.trunc(raw.excelRow)
        : i + 1;
    const rawNisn = String(raw?.nisn ?? "").trim();
    const rawName = String(raw?.name ?? "").trim();

    const parsed = importRowSchema.safeParse(raw);
    if (!parsed.success) {
      const missing: string[] = [];
      if (!rawNisn) missing.push("NISN");
      if (!rawName) missing.push("Nama");
      if (!String(raw?.birthDate ?? "").trim()) missing.push("Tanggal Lahir");
      skipped.push({
        row: excelRow,
        nisn: rawNisn || "-",
        name: rawName || "-",
        reason: `${missing.join(", ")} kosong.`,
      });
      continue;
    }
    const d = parsed.data;
    const birthDate = new Date(`${d.birthDate}T12:00:00`);
    if (Number.isNaN(birthDate.getTime())) {
      skipped.push({
        row: excelRow,
        nisn: d.nisn,
        name: d.name,
        reason: `Tanggal lahir "${d.birthDate}" tidak valid.`,
      });
      continue;
    }

    const nisn = d.nisn.replace(/\D/g, "").trim();
    if (!/^\d{10}$/.test(nisn)) {
      skipped.push({
        row: excelRow,
        nisn: d.nisn,
        name: d.name,
        reason: "NISN harus tepat 10 digit angka.",
      });
      continue;
    }

    const classLabel =
      normalizeImportedClassName(d.className) ??
      normalizeImportedClassName(d.classRoomName);

    prepared.push({
      excelRow,
      nisn,
      name: d.name.trim(),
      gender: d.gender?.trim() ? d.gender.trim() : null,
      birthPlace: d.birthPlace?.trim() ? d.birthPlace.trim() : null,
      birthDate,
      className: classLabel,
      classRoomId: null,
      nomorUjian: d.nomorUjian?.trim() ? d.nomorUjian.trim() : null,
      ruangUjian: d.ruangUjian?.trim() ? d.ruangUjian.trim() : "1",
      parentGuardianName: d.parentGuardianName?.trim()
        ? d.parentGuardianName.trim()
        : null,
      sklLetterNumber: d.sklLetterNumber?.trim() ? d.sklLetterNumber.trim() : null,
      nis: d.nis?.trim() ? d.nis.trim() : null,
    });
  }

  if (prepared.length === 0) {
    return { imported: 0, classesCreated: 0, skipped, warnings: [] };
  }

  let classesCreated = 0;
  if (activeYear) {
    const classNames = prepared
      .map((p) => p.className)
      .filter((n): n is string => Boolean(n));
    classesCreated = await ensureClassRoomsForImport(
      schoolId,
      activeYear.id,
      classMap,
      classNames,
    );
    for (const p of prepared) {
      if (!p.className) continue;
      p.classRoomId = classMap.get(p.className.toLowerCase().trim()) ?? null;
    }
  }

  const nisns = [...new Set(prepared.map((p) => p.nisn))];

  const existingSameSchool = await prisma.student.findMany({
    where: { schoolId, nisn: { in: nisns } },
    select: { nisn: true, name: true },
  });
  const existingByNisn = new Map(existingSameSchool.map((e) => [e.nisn, e.name]));

  const inOtherSchools = await prisma.student.findMany({
    where: { nisn: { in: nisns }, schoolId: { not: schoolId } },
    select: { nisn: true, school: { select: { namaSekolah: true } } },
  });
  const otherSchoolByNisn = new Map<string, string>();
  for (const r of inOtherSchools) {
    if (!otherSchoolByNisn.has(r.nisn)) {
      otherSchoolByNisn.set(r.nisn, r.school?.namaSekolah ?? "sekolah lain");
    }
  }

  const consumedNisnInBatch = new Set<string>();
  const pending: ImportPrepared[] = [];

  for (const p of prepared) {
    const existingName = existingByNisn.get(p.nisn);
    if (existingName) {
      skipped.push({
        row: p.excelRow,
        nisn: p.nisn,
        name: p.name,
        reason: `NISN ${p.nisn} sudah terdaftar atas nama "${existingName}".`,
      });
      continue;
    }
    if (consumedNisnInBatch.has(p.nisn)) {
      skipped.push({
        row: p.excelRow,
        nisn: p.nisn,
        name: p.name,
        reason: `NISN ${p.nisn} duplikat dalam file (baris sebelumnya).`,
      });
      continue;
    }
    consumedNisnInBatch.add(p.nisn);
    pending.push(p);
  }

  const warnings: ImportWarning[] = [];

  if (pending.length > 0) {
    const quota = await assertCanAddStudents(schoolId, pending.length);
    if (!quota.ok) {
      return {
        imported: 0,
        classesCreated,
        skipped: [
          ...skipped,
          ...pending.map((p) => ({
            row: p.excelRow,
            nisn: p.nisn,
            name: p.name,
            reason: quota.message,
          })),
        ],
        warnings: [],
      };
    }

    await prisma.student.createMany({
      data: pending.map((p) => ({
        schoolId,
        nisn: p.nisn,
        name: p.name,
        gender: p.gender,
        birthPlace: p.birthPlace,
        birthDate: p.birthDate,
        className: p.className,
        classRoomId: p.classRoomId,
        nomorUjian: p.nomorUjian,
        ruangUjian: p.ruangUjian,
        parentGuardianName: p.parentGuardianName,
        sklLetterNumber: p.sklLetterNumber,
        nis: p.nis,
      })),
    });

    await recordStudentAdds(schoolId, pending.length);

    for (const p of pending) {
      const schoolName = otherSchoolByNisn.get(p.nisn);
      if (schoolName) {
        warnings.push({
          row: p.excelRow,
          nisn: p.nisn,
          name: p.name,
          message: `NISN juga terdaftar di ${schoolName}.`,
        });
      }
    }
  }

  return { imported: pending.length, classesCreated, skipped, warnings };
}

/** Satu batch impor (tanpa reload daftar) — dipakai UI progres bertahap. */
export async function importStudentsChunkAction(
  rows: unknown[],
): Promise<
  | {
      ok: true;
      imported: number;
      classesCreated: number;
      skipped: ImportSkip[];
      warnings: ImportWarning[];
      quota?: StudentQuotaPayload;
    }
  | { ok: false; message: string }
> {
  try {
    const { schoolId } = await requireTenantAdmin();
    const result = await importStudentsRowsCore(schoolId, rows);
    const snapAfter = await getSchoolAccessSnapshot(schoolId);

    const { revalidateTag } = await import("next/cache");
    revalidateTag(`rekap-${schoolId}`, "max");

    return {
      ok: true,
      imported: result.imported,
      classesCreated: result.classesCreated,
      skipped: result.skipped,
      warnings: result.warnings,
      quota: snapAfter.isSubscribed
        ? undefined
        : {
            studentAddsUsed: snapAfter.studentAddsUsed,
            studentAddsRemaining: snapAfter.studentAddsRemaining,
          },
    };
  } catch (e) {
    return { ok: false, message: (e as Error).message };
  }
}

export async function refreshStudentsListAction(): Promise<
  { ok: true; list: StudentListItem[] } | { ok: false; message: string }
> {
  try {
    const { schoolId } = await requireTenantAdmin();
    return { ok: true, list: await reloadStudents(schoolId) };
  } catch (e) {
    return { ok: false, message: (e as Error).message };
  }
}

export async function importStudentsAction(
  rows: unknown[],
): Promise<
  | {
      ok: true;
      list: StudentListItem[];
      imported: number;
      classesCreated: number;
      skipped: ImportSkip[];
      warnings: ImportWarning[];
    }
  | { ok: false; message: string }
> {
  try {
    const { schoolId } = await requireTenantAdmin();
    const { imported, classesCreated, skipped, warnings } =
      await importStudentsRowsCore(schoolId, rows);
    const list = await reloadStudents(schoolId);

    const { revalidateTag } = await import("next/cache");
    revalidateTag(`rekap-${schoolId}`, "max");

    return { ok: true, list, imported, classesCreated, skipped, warnings };
  } catch (e) {
    return { ok: false, message: (e as Error).message };
  }
}

/* ────────── Helper ────────── */

async function reloadStudents(schoolId: string): Promise<StudentListItem[]> {
  const where = await studentWhereAdminRosterActiveYear(schoolId);
  return studentsToRows(
    await prisma.student.findMany({
      where,
      include: {
        classRoom: true,
        user: { select: { isActive: true } },
      },
      orderBy: [{ className: "asc" }, { name: "asc" }],
    }),
  );
}
