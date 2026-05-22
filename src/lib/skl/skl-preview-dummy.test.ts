import { describe, expect, it } from "vitest";

import { isSklSystemDataReady } from "@/lib/skl/skl-document-data";
import {
  buildSklPreviewDocumentData,
  withSklPreviewDummyStudent,
} from "@/lib/skl/skl-preview-dummy";

describe("buildSklPreviewDocumentData", () => {
  it("mengisi field kosong agar data siap pratinjau", () => {
    const school = {
      namaSekolah: "",
      npsn: null,
      nsm: null,
      jenjang: null,
      alamat: null,
      provinsi: null,
      tipeKabupaten: "Kabupaten",
      kabupaten: null,
      kecamatan: null,
      tipeKelurahan: "Kelurahan",
      kelurahan: null,
      kodePos: null,
      telepon: null,
      email: null,
      namaKepsek: null,
      nipKepsek: null,
      tahunLulusGlobal: 2026,
      printSignaturePlace: null,
      printLetterheadUrl: null,
      graduationAnnouncementAt: null,
      sklIssuedAt: null,
    };
    const student = {
      nisn: "",
      nis: null,
      nomorUjian: null,
      name: "",
      gender: null,
      birthPlace: null,
      birthDate: null,
      tahunLulus: null,
      sklLetterNumber: null,
      parentGuardianName: null,
      classLabel: null,
    };

    const doc = buildSklPreviewDocumentData({
      school,
      student,
      academicYearLabel: "2025/2026",
      grades: { groups: [], rataRataAngka: "", rataRataHuruf: "", status: "LULUS" },
    });

    expect(isSklSystemDataReady(doc.school, doc.student)).toBe(true);
    expect(doc.student.name).toBe("NAMA SISWA (CONTOH)");
    expect(doc.school.namaSekolah).toBe("NAMA SEKOLAH (CONTOH)");
    expect(doc.grades.groups[0]?.rows.length).toBeGreaterThan(0);
  });

  it("mempertahankan data siswa yang sudah ada", () => {
    const school = {
      namaSekolah: "MA Negeri 1",
      npsn: null,
      nsm: null,
      jenjang: null,
      alamat: null,
      provinsi: null,
      tipeKabupaten: "Kabupaten",
      kabupaten: null,
      kecamatan: null,
      tipeKelurahan: "Kelurahan",
      kelurahan: null,
      kodePos: null,
      telepon: null,
      email: null,
      namaKepsek: null,
      nipKepsek: null,
      tahunLulusGlobal: 2026,
      printSignaturePlace: null,
      printLetterheadUrl: null,
      graduationAnnouncementAt: null,
      sklIssuedAt: null,
    };
    const filled = withSklPreviewDummyStudent(
      {
        nisn: "9876543210",
        nis: "123",
        nomorUjian: null,
        name: "Ahmad",
        gender: "L",
        birthPlace: "Jakarta",
        birthDate: new Date("2010-01-15"),
        tahunLulus: 2026,
        sklLetterNumber: null,
        parentGuardianName: null,
        classLabel: "XII",
      },
      school,
    );

    expect(filled.name).toBe("Ahmad");
    expect(filled.nisn).toBe("9876543210");
    expect(filled.parentGuardianName).toBe("NAMA AYAH/WALI (CONTOH)");
  });
});
