"use server";

import { z } from "zod";

import { SCORE_TYPE } from "@/domain/scoreTypes";
import { EXAM_SEMESTER_KEY } from "@/lib/examSemester";
import {
  examAverageFromParts,
  examScoreTypesForSubjectJenis,
  formatExamNilaiPrint,
  roundExamNilaiForPrint,
} from "@/lib/exam-nilai-display";
import { EXAM_NILAI_TEACHER_PRINT_BLOCKED_MSG } from "@/lib/exam-nilai-print-messages";
import { EXAM_NILAI_EMPTY_ROOM_KEY } from "@/lib/exam-nilai-room";
import {
  kepalaSekolahLabel,
  nilaiUjianDocHeading,
  nilaiUjianDocHeadingUpper,
} from "@/lib/school-terminology";
import { normalizeTimeZone } from "@/lib/indonesia-timezone";
import { nilaiUjianToTerbilang } from "@/lib/terbilang-indonesia";
import { prisma } from "@/lib/prisma";
import { requireTenantAdmin, requireUserSchoolId } from "@/server/session";

import type { SchoolLevel } from "@prisma/client";

const previewSchema = z.object({
  subjectId: z.string().min(1),
  classRoomId: z.string().min(1, "Pilih kelas."),
  ruangKey: z.string().min(1, "Pilih ruang ujian."),
  /** IANA (mis. Asia/Makassar) — sama dengan zona perangkat; selaras kolom Tanggal kirim. */
  displayTimeZone: z.string().max(120).optional(),
});

const subjectClassSchema = z.object({
  subjectId: z.string().min(1),
  classRoomId: z.string().min(1),
});

const BULAN_ID = [
  "Januari",
  "Februari",
  "Maret",
  "April",
  "Mei",
  "Juni",
  "Juli",
  "Agustus",
  "September",
  "Oktober",
  "November",
  "Desember",
] as const;

function safeDisplayTimeZone(raw: string | undefined): string {
  if (raw == null) return normalizeTimeZone(null);
  const t = raw.trim();
  if (t.length < 2 || t.length > 120) return normalizeTimeZone(null);
  return normalizeTimeZone(t);
}

/** Tanggal kalender di zona IANA yang dipilih (biasanya zona perangkat pengguna). */
function formatTanggalIndonesia(d: Date, timeZone: string): string {
  if (Number.isNaN(d.getTime())) return "";
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone,
      day: "numeric",
      month: "numeric",
      year: "numeric",
    }).formatToParts(d);
    const day = Number(parts.find((p) => p.type === "day")?.value);
    const monthNum = Number(parts.find((p) => p.type === "month")?.value);
    const year = Number(parts.find((p) => p.type === "year")?.value);
    if (!Number.isFinite(day) || !Number.isFinite(monthNum) || !Number.isFinite(year)) return "";
    const monthIndex = monthNum - 1;
    return `${day} ${BULAN_ID[monthIndex] ?? ""} ${year}`;
  } catch {
    return `${d.getDate()} ${BULAN_ID[d.getMonth()] ?? ""} ${d.getFullYear()}`;
  }
}

/** Banyak baris yang masih dipakai kertas A4; di atas ambang ini memakai Legal. */
const LEGAL_ROW_THRESHOLD = 22;

export type PrintPaperSize = "A4" | "LEGAL";

export type ExamNilaiPrintRow = {
  no: number;
  nomorUjian: string;
  nisn: string;
  nama: string;
  nilai: string;
  keterangan: string;
};

export type ExamNilaiPrintPreview = {
  subjectName: string;
  subjectCode: string;
  jenisUjian: string;
  /** Judul dokumen sesuai jenjang (Ujian Madrasah / Ujian Sekolah). */
  examDocHeading: string;
  examDocHeadingUpper: string;
  tahunAjaranLabel: string;
  guruPemeriksaLine: string;
  primaryGuru: { nama: string; nip: string | null };
  otherGuruCount: number;
  ruangUjianLabel: string;
  /** Nama kelas (ruang cetak dibatasi ke kelas yang dipilih). */
  kelasLabel: string;
  paperSize: PrintPaperSize;
  compact: boolean;
  rows: ExamNilaiPrintRow[];
  letterheadUrl: string | null;
  tanggalCetakLine: string;
  headLabel: "Kepala Madrasah" | "Kepala Sekolah";
  namaKepala: string | null;
  nipKepala: string | null;
};

