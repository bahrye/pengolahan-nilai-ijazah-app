/** Logika rekapitulasi ijazah: rata ujian + rata rapor + bobot, tanpa akses DB. */

import type { RaporAspectMode } from "@prisma/client";

export type MapelRow = { kode: string; nama: string; semesterCount?: number };

export type StudentRow = {
  nisn: string;
  name: string;
  className: string | null;
};

/** nisn -> mapelKode -> nilai numerik */
export type ScoreMatrix = Record<string, Record<string, number | undefined>>;

export type RekapitulasiInput = {
  students: StudentRow[];
  mapel: MapelRow[];
  bobotUjian: number;
  bobotRapor: number;
  kkm: number;
  /** Jumlah default semester untuk sekolah (dari School.raporSemesterCount). */
  defaultSemesterCount: number;
  /** Urutan semester (kunci samakan dengan GradeEntry.semesterKey). */
  semestersForJenjang: string[];
  raporAspectMode: RaporAspectMode;
  nilaiUjianMadrasah: ScoreMatrix;
  nilaiUjianPraktek: ScoreMatrix;
  raporPengetahuanBySemester: Record<string, ScoreMatrix>;
  raporKeterampilanBySemester: Record<string, ScoreMatrix>;
};

export type RekapCategory = "ujian" | "rapor" | "ijazah";

export type RekapStudentRow = {
  nisn: string;
  nama: string;
  kelas: string;
  scoresByCode: Record<string, number>;
  jumlah: number;
  rataRataDisplay: string;
  rataRataNumeric: number;
  status?: "LULUS" | "TIDAK LULUS" | "-";
  rataRataAmPdum?: number;
};

export type RekapitulasiResult = {
  rekapUjian: ScoreMatrix;
  rekapRapor: ScoreMatrix;
  rekapIjazah: ScoreMatrix;
  rowsUjian: RekapStudentRow[];
  rowsRapor: RekapStudentRow[];
  rowsIjazah: RekapStudentRow[];
};

/** Pembulatan dua desimal (standar tampilan & perbandingan KKM konsisten). */
export function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

function parseScore(v: number | undefined): { ok: true; n: number } | { ok: false } {
  if (v === undefined || v === null || Number.isNaN(v)) return { ok: false };
  return { ok: true, n: v };
}

/** Rata-nilai akhir ujian satu mapel dari tertulis + praktik jika ada. */
function examAverage(
  um: number | undefined,
  up: number | undefined,
): number | null {
  const a = parseScore(um);
  const b = parseScore(up);
  const hasUM = a.ok;
  const hasUP = b.ok;
  if (hasUM && hasUP) return round2((a.n + b.n) / 2);
  if (hasUM) return round2(a.n);
  if (hasUP) return round2(b.n);
  return null;
}

/** Satu semester rapor: satu nilai per mapel menurut mode aspek. */
function semesterRaporCombined(
  nilaiP: number | undefined,
  nilaiK: number | undefined,
  mode: RaporAspectMode,
): number {
  const validP = parseScore(nilaiP);
  const validK = parseScore(nilaiK);

  switch (mode) {
    case "PENGETAHUAN_ONLY":
      return validP.ok ? validP.n : 0;
    case "KETERAMPILAN_ONLY":
      return validK.ok ? validK.n : 0;
    case "BOTH":
    default:
      if (validP.ok && validK.ok) return (validP.n + validK.n) / 2;
      if (validP.ok) return validP.n;
      if (validK.ok) return validK.n;
      return 0;
  }
}

