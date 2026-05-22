import { describe, expect, it } from "vitest";

import { isSklStudentSklFieldsReady, isSklSystemDataReady } from "@/lib/skl/skl-document-data";

describe("isSklStudentSklFieldsReady", () => {
  it("true jika ketiga field terisi", () => {
    expect(
      isSklStudentSklFieldsReady({
        sklLetterNumber: "001/2026",
        parentGuardianName: "Bapak A",
        nis: "12345",
      }),
    ).toBe(true);
  });

  it("false jika salah satu kosong", () => {
    expect(
      isSklStudentSklFieldsReady({
        sklLetterNumber: "001/2026",
        parentGuardianName: "Bapak A",
        nis: null,
      }),
    ).toBe(false);
  });
});

describe("isSklSystemDataReady", () => {
  it("membutuhkan field SKL siswa", () => {
    expect(
      isSklSystemDataReady(
        { namaSekolah: "MA Negeri 1" },
        {
          name: "Siswa",
          nisn: "1234567890",
          sklLetterNumber: null,
          parentGuardianName: "Ayah",
          nis: "1",
        },
      ),
    ).toBe(false);
  });
});
