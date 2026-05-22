"use server";

import bcrypt from "bcryptjs";
import { z } from "zod";

import { prisma } from "@/lib/prisma";
import { cancelTugasTambahanRequestsForPengajarOnHost } from "@/server/guru-tugas-request-sync";
import { requireTenantAdmin } from "@/server/session";

async function assertSatminkalForCredentialManagement(adminSchoolId: string) {
  const s = await prisma.school.findUnique({
    where: { id: adminSchoolId },
    select: { isSatminkal: true, namaSekolah: true },
  });
  if (!s?.isSatminkal) {
    throw new Error(
      "Sekolah Anda bukan satminkal — tidak dapat menambah guru lewat email, impor, reset sandi, atau kartu login. Gunakan menu Tugas tambahan guru.",
    );
  }
}

/** Kartu login / reset sandi / edit akun hanya untuk guru induk tenant (`User.schoolId` = sekolah admin). */
function assertTeacherIsIndukDiTenant(
  teacher: { user: { schoolId: string | null } },
  tenantSchoolId: string,
) {
  if (teacher.user.schoolId !== tenantSchoolId) {
    throw new Error(
      "Guru ini pengajar tambahan (badge Non-Satminkal) — sandi, kartu login, dan edit akun hanya di sekolah induk guru.",
    );
  }
}

const teacherSchema = z.object({
  email: z.string().email(),
  nama: z.string().min(1),
  nip: z.string().optional().nullable(),
});

function randomPin8(): string {
  return String(Math.floor(10000000 + Math.random() * 90000000));
}

export async function upsertTeacherAction(
  raw: z.infer<typeof teacherSchema>,
): Promise<{ ok: true; teacherId: string } | { ok: false; message: string }> {
  let data: z.infer<typeof teacherSchema>;
  try {
    data = teacherSchema.parse(raw);
  } catch {
    return { ok: false, message: "Data tidak valid." };
  }
  try {
    const { schoolId } = await requireTenantAdmin();
    await assertSatminkalForCredentialManagement(schoolId);
    const email = data.email.trim().toLowerCase();

    let user = await prisma.user.findUnique({
      where: { email },
      include: { school: { select: { namaSekolah: true } } },
    });
    let pin: string | null = null;

    if (!user) {
      pin = randomPin8();
      const passwordHash = await bcrypt.hash(pin, 12);
      user = await prisma.user.create({
        data: {
          email,
          name: data.nama.trim(),
          schoolId,
          role: "GURU",
          passwordHash,
          isActive: true,
        },
        include: { school: { select: { namaSekolah: true } } },
      });
    } else if (user.role === "ADMIN_SEKOLAH" || user.role === "SUPERADMIN") {
      return {
        ok: false,
        message: `Email ini adalah akun admin dan tidak bisa didaftarkan sebagai guru. Gunakan email lain.`,
      };
    } else if (user.schoolId && user.schoolId !== schoolId) {
      const schoolName = user.school?.namaSekolah ?? "sekolah lain";
      return {
        ok: false,
        message: `Email ini sudah terdaftar di ${schoolName}. Silakan gunakan email lain.`,
      };
    } else {
      await prisma.user.update({
        where: { id: user.id },
        data: { schoolId, role: "GURU", name: data.nama.trim() },
      });
    }

    await prisma.teacher.upsert({
      where: {
        schoolId_userId: {
          schoolId,
          userId: user.id,
        },
      },
      create: {
        schoolId,
        userId: user.id,
        nama: data.nama.trim(),
        nip: data.nip?.trim() || null,
        usesDefaultLoginPin: true,
        ...(pin ? { lastPlainPassword: pin } : {}),
      },
      update: {
        nama: data.nama.trim(),
        nip: data.nip?.trim() || null,
        schoolId,
      },
    });

    const teacher = await prisma.teacher.findUniqueOrThrow({
      where: {
        schoolId_userId: {
          schoolId,
          userId: user.id,
        },
      },
      select: { id: true },
    });
    return { ok: true, teacherId: teacher.id };
  } catch (e) {
    return { ok: false, message: (e as Error).message };
  }
}

