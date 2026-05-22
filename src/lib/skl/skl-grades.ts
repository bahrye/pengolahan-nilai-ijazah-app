import { round2 } from "@/domain/rekapitulasi";
import { runRekapForSchool, runRekapForSchoolInDb } from "@/lib/rekap-service";
import { terbilangNilaiTampilan } from "@/lib/skl/terbilang";
import { prisma } from "@/lib/prisma";
import type { TenantDb } from "@/server/tenant-db-context";

export type SklGradeRow = {
  no: number;
  nama: string;
  nilaiAngka: string;
  nilaiHuruf: string;
};

/** Baris tabel halaman DAFTAR NILAI (untuk jspdf-autotable). */
export type SklTableRow =
  | {
      kind: "group";
      label: string;
    }
  | {
      kind: "parent";
      label: string;
    }
  | {
      kind: "subject";
      label: string;
      nilaiAngka: string;
      nilaiHuruf: string;
      indent?: boolean;
    }
  | {
      kind: "average";
      nilaiAngka: string;
      nilaiHuruf: string;
    };

export type SklGradeGroup = {
  label: string;
  rows: SklGradeRow[];
};

export type SklGradesPayload = {
  groups: SklGradeGroup[];
  rataRataAngka: string;
  rataRataHuruf: string;
  status: "LULUS" | "TIDAK LULUS";
};

function kelompokLabel(raw: string | null | undefined): string {
  const k = raw?.trim();
  if (!k) return "Kelompok A";
  if (/^kelompok\s/i.test(k)) return k;
  return `Kelompok ${k}`;
}

/** Nilai per mapel: bilangan bulat hasil pembulatan rekap (round2). */
function formatNilaiBulat(n: number | undefined): string {
  if (n === undefined || Number.isNaN(n)) return "";
  return String(Math.round(round2(n)));
}

function isSubMapelName(name: string): boolean {
  return /^[A-D]\.\s/i.test(name.trim());
}

export function buildSklTableRows(payload: SklGradesPayload): SklTableRow[] {
  const rows: SklTableRow[] = [];
  for (const group of payload.groups) {
    rows.push({ kind: "group", label: group.label });
    let num = 0;
    let i = 0;
    while (i < group.rows.length) {
      const row = group.rows[i]!;
      const next = group.rows[i + 1];
      if (next && isSubMapelName(next.nama) && !isSubMapelName(row.nama)) {
        num += 1;
        rows.push({ kind: "parent", label: `${num}. ${row.nama}` });
        i += 1;
        while (i < group.rows.length && isSubMapelName(group.rows[i]!.nama)) {
          const sub = group.rows[i]!;
          rows.push({
            kind: "subject",
            label: sub.nama,
            nilaiAngka: sub.nilaiAngka,
            nilaiHuruf: sub.nilaiHuruf,
            indent: true,
          });
          i += 1;
        }
      } else {
        num += 1;
        rows.push({
          kind: "subject",
          label: `${num}. ${row.nama}`,
          nilaiAngka: row.nilaiAngka,
          nilaiHuruf: row.nilaiHuruf,
        });
        i += 1;
      }
    }
  }
  rows.push({
    kind: "average",
    nilaiAngka: payload.rataRataAngka,
    nilaiHuruf: payload.rataRataHuruf,
  });
  return rows;
}

function normalizeNisnKey(nisn: string | null | undefined): string {
  return (nisn ?? "").replace(/\D/g, "").slice(0, 10);
}

/** Muat nilai rekap ijazah per mapel untuk satu siswa (halaman DAFTAR NILAI). */
export async function loadSklGradesForStudent(
  schoolId: string,
  studentId: string,
  db?: TenantDb,
): Promise<SklGradesPayload> {
  const client = db ?? prisma;
  const rekapPromise = db
    ? runRekapForSchoolInDb(db, schoolId, { studentIds: [studentId] })
    : runRekapForSchool(schoolId, { studentIds: [studentId] });

  const [subjects, rekap, student] = await Promise.all([
    client.subject.findMany({
      where: { schoolId },
      orderBy: [{ orderNo: "asc" }, { code: "asc" }],
      select: { code: true, name: true, kelompok: true },
    }),
    rekapPromise,
    client.student.findFirst({
      where: { id: studentId, schoolId },
      select: { nisn: true },
    }),
  ]);

  const studentNisn = student?.nisn ?? "";
  const nisn = normalizeNisnKey(studentNisn);
  const row =
    rekap.rowsIjazah.find((r) => normalizeNisnKey(r.nisn) === nisn) ??
    rekap.rowsIjazah.find((r) => (r.nisn ?? "").trim() === studentNisn.trim());

  const scores = row?.scoresByCode ?? {};
  const status: "LULUS" | "TIDAK LULUS" =
    row?.status === "TIDAK LULUS" ? "TIDAK LULUS" : "LULUS";

  const byGroup = new Map<string, SklGradeRow[]>();
  let no = 0;
  for (const s of subjects) {
    no += 1;
    const label = kelompokLabel(s.kelompok);
    const list = byGroup.get(label) ?? [];
    const raw = scores[s.code];
    const rounded = raw !== undefined && !Number.isNaN(raw) ? round2(raw) : undefined;
    const angka = formatNilaiBulat(rounded);
    list.push({
      no,
      nama: s.name,
      nilaiAngka: angka,
      nilaiHuruf: angka ? terbilangNilaiTampilan(angka) : "",
    });
    byGroup.set(label, list);
  }

  if (byGroup.size === 0 && subjects.length === 0) {
    byGroup.set("Kelompok A", []);
  }

  const groups: SklGradeGroup[] = Array.from(byGroup.entries()).map(([label, rows]) => ({
    label,
    rows,
  }));

  return {
    groups,
    rataRataAngka: row?.rataRataDisplay ?? "",
    rataRataHuruf: terbilangNilaiTampilan(row?.rataRataDisplay ?? ""),
    status,
  };
}