export type ExamNilaiRuangOption = { key: string; label: string };

async function classIdsFromAssignments(
  schoolId: string,
  subjectId: string,
  teacherId?: string,
  restrictToClassRoomId?: string,
): Promise<string[]> {
  const assigns = await prisma.teachingAssignment.findMany({
    where: {
      schoolId,
      subjectId,
      ...(teacherId ? { teacherId } : {}),
      ...(restrictToClassRoomId ? { classRoomId: restrictToClassRoomId } : {}),
    },
    select: { classRoomId: true },
  });
  return [...new Set(assigns.map((a) => a.classRoomId))];
}

async function distinctRuangFromClassStudents(
  schoolId: string,
  classIds: string[],
): Promise<ExamNilaiRuangOption[]> {
  if (classIds.length === 0) return [];
  const students = await prisma.student.findMany({
    where: { schoolId, isActive: true, classRoomId: { in: classIds } },
    select: { ruangUjian: true },
  });
  const map = new Map<string, ExamNilaiRuangOption>();
  for (const s of students) {
    const rawR = s.ruangUjian?.trim() ?? "";
    if (rawR === "") {
      map.set(EXAM_NILAI_EMPTY_ROOM_KEY, { key: EXAM_NILAI_EMPTY_ROOM_KEY, label: "(Belum diisi)" });
    } else if (!map.has(rawR)) {
      map.set(rawR, { key: rawR, label: rawR });
    }
  }
  return [...map.values()].sort((a, b) => a.label.localeCompare(b.label, "id"));
}

/**
 * Nilai/cetak ujian harus konsisten dengan tahun ajaran aktif —
 * menghindari permintaan client yang menyasar kelas TA lama / ID yang tidak valid.
 */
async function resolveActiveExamClassRoom(
  schoolId: string,
  classRoomId: string,
): Promise<{ ok: true; kelasLabel: string } | { ok: false; message: string }> {
  const hasActiveYear = await prisma.academicYear.findFirst({
    where: { schoolId, isActive: true },
    select: { id: true },
  });
  if (!hasActiveYear) {
    return { ok: false, message: "Belum ada tahun ajaran aktif." };
  }
  const row = await prisma.classRoom.findFirst({
    where: { id: classRoomId, schoolId },
    select: {
      name: true,
      academicYear: { select: { isActive: true } },
    },
  });
  if (!row) {
    return { ok: false, message: "Kelas tidak ditemukan." };
  }
  if (!row.academicYear.isActive) {
    return { ok: false, message: "Kelas tidak pada tahun ajaran aktif." };
  }
  const kelasLabel = row.name.trim() || "—";
  return { ok: true, kelasLabel };
}

function ruangLabel(ruangKey: string): string {
  if (ruangKey === EXAM_NILAI_EMPTY_ROOM_KEY) return "(Belum diisi)";
  return ruangKey.trim() || "—";
}

export async function listExamNilaiRuangOptionsAction(
  raw: unknown,
): Promise<{ ok: true; options: ExamNilaiRuangOption[] } | { ok: false; message: string }> {
  try {
    const { schoolId } = await requireTenantAdmin();
    const parsed = subjectClassSchema.safeParse(raw);
    if (!parsed.success) {
      return { ok: false, message: "Kelas atau mapel tidak valid." };
    }
    const { subjectId, classRoomId } = parsed.data;
    const classGate = await resolveActiveExamClassRoom(schoolId, classRoomId);
    if (!classGate.ok) return classGate;

    const classIds = await classIdsFromAssignments(schoolId, subjectId, undefined, classRoomId);
    const options = await distinctRuangFromClassStudents(schoolId, classIds);
    return { ok: true, options };
  } catch (e) {
    return { ok: false, message: (e as Error).message };
  }
}