const importTeacherRowSchema = z.object({
  email: z.string().email("Format email tidak valid."),
  nama: z.string().min(1, "Nama wajib diisi."),
  nip: z.string().optional().nullable(),
  mapelPilihan: z.string().optional().nullable(),
  kelasPilihan: z.string().optional().nullable(),
});

export type TeacherImportRowInput = z.infer<typeof importTeacherRowSchema>;

/**
 * Impor banyak guru dari baris Excel (sudah divalidasi di klien).
 * Email boleh berulang (satu guru, beberapa penugasan mapel/kelas). Nama harus sama di semua baris untuk email itu; NIP jika diisi harus konsisten (baris kosong boleh dicampur dengan satu nilai).
 * Mapel & kelas opsional; jika salah satu diisi, keduanya wajib cocok referensi.
 */
export async function importTeachersBulkAction(
  rawRows: unknown[],
): Promise<
  | { ok: true; imported: number; assignmentsUpserted: number }
  | { ok: false; message: string }
> {
  const { schoolId } = await requireTenantAdmin();
  await assertSatminkalForCredentialManagement(schoolId);

  const rows: z.infer<typeof importTeacherRowSchema>[] = [];
  let rowIndex = 0;
  for (const raw of rawRows) {
    rowIndex += 1;
    if (!raw || typeof raw !== "object") continue;
    const o = raw as Record<string, unknown>;
    const email = String(o.email ?? "").trim();
    const nama = String(o.nama ?? "").trim();
    if (!email && !nama) continue;

    const parsed = importTeacherRowSchema.safeParse({
      email: o.email,
      nama: o.nama,
      nip: o.nip === "" || o.nip == null ? null : o.nip,
      mapelPilihan: o.mapelPilihan === "" || o.mapelPilihan == null ? null : o.mapelPilihan,
      kelasPilihan: o.kelasPilihan === "" || o.kelasPilihan == null ? null : o.kelasPilihan,
    });
    if (!parsed.success) {
      const msg = parsed.error.issues[0]?.message ?? "Data tidak valid.";
      return { ok: false, message: `Baris data ke-${rowIndex}: ${msg}` };
    }
    rows.push(parsed.data);
  }

  if (rows.length === 0) {
    return { ok: false, message: "Tidak ada baris berisi email dan nama untuk diimpor." };
  }

  function normNip(n: string | null | undefined): string {
    return (n ?? "").trim();
  }

  const byEmailKey = new Map<string, typeof rows>();
  for (const r of rows) {
    const k = r.email.trim().toLowerCase();
    if (!byEmailKey.has(k)) byEmailKey.set(k, []);
    const bucket = byEmailKey.get(k);
    if (bucket) bucket.push(r);
  }

  for (const [emailKey, group] of byEmailKey) {
    if (group.length <= 1) continue;
    const namas = new Set(group.map((g) => g.nama.trim()));
    if (namas.size > 1) {
      return {
        ok: false,
        message: `Email "${emailKey}" muncul di beberapa baris dengan nama yang berbeda. Samakan nama untuk guru yang sama, atau gunakan email berbeda.`,
      };
    }
    const nips = new Set(group.map((g) => normNip(g.nip)).filter(Boolean));
    if (nips.size > 1) {
      return {
        ok: false,
        message: `Email "${emailKey}" muncul di beberapa baris dengan NIP yang berbeda. Samakan NIP atau kosongkan yang tidak perlu.`,
      };
    }
  }

  const mergedNipByEmail = new Map<string, string | null>();
  for (const [emailKey, group] of byEmailKey) {
    const nonEmpty = group.map((g) => normNip(g.nip)).filter(Boolean);
    mergedNipByEmail.set(emailKey, nonEmpty[0] ?? null);
  }

  const activeYear = await prisma.academicYear.findFirst({
    where: { schoolId, isActive: true },
  });
  const yearLabel = activeYear?.label ?? "TA";

  const [subjects, classRooms] = await Promise.all([
    prisma.subject.findMany({ where: { schoolId }, orderBy: { code: "asc" } }),
    activeYear
      ? prisma.classRoom.findMany({
          where: { academicYearId: activeYear.id },
          orderBy: { name: "asc" },
        })
      : [],
  ]);

  const subjectByPick = new Map<string, string>();
  for (const s of subjects) {
    const label = `${s.code} — ${s.name}`;
    subjectByPick.set(label, s.id);
    subjectByPick.set(label.trim(), s.id);
    subjectByPick.set(s.code.trim().toLowerCase(), s.id);
    subjectByPick.set(s.code.trim().toUpperCase(), s.id);
  }

  const classByPick = new Map<string, string>();
  for (const c of classRooms) {
    const display = `${c.name} (${yearLabel})`;
    classByPick.set(display, c.id);
    classByPick.set(display.trim(), c.id);
    classByPick.set(c.name.trim(), c.id);
  }

  let imported = 0;
  let assignmentsUpserted = 0;
  const teacherIdsCounted = new Set<string>();

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const label = `Baris ${i + 1} (${row.email.trim()})`;
    const emailKey = row.email.trim().toLowerCase();
    const nipForUpsert = mergedNipByEmail.get(emailKey) ?? null;

    const up = await upsertTeacherAction({
      email: row.email,
      nama: row.nama,
      nip: nipForUpsert,
    });
    if (!up.ok) return { ok: false, message: `${label}: ${up.message}` };
    if (!teacherIdsCounted.has(up.teacherId)) {
      teacherIdsCounted.add(up.teacherId);
      imported += 1;
    }

    const mp = (row.mapelPilihan ?? "").trim();
    const kp = (row.kelasPilihan ?? "").trim();
    if (!mp && !kp) continue;
    if (!mp || !kp) {
      return {
        ok: false,
        message: `${label}: kolom Pilih mapel dan Pilih kelas harus keduanya diisi (atau keduanya dikosongkan).`,
      };
    }

    const subjectId = subjectByPick.get(mp) ?? subjectByPick.get(mp.trim());
    if (!subjectId) {
      return {
        ok: false,
        message: `${label}: nilai Pilih mapel tidak dikenali. Salin persis dari sheet Referensi_mapel (kolom B).`,
      };
    }
    const classRoomId = classByPick.get(kp) ?? classByPick.get(kp.trim());
    if (!classRoomId) {
      return {
        ok: false,
        message: `${label}: nilai Pilih kelas tidak dikenali. Salin persis dari sheet Referensi_kelas (kolom B).`,
      };
    }

    try {
      await prisma.teachingAssignment.upsert({
        where: {
          teacherId_subjectId_classRoomId: {
            teacherId: up.teacherId,
            subjectId,
            classRoomId,
          },
        },
        create: {
          schoolId,
          teacherId: up.teacherId,
          subjectId,
          classRoomId,
        },
        update: {},
      });
      assignmentsUpserted += 1;
    } catch (e) {
      return {
        ok: false,
        message: `${label}: gagal menyimpan penugasan. ${(e as Error).message}`,
      };
    }
  }

  return { ok: true, imported, assignmentsUpserted };
}

