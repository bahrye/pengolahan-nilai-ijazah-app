import { prisma } from "@/lib/prisma";
import { withTenantDb, type TenantDb } from "@/server/tenant-db-context";
import {
  buildSklDocumentData,
  isSklSystemDataReady,
  type SklDocumentData,
  type SklSchoolSnapshot,
  type SklStudentSnapshot,
} from "@/lib/skl/skl-document-data";
import { buildSklPdfBuffer } from "@/lib/skl/build-skl-pdf";
import { buildSklPreviewDocumentData } from "@/lib/skl/skl-preview-dummy";
import { loadSklGradesForStudent } from "@/lib/skl/skl-grades";

export type LoadSklPdfResult =
  | { ok: true; buffer: Buffer; filename: string }
  | { ok: false; status: number; message: string };

function mapSchool(row: {
  namaSekolah: string | null;
  npsn: string | null;
  nsm: string | null;
  jenjang: SklSchoolSnapshot["jenjang"];
  alamat: string | null;
  provinsi: string | null;
  tipeKabupaten: string;
  kabupaten: string | null;
  kecamatan: string | null;
  tipeKelurahan: string;
  kelurahan: string | null;
  kodePos: string | null;
  telepon: string | null;
  email: string | null;
  namaKepsek: string | null;
  nipKepsek: string | null;
  tahunLulusGlobal: number | null;
  printSignaturePlace: string | null;
  printLetterheadUrl: string | null;
  graduationAnnouncementAt: Date | null;
  sklIssuedAt: Date | null;
}): SklSchoolSnapshot {
  return {
    namaSekolah: row.namaSekolah ?? "",
    npsn: row.npsn,
    nsm: row.nsm,
    jenjang: row.jenjang,
    alamat: row.alamat,
    provinsi: row.provinsi,
    tipeKabupaten: row.tipeKabupaten,
    kabupaten: row.kabupaten,
    kecamatan: row.kecamatan,
    tipeKelurahan: row.tipeKelurahan,
    kelurahan: row.kelurahan,
    kodePos: row.kodePos,
    telepon: row.telepon,
    email: row.email,
    namaKepsek: row.namaKepsek,
    nipKepsek: row.nipKepsek,
    tahunLulusGlobal: row.tahunLulusGlobal,
    printSignaturePlace: row.printSignaturePlace,
    printLetterheadUrl: row.printLetterheadUrl,
    graduationAnnouncementAt: row.graduationAnnouncementAt,
    sklIssuedAt: row.sklIssuedAt,
  };
}

const schoolSelect = {
  namaSekolah: true,
  npsn: true,
  nsm: true,
  jenjang: true,
  alamat: true,
  provinsi: true,
  tipeKabupaten: true,
  kabupaten: true,
  kecamatan: true,
  tipeKelurahan: true,
  kelurahan: true,
  kodePos: true,
  telepon: true,
  email: true,
  namaKepsek: true,
  nipKepsek: true,
  tahunLulusGlobal: true,
  printSignaturePlace: true,
  printLetterheadUrl: true,
  graduationAnnouncementAt: true,
  sklIssuedAt: true,
} as const;

async function activeAcademicYearLabel(
  schoolId: string,
  db: TenantDb,
): Promise<string | null> {
  const year = await db.academicYear.findFirst({
    where: { schoolId, isActive: true },
    select: { label: true },
  });
  return year?.label ?? null;
}

export async function loadSklDocumentForStudent(
  schoolId: string,
  studentId: string,
): Promise<{ ok: true; data: SklDocumentData } | { ok: false; message: string }> {
  return withTenantDb(schoolId, async (db) => {
  const [school, student, academicYearLabel] = await Promise.all([
    db.school.findUnique({ where: { id: schoolId }, select: schoolSelect }),
    db.student.findFirst({
      where: { id: studentId, schoolId },
      select: {
        nisn: true,
        nis: true,
        nomorUjian: true,
        name: true,
        gender: true,
        birthPlace: true,
        birthDate: true,
        tahunLulus: true,
        sklLetterNumber: true,
        parentGuardianName: true,
        className: true,
        classRoom: { select: { name: true } },
      },
    }),
    activeAcademicYearLabel(schoolId, db),
  ]);

  if (!school || !student) {
    return { ok: false as const, message: "Data sekolah atau siswa tidak ditemukan." };
  }

  const schoolSnap = mapSchool(school);
  const studentSnap: SklStudentSnapshot = {
    nisn: student.nisn,
    nis: student.nis,
    nomorUjian: student.nomorUjian,
    name: student.name,
    gender: student.gender,
    birthPlace: student.birthPlace,
    birthDate: student.birthDate,
    tahunLulus: student.tahunLulus,
    sklLetterNumber: student.sklLetterNumber,
    parentGuardianName: student.parentGuardianName,
    classLabel: student.className ?? student.classRoom?.name ?? null,
  };

  if (!isSklSystemDataReady(schoolSnap, studentSnap)) {
    return {
      ok: false as const,
      message:
        "Data belum lengkap untuk SKL sistem. Lengkapi nama sekolah (menu Sekolah), nama & NISN siswa, serta nomor surat, ayah/wali laki-laki, dan NIS lokal (menu SKL Siswa).",
    };
  }

  const grades = await loadSklGradesForStudent(schoolId, studentId, db);

  return {
    ok: true as const,
    data: buildSklDocumentData({
      school: schoolSnap,
      student: studentSnap,
      academicYearLabel,
      grades,
    }),
  };
  });
}