export async function listExamNilaiRuangOptionsTeacherAction(
  raw: unknown,
): Promise<
  { ok: true; options: ExamNilaiRuangOption[]; nilaiSudahDikirim: boolean } | { ok: false; message: string }
> {
  try {
    const ctx = await requireUserSchoolId();
    if (ctx.role !== "GURU") {
      return { ok: false, message: "Hanya untuk akun guru." };
    }
    const teacher = await prisma.teacher.findFirst({
      where: { userId: ctx.userId, schoolId: ctx.schoolId },
      select: { id: true },
    });
    if (!teacher) {
      return { ok: false, message: "Data guru tidak ditemukan." };
    }
    const parsed = subjectClassSchema.safeParse(raw);
    if (!parsed.success) {
      return { ok: false, message: "Kelas atau mapel tidak valid." };
    }
    const { subjectId, classRoomId } = parsed.data;

    const teaches = await prisma.teachingAssignment.findFirst({
      where: {
        schoolId: ctx.schoolId,
        subjectId,
        teacherId: teacher.id,
        classRoomId,
      },
      select: { id: true },
    });

    const isHomeroom = await prisma.classRoom.findFirst({
      where: { id: classRoomId, schoolId: ctx.schoolId, homeroomTeacherId: teacher.id },
      select: { id: true },
    });

    const lock = await prisma.examScoreLock.findUnique({
      where: { schoolId_subjectId: { schoolId: ctx.schoolId, subjectId } },
      select: { id: true },
    });

    if (!teaches) {
      if (!isHomeroom || !lock) {
        return { ok: false, message: "Mapel ini di luar penugasan mengajar Anda (atau nilai belum dikirim)." };
      }
    }

    const classGate = await resolveActiveExamClassRoom(ctx.schoolId, classRoomId);
    if (!classGate.ok) return classGate;

    const classIds = await classIdsFromAssignments(ctx.schoolId, subjectId, teaches ? teacher.id : undefined, classRoomId);
    const options = await distinctRuangFromClassStudents(ctx.schoolId, classIds);
    return { ok: true, options, nilaiSudahDikirim: Boolean(lock) };
  } catch (e) {
    return { ok: false, message: (e as Error).message };
  }
}

type PrintScope = {
  restrictTeacherId?: string;
  /** Guru: wajib ada ExamScoreLock. Admin: tidak wajib. */
  requireSubmittedLock: boolean;
};