export async function listTeachersAction() {
  const { schoolId } = await requireTenantAdmin();
  return prisma.teacher.findMany({
    where: { schoolId },
    include: { user: true, assignments: { include: { subject: true, classRoom: true } } },
    orderBy: { nama: "asc" },
  });
}

/* ────────── Edit guru ────────── */

const editTeacherSchema = z.object({
  teacherId: z.string().min(1),
  nama: z.string().min(1),
  nip: z.string().optional().nullable(),
  email: z.string().email(),
});

export async function editTeacherAction(
  raw: z.infer<typeof editTeacherSchema>,
): Promise<{ ok: true } | { ok: false; message: string }> {
  let data: z.infer<typeof editTeacherSchema>;
  try {
    data = editTeacherSchema.parse(raw);
  } catch {
    return { ok: false, message: "Data tidak valid." };
  }
  try {
    const { schoolId } = await requireTenantAdmin();
    const school = await prisma.school.findUnique({
      where: { id: schoolId },
      select: { isSatminkal: true },
    });
    if (!school?.isSatminkal) {
      return {
        ok: false,
        message: "Sekolah non-satminkal tidak dapat mengubah data guru (nama, email, NIP).",
      };
    }

    const teacher = await prisma.teacher.findFirst({
      where: { id: data.teacherId, schoolId },
      include: { user: true },
    });
    if (!teacher) return { ok: false, message: "Guru tidak ditemukan." };
    assertTeacherIsIndukDiTenant(teacher, schoolId);

    const nextEmail = data.email.trim().toLowerCase();

    await prisma.teacher.update({
      where: { id: teacher.id },
      data: { nama: data.nama.trim(), nip: data.nip?.trim() || null },
    });

    await prisma.user.update({
      where: { id: teacher.userId },
      data: { name: data.nama.trim(), email: nextEmail },
    });

    return { ok: true };
  } catch (e) {
    return { ok: false, message: (e as Error).message };
  }
}

