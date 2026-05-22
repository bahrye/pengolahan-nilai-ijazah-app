import type { SchoolLevel } from "@prisma/client";

import {
  isMadrasahJenjang,
  schoolLevelLongLabel,
} from "@/lib/skl/school-level-labels";
import type { SklGradesPayload } from "@/lib/skl/skl-grades";

export type SklSchoolSnapshot = {
  namaSekolah: string;
  npsn: string | null;
  nsm: string | null;
  jenjang: SchoolLevel | null;
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
};

export type SklStudentSnapshot = {
  nisn: string;
  nis: string | null;
  name: string;
  gender: string | null;
  birthPlace: string | null;
  birthDate: Date | null;
  tahunLulus: number | null;
  classLabel: string | null;
  sklLetterNumber: string | null;
  parentGuardianName: string | null;
  nomorUjian: string | null;
};

export type SklDocumentData = {
  school: SklSchoolSnapshot;
  student: SklStudentSnapshot;
  academicYearLabel: string | null;
  letterNumberDisplay: string;
  graduationDate: Date;
  issuedAt: Date;
  grades: SklGradesPayload;
};

export function formatKabupatenLine(school: SklSchoolSnapshot): string {
  const kab = [school.tipeKabupaten, school.kabupaten].filter(Boolean).join(" ").trim();
  return kab ? kab.toUpperCase() : "—";
}

export function formatProvinsiLine(school: SklSchoolSnapshot): string {
  return school.provinsi?.trim().toUpperCase() || "—";
}

export function formatBirthPlaceDate(place: string | null, date: Date | null): string {
  const p = place?.trim() || "";
  if (!date) return p || "—";
  const d = date.toLocaleDateString("id-ID", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
  return p ? `${p}, ${d}` : d;
}

/** Huruf kapital untuk nama dan identitas pada SKL. */
export function formatSklUpper(value: string | null | undefined): string {
  const t = value?.trim();
  if (!t) return "";
  return t.toLocaleUpperCase("id-ID");
}

export function formatBirthPlaceDateSkl(
  place: string | null,
  date: Date | null,
): string {
  const raw = formatBirthPlaceDate(place, date);
  if (!raw || raw === "—") return "—";
  return raw.toLocaleUpperCase("id-ID");
}

export function formatDateId(d: Date): string {
  return d.toLocaleDateString("id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export function graduationYear(
  student: SklStudentSnapshot,
  school: SklSchoolSnapshot,
): number {
  return student.tahunLulus ?? school.tahunLulusGlobal ?? new Date().getFullYear();
}

export function jenjangTitleUpper(jenjang: SchoolLevel | null | undefined): string {
  if (!jenjang) return "SATUAN PENDIDIKAN";
  return schoolLevelLongLabel(jenjang).toUpperCase();
}

export function sklNomorPesertaLabel(jenjang: SchoolLevel | null | undefined): string {
  return isMadrasahJenjang(jenjang)
    ? "nomor peserta asesmen madrasah"
    : "nomor peserta ujian sekolah";
}

export function sklAsalLabel(jenjang: SchoolLevel | null | undefined): string {
  return isMadrasahJenjang(jenjang) ? "madrasah asal" : "sekolah asal";
}

export function sklKepalaTitle(jenjang: SchoolLevel | null | undefined): string {
  return isMadrasahJenjang(jenjang) ? "Kepala Madrasah" : "Kepala Sekolah";
}

export function buildSklLetterNumberDisplay(
  student: SklStudentSnapshot,
  tahun: number,
): string {
  const custom = student.sklLetterNumber?.trim();
  if (custom) return custom;
  return `........./....................../${tahun}`;
}

/** Nomor surat, ayah/wali laki-laki, dan NIS lokal — wajib untuk centang SKL (model sistem). */
export function isSklStudentSklFieldsReady(
  student: Pick<SklStudentSnapshot, "sklLetterNumber" | "parentGuardianName" | "nis">,
): boolean {
  return Boolean(
    student.sklLetterNumber?.trim() &&
      student.parentGuardianName?.trim() &&
      student.nis?.trim(),
  );
}

export function isSklSystemDataReady(
  school: Pick<SklSchoolSnapshot, "namaSekolah">,
  student: Pick<
    SklStudentSnapshot,
    "name" | "nisn" | "sklLetterNumber" | "parentGuardianName" | "nis"
  >,
): boolean {
  return Boolean(
    school.namaSekolah?.trim() &&
      student.name?.trim() &&
      student.nisn?.trim() &&
      isSklStudentSklFieldsReady(student),
  );
}

export function buildSklDocumentData(opts: {
  school: SklSchoolSnapshot;
  student: SklStudentSnapshot;
  academicYearLabel: string | null;
  grades: SklGradesPayload;
  issuedAt?: Date;
}): SklDocumentData {
  const tahun = graduationYear(opts.student, opts.school);
  const graduationDate =
    opts.school.graduationAnnouncementAt ?? new Date(tahun, 5, 10);
  const issuedAt =
    opts.issuedAt ??
    opts.school.sklIssuedAt ??
    opts.school.graduationAnnouncementAt ??
    new Date(tahun, 5, 10);

  return {
    school: opts.school,
    student: opts.student,
    academicYearLabel: opts.academicYearLabel,
    letterNumberDisplay: buildSklLetterNumberDisplay(opts.student, tahun),
    graduationDate,
    issuedAt,
    grades: opts.grades,
  };
}