async function runExamNilaiPrintPreview(
  schoolId: string,
  subjectId: string,
  classRoomId: string,
  ruangKey: string,
  scope: PrintScope,
  displayTimeZone: string,
): Promise<{ ok: true; data: ExamNilaiPrintPreview } | { ok: false; message: string }> {
  const lock = await prisma.examScoreLock.findUnique({
    where: { schoolId_subjectId: { schoolId, subjectId } },
    select: { lockedAt: true },
  });

  if (scope.requireSubmittedLock && !lock) {
    return { ok: false, message: EXAM_NILAI_TEACHER_PRINT_BLOCKED_MSG };
  }

  const classGate = await resolveActiveExamClassRoom(schoolId, classRoomId);
  if (!classGate.ok) return classGate;
  const kelasLabel = classGate.kelasLabel;

  const assignWhere = {
    schoolId,
    subjectId,
    classRoomId,
    ...(scope.restrictTeacherId ? { teacherId: scope.restrictTeacherId } : {}),
  };

  const [subject, school, activeYear, assigns] = await Promise.all([
    prisma.subject.findFirst({
      where: { id: subjectId, schoolId },
      select: { id: true, name: true, code: true, jenisUjian: true },
    }),
    prisma.school.findUnique({
      where: { id: schoolId },
      select: {
        jenjang: true,
        namaKepsek: true,
        nipKepsek: true,
        printLetterheadUrl: true,
        printSignaturePlace: true,
        printDateMode: true,
        printManualDate: true,
      },
    }),
    prisma.academicYear.findFirst({
      where: { schoolId, isActive: true },
      select: { label: true },
    }),
    prisma.teachingAssignment.findMany({
      where: assignWhere,
      select: { classRoomId: true, teacherId: true },
    }),
  ]);

  if (!subject) {
    return { ok: false, message: "Mapel tidak ditemukan." };
  }
  if (!school) {
    return { ok: false, message: "Data sekolah tidak ditemukan." };
  }

  if (assigns.length === 0) {
    return { ok: false, message: "Tidak ada penugasan mapel untuk kelas ini." };
  }

  const classIds = [...new Set(assigns.map((a) => a.classRoomId))];
  const teacherIds = [...new Set(assigns.map((a) => a.teacherId))];

  const teachers =
    teacherIds.length > 0
      ? await prisma.teacher.findMany({
          where: { id: { in: teacherIds }, schoolId },
          orderBy: { nama: "asc" },
          select: { nama: true, nip: true },
        })
      : [];

  const guruPemeriksaLine = teachers.map((t) => t.nama.trim()).filter(Boolean).join(", ") || "—";
  const primaryGuru = teachers[0]
    ? { nama: teachers[0].nama.trim(), nip: teachers[0].nip?.trim() || null }
    : { nama: "—", nip: null as string | null };
  const otherGuruCount = Math.max(0, teachers.length - 1);

  let tanggalObj: Date;
  if (school.printDateMode === "MANUAL" && school.printManualDate) {
    tanggalObj = new Date(school.printManualDate);
  } else {
    tanggalObj = lock?.lockedAt ? new Date(lock.lockedAt) : new Date();
  }
  const tglStr = formatTanggalIndonesia(tanggalObj, displayTimeZone);
  const place = school.printSignaturePlace?.trim() ?? "";
  const tanggalCetakLine = place ? `${place}, ${tglStr}` : tglStr;

  const tahunLabel = activeYear?.label?.trim() || "—";
  const examDocHeading = nilaiUjianDocHeading(school.jenjang, tahunLabel);
  const examDocHeadingUpper = nilaiUjianDocHeadingUpper(school.jenjang, tahunLabel);

  const basePreview = (rows: ExamNilaiPrintRow[]): ExamNilaiPrintPreview => {
    const paperSize: PrintPaperSize = rows.length > LEGAL_ROW_THRESHOLD ? "LEGAL" : "A4";
    const compact = paperSize === "A4" ? rows.length >= 14 : rows.length >= 32;
    return {
      subjectName: subject.name,
      subjectCode: subject.code,
      jenisUjian: subject.jenisUjian,
      examDocHeading,
      examDocHeadingUpper,
      tahunAjaranLabel: tahunLabel,
      guruPemeriksaLine,
      primaryGuru,
      otherGuruCount,
      ruangUjianLabel: ruangLabel(ruangKey),
      kelasLabel,
      paperSize,
      compact,
      rows,
      letterheadUrl: school.printLetterheadUrl,
      tanggalCetakLine,
      headLabel: kepalaSekolahLabel(school.jenjang),
      namaKepala: school.namaKepsek?.trim() || null,
      nipKepala: school.nipKepsek?.trim() || null,
    };
  };

  const allInClasses = await prisma.student.findMany({
    where: { schoolId, isActive: true, classRoomId: { in: classIds } },
    orderBy: [{ className: "asc" }, { name: "asc" }],
    select: {
      id: true,
      name: true,
      nisn: true,
      nomorUjian: true,
      ruangUjian: true,
      className: true,
      classRoom: { select: { name: true } },
    },
  });

  const students =
    ruangKey === EXAM_NILAI_EMPTY_ROOM_KEY
      ? allInClasses.filter((s) => !(s.ruangUjian ?? "").trim())
      : allInClasses.filter((s) => (s.ruangUjian ?? "").trim() === ruangKey);

  const types = examScoreTypesForSubjectJenis(subject.jenisUjian);
  const grades =
    students.length > 0
      ? await prisma.gradeEntry.findMany({
          where: {
            schoolId,
            subjectId,
            semesterKey: EXAM_SEMESTER_KEY,
            scoreType: { in: types },
            studentId: { in: students.map((s) => s.id) },
          },
          select: { studentId: true, scoreType: true, score: true },
        })
      : [];

  const byStudent = new Map<string, { um?: number; up?: number }>();
  for (const g of grades) {
    const v = Number(g.score);
    if (Number.isNaN(v)) continue;
    const cur = byStudent.get(g.studentId) ?? {};
    if (g.scoreType === SCORE_TYPE.UJIAN_MADRASAH) cur.um = v;
    if (g.scoreType === SCORE_TYPE.UJIAN_PRAKTEK) cur.up = v;
    byStudent.set(g.studentId, cur);
  }

  const rows: ExamNilaiPrintRow[] = students.map((s, idx) => {
    const parts = byStudent.get(s.id);
    const avg = parts ? examAverageFromParts(parts.um, parts.up) : null;
    const nilaiBulat = avg == null ? null : roundExamNilaiForPrint(avg);
    const nilaiStr = nilaiBulat == null ? "—" : formatExamNilaiPrint(nilaiBulat);
    const ket = nilaiBulat == null ? "—" : nilaiUjianToTerbilang(nilaiBulat);
    return {
      no: idx + 1,
      nomorUjian: s.nomorUjian?.trim() || "—",
      nisn: String(s.nisn),
      nama: s.name.trim(),
      nilai: nilaiStr,
      keterangan: ket,
    };
  });

  return {
    ok: true,
    data: basePreview(rows),
  };
}