export function computeRekapitulasi(input: RekapitulasiInput): RekapitulasiResult {
  if (input.semestersForJenjang.length === 0) {
    throw new Error(
      "Belum ada semester untuk dihitung — atur jenjang atau data semester.",
    );
  }

  const {
    students,
    mapel,
    bobotUjian,
    bobotRapor,
    kkm,
    defaultSemesterCount,
    semestersForJenjang,
    raporAspectMode,
    nilaiUjianMadrasah,
    nilaiUjianPraktek,
    raporPengetahuanBySemester,
    raporKeterampilanBySemester,
  } = input;

  const rekapUjian: ScoreMatrix = {};
  const rekapRapor: ScoreMatrix = {};
  const rekapIjazah: ScoreMatrix = {};

  for (const s of students) {
    const nisn = s.nisn.toString().trim();
    rekapUjian[nisn] = {};
    rekapRapor[nisn] = {};
    rekapIjazah[nisn] = {};

    for (const m of mapel) {
      const kode = m.kode;
      const nilaiUM = parseFloat(
        String((nilaiUjianMadrasah[nisn] || {})[kode] ?? ""),
      );
      const nilaiUP = parseFloat(
        String((nilaiUjianPraktek[nisn] || {})[kode] ?? ""),
      );

      const rataUjian = examAverage(
        Number.isFinite(nilaiUM) ? nilaiUM : undefined,
        Number.isFinite(nilaiUP) ? nilaiUP : undefined,
      );

      const murniUjian = rataUjian !== null ? round2(rataUjian) : 0;
      if (rataUjian !== null) {
        rekapUjian[nisn][kode] = murniUjian;
      }

      const divisor = (m.semesterCount && m.semesterCount > 0)
        ? m.semesterCount
        : defaultSemesterCount;

      let totalNilaiRaporSemester = 0;
      for (const smKey of semestersForJenjang) {
        const vP = ((raporPengetahuanBySemester[smKey] || {})[nisn] || {})[
          kode
        ];
        const vK = (
          (raporKeterampilanBySemester[smKey] || {})[nisn] || {}
        )[kode];
        const numP = typeof vP === "number" ? vP : Number.parseFloat(String(vP ?? ""));
        const numK = typeof vK === "number" ? vK : Number.parseFloat(String(vK ?? ""));
        const hasP = Number.isFinite(numP);
        const hasK = Number.isFinite(numK);
        if (!hasP && !hasK) continue;
        const sem = semesterRaporCombined(
          hasP ? numP : undefined,
          hasK ? numK : undefined,
          raporAspectMode,
        );
        totalNilaiRaporSemester += Number.isFinite(sem) ? sem : 0;
      }

      const murniRapor = round2(totalNilaiRaporSemester / divisor);
      rekapRapor[nisn][kode] = murniRapor;

      const nilaiAkhir = round2(
        murniUjian * (bobotUjian / 100) + murniRapor * (bobotRapor / 100),
      );
      rekapIjazah[nisn][kode] = nilaiAkhir;
    }
  }

  const rowsUjian = buildRekapRows(students, mapel, rekapUjian, "ujian", kkm);
  const rowsRapor = buildRekapRows(students, mapel, rekapRapor, "rapor", kkm);
  const rowsIjazah = buildRekapRows(students, mapel, rekapIjazah, "ijazah", kkm);

  return {
    rekapUjian,
    rekapRapor,
    rekapIjazah,
    rowsUjian,
    rowsRapor,
    rowsIjazah,
  };
}

export function buildRekapRows(
  students: StudentRow[],
  mapel: MapelRow[],
  data: ScoreMatrix,
  kind: RekapCategory,
  kkm: number,
): RekapStudentRow[] {
  const mapelCount = mapel.length;
  return students.map((student) => {
    const nisn = student.nisn.toString().trim();
    const scoresByCode: Record<string, number> = {};
    let sumRounded = 0;

    for (const m of mapel) {
      const rawScore = (data[nisn] || {})[m.kode];
      let numericScore =
        typeof rawScore === "number" ? rawScore : parseFloat(String(rawScore));
      if (Number.isNaN(numericScore)) numericScore = 0;
      const roundedScore = round2(numericScore);
      scoresByCode[m.kode] = roundedScore;
      sumRounded += roundedScore;
    }

    const average =
      mapelCount > 0 ? round2(sumRounded / mapelCount) : 0;
    const rataRataDisplay = average.toFixed(2).replace(".", ",");

    let status: RekapStudentRow["status"] = "-";
    if (kind === "ijazah" && mapelCount > 0) {
      status = average >= round2(kkm) ? "LULUS" : "TIDAK LULUS";
    }

    const row: RekapStudentRow = {
      nisn,
      nama: student.name,
      kelas: student.className?.trim() || "-",
      scoresByCode,
      jumlah: round2(sumRounded),
      rataRataDisplay,
      rataRataNumeric: average,
      status,
    };

    if (kind === "ujian") {
      row.rataRataAmPdum = Math.round(average);
    }

    return row;
  });
}
