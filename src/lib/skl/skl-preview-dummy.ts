import {
  buildSklDocumentData,
  graduationYear,
  type SklDocumentData,
  type SklSchoolSnapshot,
  type SklStudentSnapshot,
} from "@/lib/skl/skl-document-data";
import { terbilangNilaiTampilan } from "@/lib/skl/terbilang";
import type { SklGradesPayload } from "@/lib/skl/skl-grades";

const DUMMY_NISN = "1234567890";
const DUMMY_NAME = "NAMA SISWA (CONTOH)";
const DUMMY_SCHOOL_NAME = "NAMA SEKOLAH (CONTOH)";
const DUMMY_PARENT = "NAMA AYAH/WALI (CONTOH)";
const DUMMY_NIS = "000001";
const DUMMY_CLASS = "XII IPA 1";
const DUMMY_BIRTH_PLACE = "KOTA CONTOH";
const DUMMY_SAMPLE_SCORE = "85";

/** Isi field kosong agar pratinjau SKL sistem tetap bisa dibuka. */
export function withSklPreviewDummyStudent(
  student: SklStudentSnapshot,
  school: SklSchoolSnapshot,
): SklStudentSnapshot {
  const tahun = graduationYear(student, school);
  const birthDate =
    student.birthDate ??
    new Date(tahun - 17, 0, 1);

  return {
    nisn: student.nisn?.trim() || DUMMY_NISN,
    nis: student.nis?.trim() || DUMMY_NIS,
    nomorUjian: student.nomorUjian?.trim() || "0001",
    name: student.name?.trim() || DUMMY_NAME,
    gender: student.gender?.trim() || "L",
    birthPlace: student.birthPlace?.trim() || DUMMY_BIRTH_PLACE,
    birthDate,
    tahunLulus: student.tahunLulus ?? school.tahunLulusGlobal,
    sklLetterNumber:
      student.sklLetterNumber?.trim() || `001/SKL-PRATINJAU/${tahun}`,
    parentGuardianName: student.parentGuardianName?.trim() || DUMMY_PARENT,
    classLabel: student.classLabel?.trim() || DUMMY_CLASS,
  };
}

export function withSklPreviewDummySchool(school: SklSchoolSnapshot): SklSchoolSnapshot {
  return {
    ...school,
    namaSekolah: school.namaSekolah?.trim() || DUMMY_SCHOOL_NAME,
  };
}

export function buildSklPreviewDummyGrades(): SklGradesPayload {
  const sampleSubjects = [
    "Pendidikan Agama dan Budi Pekerti",
    "Pendidikan Pancasila",
    "Bahasa Indonesia",
    "Matematika",
    "Ilmu Pengetahuan Alam",
    "Ilmu Pengetahuan Sosial",
    "Bahasa Inggris",
  ];
  const huruf = terbilangNilaiTampilan(DUMMY_SAMPLE_SCORE);

  return {
    groups: [
      {
        label: "Kelompok A",
        rows: sampleSubjects.map((nama, i) => ({
          no: i + 1,
          nama,
          nilaiAngka: DUMMY_SAMPLE_SCORE,
          nilaiHuruf: huruf,
        })),
      },
    ],
    rataRataAngka: DUMMY_SAMPLE_SCORE,
    rataRataHuruf: huruf,
    status: "LULUS",
  };
}

export function sklGradesPayloadHasScores(grades: SklGradesPayload): boolean {
  return grades.groups.some((g) => g.rows.some((r) => r.nilaiAngka.trim() !== ""));
}

export function buildSklPreviewDocumentData(opts: {
  school: SklSchoolSnapshot;
  student: SklStudentSnapshot;
  academicYearLabel: string | null;
  grades: SklGradesPayload;
}): SklDocumentData {
  const school = withSklPreviewDummySchool(opts.school);
  const student = withSklPreviewDummyStudent(opts.student, school);
  const grades = sklGradesPayloadHasScores(opts.grades)
    ? opts.grades
    : buildSklPreviewDummyGrades();

  return buildSklDocumentData({
    school,
    student,
    academicYearLabel: opts.academicYearLabel,
    grades,
  });
}