export async function getExamNilaiPrintPreviewAction(
  raw: unknown,
): Promise<{ ok: true; data: ExamNilaiPrintPreview } | { ok: false; message: string }> {
  try {
    const { schoolId } = await requireTenantAdmin();
    const parsed = previewSchema.safeParse(raw);
    if (!parsed.success) {
      return { ok: false, message: "Mapel atau ruang ujian tidak valid." };
    }
    const { subjectId, classRoomId, ruangKey, displayTimeZone } = parsed.data;
    const tz = safeDisplayTimeZone(displayTimeZone);
    return await runExamNilaiPrintPreview(
      schoolId,
      subjectId,
      classRoomId,
      ruangKey,
      { requireSubmittedLock: false },
      tz,
    );
  } catch (e) {
    return { ok: false, message: (e as Error).message };
  }
}

export async function getExamNilaiPrintPreviewTeacherAction(
  raw: unknown,
): Promise<{ ok: true; data: ExamNilaiPrintPreview } | { ok: false; message: string }> {
  try {
    const ctx = await requireUserSchoolId();
    if (ctx.role !== "GURU") {
      return { ok: false, message: "Hanya untuk akun guru." };
    }
    const teacher = await prisma.teacher.findFirst({
      where: { userId: ctx.userId, schoolId: ctx.schoolId },
      select: { id: true },
    });
    if (!teacher) {
      return { ok: false, message: "Data guru tidak ditemukan." };
    }
    const parsed = previewSchema.safeParse(raw);
    if (!parsed.success) {
      return { ok: false, message: "Mapel atau ruang ujian tidak valid." };
    }
    const { subjectId, classRoomId, ruangKey, displayTimeZone } = parsed.data;
    const tz = safeDisplayTimeZone(displayTimeZone);

    const teaches = await prisma.teachingAssignment.findFirst({
      where: {
        schoolId: ctx.schoolId,
        subjectId,
        teacherId: teacher.id,
        classRoomId,
      },
      select: { id: true },
    });

    const isHomeroom = await prisma.classRoom.findFirst({
      where: { id: classRoomId, schoolId: ctx.schoolId, homeroomTeacherId: teacher.id },
      select: { id: true },
    });

    const lock = await prisma.examScoreLock.findUnique({
      where: { schoolId_subjectId: { schoolId: ctx.schoolId, subjectId } },
      select: { id: true },
    });

    if (!teaches) {
      if (!isHomeroom || !lock) {
        return { ok: false, message: "Mapel ini di luar penugasan mengajar Anda (atau nilai belum dikirim)." };
      }
    }

    return await runExamNilaiPrintPreview(
      ctx.schoolId,
      subjectId,
      classRoomId,
      ruangKey,
      {
        restrictTeacherId: teaches ? teacher.id : undefined,
        requireSubmittedLock: true,
      },
      tz,
    );
  } catch (e) {
    return { ok: false, message: (e as Error).message };
  }
}