/* ────────── Nonaktifkan / aktifkan guru ────────── */

export async function toggleTeacherActiveAction(
  payload: { teacherId: string },
): Promise<{ ok: true; isActive: boolean } | { ok: false; message: string }> {
  try {
    const { schoolId } = await requireTenantAdmin();
    const teacher = await prisma.teacher.findFirst({
      where: { id: payload.teacherId, schoolId },
      include: { user: true },
    });
    if (!teacher) return { ok: false, message: "Guru tidak ditemukan." };

    if (teacher.user.schoolId !== schoolId) {
      return {
        ok: false,
        message:
          "Guru pengajar tambahan (non-satminkal) tidak dapat dinonaktifkan dari sekolah ini — kelola akun di sekolah induk guru atau batalkan penugasan non-satminkal.",
      };
    }

    const newStatus = !teacher.user.isActive;
    await prisma.user.update({
      where: { id: teacher.userId },
      data: { isActive: newStatus },
    });

    return { ok: true, isActive: newStatus };
  } catch (e) {
    return { ok: false, message: (e as Error).message };
  }
}

/**
 * Batalkan penugasan guru sebagai pengajar tambahan di tenant ini: menghapus baris `Teacher`
 * beserta penugasan mapel. Dipakai admin sekolah non-satminkal maupun admin satminkal (untuk
 * kartu badge Non-Satminkal). Akun `User` di sekolah induk tidak dihapus.
 */
export async function removeTeacherFromNonSatminkalSchoolAction(
  payload: { teacherId: string },
): Promise<{ ok: true } | { ok: false; message: string }> {
  try {
    const { schoolId, userId } = await requireTenantAdmin();
    const teacher = await prisma.teacher.findFirst({
      where: { id: payload.teacherId, schoolId },
      include: { user: true },
    });
    if (!teacher) return { ok: false, message: "Guru tidak ditemukan." };

    if (teacher.user.schoolId === schoolId) {
      return {
        ok: false,
        message:
          "Guru ini adalah induk di sekolah ini. Untuk mengubah atau menghapus akun induk, gunakan menu pengelolaan guru induk.",
      };
    }

    const otherTeachers = await prisma.teacher.count({
      where: { userId: teacher.userId, id: { not: teacher.id } },
    });
    if (otherTeachers === 0) {
      return {
        ok: false,
        message: "Tidak dapat menghapus: ini satu-satunya penugasan guru di seluruh sekolah.",
      };
    }

    await prisma.$transaction(async (tx) => {
      await tx.user.updateMany({
        where: { id: teacher.userId, activeSchoolId: schoolId },
        data: { activeSchoolId: null },
      });
      await tx.teacher.delete({ where: { id: teacher.id } });
      await cancelTugasTambahanRequestsForPengajarOnHost(tx, {
        hostSchoolId: schoolId,
        pengajarUserId: teacher.userId,
        homeSchoolId: teacher.user.schoolId,
        decidedByUserId: userId,
        decidedBySchoolId: schoolId,
        rejectReason:
          "Penugasan dihapus dari sekolah tujuan; permohonan tugas tambahan ditutup otomatis.",
      });
    });

    return { ok: true };
  } catch (e) {
    return { ok: false, message: (e as Error).message };
  }
}

/* ────────── Buat Kartu Login (read-only, no password change) ────────── */

export async function getTeacherLoginCardAction(
  payload: { teacherId: string },
): Promise<
  | { ok: true; nama: string; email: string; password: string }
  | { ok: false; message: string }