export async function loadSklDocumentForPreview(
  schoolId: string,
  studentId: string,
): Promise<{ ok: true; data: SklDocumentData } | { ok: false; message: string }> {
  return withTenantDb(schoolId, async (db) => {
    const [school, student, academicYearLabel] = await Promise.all([
      db.school.findUnique({ where: { id: schoolId }, select: schoolSelect }),
      db.student.findFirst({
        where: { id: studentId, schoolId },
        select: {
          nisn: true,
          nis: true,
          nomorUjian: true,
          name: true,
          gender: true,
          birthPlace: true,
          birthDate: true,
          tahunLulus: true,
          sklLetterNumber: true,
          parentGuardianName: true,
          className: true,
          classRoom: { select: { name: true } },
        },
      }),
      activeAcademicYearLabel(schoolId, db),
    ]);

    if (!school || !student) {
      return { ok: false as const, message: "Data sekolah atau siswa tidak ditemukan." };
    }

    const schoolSnap = mapSchool(school);
    const studentSnap: SklStudentSnapshot = {
      nisn: student.nisn,
      nis: student.nis,
      nomorUjian: student.nomorUjian,
      name: student.name,
      gender: student.gender,
      birthPlace: student.birthPlace,
      birthDate: student.birthDate,
      tahunLulus: student.tahunLulus,
      sklLetterNumber: student.sklLetterNumber,
      parentGuardianName: student.parentGuardianName,
      classLabel: student.className ?? student.classRoom?.name ?? null,
    };

    const grades = await loadSklGradesForStudent(schoolId, studentId, db);
    const data = isSklSystemDataReady(schoolSnap, studentSnap)
      ? buildSklDocumentData({
          school: schoolSnap,
          student: studentSnap,
          academicYearLabel,
          grades,
        })
      : buildSklPreviewDocumentData({
          school: schoolSnap,
          student: studentSnap,
          academicYearLabel,
          grades,
        });

    return { ok: true as const, data };
  });
}

export async function buildSystemSklPdfForStudent(
  schoolId: string,
  studentId: string,
): Promise<LoadSklPdfResult> {
  const loaded = await loadSklDocumentForStudent(schoolId, studentId);
  if (!loaded.ok) {
    return { ok: false, status: 404, message: loaded.message };
  }

  const buffer = await buildSklPdfBuffer(loaded.data);
  const nisn = loaded.data.student.nisn.replace(/\D/g, "").slice(0, 10);
  return { ok: true, buffer, filename: `${nisn}.pdf` };
}

/** Pratinjau admin: pakai data asli jika lengkap; jika tidak, isi contoh untuk siswa pertama. */
export async function buildSystemSklPdfPreviewForStudent(
  schoolId: string,
  studentId: string,
): Promise<LoadSklPdfResult> {
  const loaded = await loadSklDocumentForPreview(schoolId, studentId);
  if (!loaded.ok) {
    return { ok: false, status: 404, message: loaded.message };
  }

  try {
    const buffer = await buildSklPdfBuffer(loaded.data);
    const nisn = loaded.data.student.nisn.replace(/\D/g, "").slice(0, 10);
    return { ok: true, buffer, filename: `preview-${nisn}.pdf` };
  } catch (err) {
    console.error("[skl-preview] buildSklPdfBuffer failed", err);
    return {
      ok: false,
      status: 500,
      message: "Gagal membuat PDF pratinjau SKL. Coba lagi atau hubungi dukungan.",
    };
  }
}

export async function buildSystemSklPdfForStudentUser(
  userId: string,
): Promise<LoadSklPdfResult> {
  const student = await prisma.student.findFirst({
    where: { userId, isActive: true },
    select: { id: true, schoolId: true },
  });
  if (!student?.schoolId) {
    return { ok: false, status: 404, message: "Data siswa tidak ditemukan." };
  }
  return buildSystemSklPdfForStudent(student.schoolId, student.id);
}
