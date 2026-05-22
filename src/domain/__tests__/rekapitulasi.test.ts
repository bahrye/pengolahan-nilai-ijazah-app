import { describe, expect, it } from "vitest";

import { computeRekapitulasi, round2 } from "@/domain/rekapitulasi";

describe("computeRekapitulasi", () => {
  it("bobot ijazah + mode BOTH rapor (P+K)/2 tiap semester", () => {
    const students = [
      { nisn: "001", name: "ANI", className: "9A" },
    ];
    const mapel = [{ kode: "MTK", nama: "Matematika" }];
    const semestersForJenjang = ["k9_ganjil"];

    const nilaiUM = { "001": { MTK: 80 } };
    const nilaiUP = { "001": { MTK: undefined as unknown as number } };
    const p = { "001": { MTK: 70 } };
    const k = { "001": { MTK: 90 } };

    const r = computeRekapitulasi({
      students,
      mapel,
      bobotUjian: 40,
      bobotRapor: 60,
      kkm: 75,
      defaultSemesterCount: 1,
      raporAspectMode: "BOTH",
      semestersForJenjang,
      nilaiUjianMadrasah: nilaiUM,
      nilaiUjianPraktek: nilaiUP,
      raporPengetahuanBySemester: { k9_ganjil: p },
      raporKeterampilanBySemester: { k9_ganjil: k },
    });

    expect(r.rekapUjian["001"].MTK).toBe(80);
    expect(r.rekapRapor["001"].MTK).toBeCloseTo(round2((70 + 90) / 2), 5);
    const ruj = 80;
    const rr = round2((70 + 90) / 2);
    const expectedIjazah = round2(ruj * 0.4 + rr * 0.6);
    expect(r.rekapIjazah["001"].MTK).toBeCloseTo(expectedIjazah, 5);

    expect(r.rowsIjazah[0].scoresByCode.MTK).toBe(round2(expectedIjazah));
    expect(r.rowsIjazah[0].status).toBe("LULUS");
    expect(r.rowsIjazah[0].rataRataNumeric).toBe(round2(expectedIjazah));
  });

  it("mode PENGETAHUAN_ONLY: rapor pakai nilai P saja", () => {
    const semestersForJenjang = ["k9_ganjil"];
    const r = computeRekapitulasi({
      students: [{ nisn: "001", name: "X", className: "9A" }],
      mapel: [{ kode: "A", nama: "a" }],
      bobotUjian: 40,
      bobotRapor: 60,
      kkm: 75,
      defaultSemesterCount: 1,
      raporAspectMode: "PENGETAHUAN_ONLY",
      semestersForJenjang,
      nilaiUjianMadrasah: {},
      nilaiUjianPraktek: {},
      raporPengetahuanBySemester: { k9_ganjil: { "001": { A: 80 } } },
      raporKeterampilanBySemester: {
        k9_ganjil: { "001": { A: 40 } },
      },
    });
    expect(r.rekapRapor["001"].A).toBe(80);
  });

  it("semua semester kosong → rapor 0", () => {
    const semesters = ["k6_ganjil", "k5_genap", "k5_ganjil"];
    const r = computeRekapitulasi({
      students: [{ nisn: "001", name: "X", className: "6" }],
      mapel: [{ kode: "A", nama: "a" }],
      bobotUjian: 50,
      bobotRapor: 50,
      kkm: 75,
      defaultSemesterCount: 3,
      raporAspectMode: "BOTH",
      semestersForJenjang: semesters,
      nilaiUjianMadrasah: {},
      nilaiUjianPraktek: {},
      raporPengetahuanBySemester: {},
      raporKeterampilanBySemester: {},
    });
    expect(r.rekapRapor["001"].A).toBe(0);
  });

  it("mapel semesterCount=1 → pembagi = 1 (bukan total semester)", () => {
    const semesters = ["k7_ganjil", "k7_genap", "k8_ganjil", "k8_genap", "k9_ganjil"];
    const r = computeRekapitulasi({
      students: [{ nisn: "001", name: "ANI", className: "9A" }],
      mapel: [{ kode: "BADAR", nama: "Bahasa Daerah", semesterCount: 1 }],
      bobotUjian: 40,
      bobotRapor: 60,
      kkm: 75,
      defaultSemesterCount: 5,
      raporAspectMode: "BOTH",
      semestersForJenjang: semesters,
      nilaiUjianMadrasah: { "001": { BADAR: 85 } },
      nilaiUjianPraktek: {},
      raporPengetahuanBySemester: {
        k9_ganjil: { "001": { BADAR: 80 } },
      },
      raporKeterampilanBySemester: {},
    });
    // Rapor: semesterCount=1 → 80/1 = 80, rounded = 80
    expect(r.rekapRapor["001"].BADAR).toBe(80);
    // Ujian: 85, rounded = 85
    expect(r.rekapUjian["001"].BADAR).toBe(85);
    // Ijazah: 85*40% + 80*60% = 34 + 48 = 82
    expect(r.rekapIjazah["001"].BADAR).toBe(82);
  });

  it("mapel defaultSemesterCount=5, siswa belum diinput 2 semester → pembagi tetap 5", () => {
    const semesters = ["k7_ganjil", "k7_genap", "k8_ganjil", "k8_genap", "k9_ganjil"];
    const r = computeRekapitulasi({
      students: [
        { nisn: "001", name: "ANI", className: "9A" },
      ],
      mapel: [{ kode: "MTK", nama: "Matematika" }],
      bobotUjian: 40,
      bobotRapor: 60,
      kkm: 75,
      defaultSemesterCount: 5,
      raporAspectMode: "PENGETAHUAN_ONLY",
      semestersForJenjang: semesters,
      nilaiUjianMadrasah: { "001": { MTK: 80 } },
      nilaiUjianPraktek: {},
      raporPengetahuanBySemester: {
        k7_ganjil: { "001": { MTK: 80 } },
        k7_genap:  { "001": { MTK: 80 } },
        k8_ganjil: { "001": { MTK: 80 } },
        // semester 4 & 5 belum diinput
      },
      raporKeterampilanBySemester: {},
    });
    // MTK: semesterCount=0 (default) → pakai defaultSemesterCount=5
    // ANI total = 80+80+80+0+0 = 240, avg = 240/5 = 48, rounded = 48
    expect(r.rekapRapor["001"].MTK).toBe(48);
  });

  it("wali kelas lupa input SEMUA siswa di semester 4 & 5 → tetap dibagi 5", () => {
    const semesters = ["k7_ganjil", "k7_genap", "k8_ganjil", "k8_genap", "k9_ganjil"];
    const r = computeRekapitulasi({
      students: [
        { nisn: "001", name: "ANI", className: "9A" },
        { nisn: "002", name: "BUDI", className: "9A" },
      ],
      mapel: [{ kode: "MTK", nama: "Matematika" }],
      bobotUjian: 40,
      bobotRapor: 60,
      kkm: 75,
      defaultSemesterCount: 5,
      raporAspectMode: "PENGETAHUAN_ONLY",
      semestersForJenjang: semesters,
      nilaiUjianMadrasah: { "001": { MTK: 80 }, "002": { MTK: 80 } },
      nilaiUjianPraktek: {},
      raporPengetahuanBySemester: {
        k7_ganjil: { "001": { MTK: 80 }, "002": { MTK: 80 } },
        k7_genap:  { "001": { MTK: 80 }, "002": { MTK: 80 } },
        k8_ganjil: { "001": { MTK: 80 }, "002": { MTK: 80 } },
        // semester 4 & 5: SEMUA siswa belum diinput
      },
      raporKeterampilanBySemester: {},
    });
    // defaultSemesterCount=5 → semua tetap dibagi 5
    // ANI: 240/5 = 48
    expect(r.rekapRapor["001"].MTK).toBe(48);
    // BUDI: 240/5 = 48
    expect(r.rekapRapor["002"].MTK).toBe(48);
  });
});