> {
  try {
    const { schoolId } = await requireTenantAdmin();
    await assertSatminkalForCredentialManagement(schoolId);
    const teacher = await prisma.teacher.findFirst({
      where: { id: payload.teacherId, schoolId },
      include: { user: true },
    });
    if (!teacher) return { ok: false, message: "Guru tidak ditemukan." };
    assertTeacherIsIndukDiTenant(teacher, schoolId);

    if (!teacher.usesDefaultLoginPin) {
      return {
        ok: false,
        message:
          "Guru ini sudah mengubah sandi lewat menu Ubah Password. Cetak kartu login (PIN) dinonaktifkan. Gunakan Reset sandi bila perlu PIN baru untuk kartu.",
      };
    }

    if (!teacher.lastPlainPassword) {
      return {
        ok: false,
        message:
          "PIN kartu belum tersimpan. Gunakan 'Reset Password' atau generate kartu massal untuk membuat PIN baru.",
      };
    }

    return {
      ok: true,
      nama: teacher.nama,
      email: teacher.user.email,
      password: teacher.lastPlainPassword,
    };
  } catch (e) {
    return { ok: false, message: (e as Error).message };
  }
}

/**
 * Kartu login: pakai password tersimpan jika ada; jika belum, reset PIN (satu round-trip untuk bulk generate).
 */
export async function ensureTeacherLoginCardAction(
  payload: { teacherId: string },
): Promise<
  | { ok: true; nama: string; email: string; password: string; wasReset: boolean }
  | { ok: false; message: string }
> {
  try {
    const { schoolId } = await requireTenantAdmin();
    await assertSatminkalForCredentialManagement(schoolId);
    const teacher = await prisma.teacher.findFirst({
      where: { id: payload.teacherId, schoolId },
      include: { user: true },
    });
    if (!teacher) return { ok: false, message: "Guru tidak ditemukan." };
    assertTeacherIsIndukDiTenant(teacher, schoolId);

    if (!teacher.usesDefaultLoginPin) {
      return {
        ok: false,
        message:
          "Guru ini memakai sandi kustom (bukan PIN kartu). Cetak kartu login dinonaktifkan. Gunakan Reset sandi untuk membuat PIN baru.",
      };
    }

    if (teacher.lastPlainPassword) {
      return {
        ok: true,
        nama: teacher.nama,
        email: teacher.user.email,
        password: teacher.lastPlainPassword,
        wasReset: false,
      };
    }

    const pin = randomPin8();
    const passwordHash = await bcrypt.hash(pin, 12);

    await prisma.user.update({
      where: { id: teacher.userId },
      data: { passwordHash, isActive: true },
    });

    await prisma.teacher.update({
      where: { id: teacher.id },
      data: { lastPlainPassword: pin, usesDefaultLoginPin: true },
    });

    return {
      ok: true,
      nama: teacher.nama,
      email: teacher.user.email,
      password: pin,
      wasReset: true,
    };
  } catch (e) {
    return { ok: false, message: (e as Error).message };
  }
}

/* ────────── Reset password guru ────────── */

export async function resetTeacherPasswordAction(
  payload: { teacherId: string },
): Promise<
  | { ok: true; nama: string; email: string; newPassword: string }
  | { ok: false; message: string }
> {
  try {
    const { schoolId } = await requireTenantAdmin();
    await assertSatminkalForCredentialManagement(schoolId);
    const teacher = await prisma.teacher.findFirst({
      where: { id: payload.teacherId, schoolId },
      include: { user: true },
    });
    if (!teacher) return { ok: false, message: "Guru tidak ditemukan." };
    assertTeacherIsIndukDiTenant(teacher, schoolId);

    const pin = randomPin8();
    const passwordHash = await bcrypt.hash(pin, 12);

    await prisma.user.update({
      where: { id: teacher.userId },
      data: { passwordHash, isActive: true },
    });

    await prisma.teacher.update({
      where: { id: teacher.id },
      data: { lastPlainPassword: pin, usesDefaultLoginPin: true },
    });

    return { ok: true, nama: teacher.nama, email: teacher.user.email, newPassword: pin };
  } catch (e) {
    return { ok: false, message: (e as Error).message };
  }
}
