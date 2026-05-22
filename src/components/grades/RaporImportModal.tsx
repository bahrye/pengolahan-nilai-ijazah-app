"use client";

import { useCallback, useMemo, useState } from "react";

type SubjProp = { id: string; kode: string; nama?: string };

export type ImportedRaporData = {
  pengetahuan: Record<string, Record<string, number>>;
  keterampilan: Record<string, Record<string, number>>;
};

type ParsedResult = {
  format: "k13" | "kurmer";
  excelCodes: string[];
  pengetahuan: Record<string, Record<string, number>>;
  keterampilan: Record<string, Record<string, number>>;
};

/* ── Excel cell → trimmed string ── */
function cellStr(cell: { value: unknown }): string {
  const v = cell?.value;
  if (v === null || v === undefined) return "";
  if (typeof v === "object" && v !== null && "result" in v)
    return String((v as { result: unknown }).result ?? "").trim();
  return String(v).trim();
}

/* ── Extract subject codes + per-NISN scores from one worksheet ── */
function extractSheetData(sheet: {
  rowCount: number;
  getRow: (n: number) => { getCell: (n: number) => { value: unknown } };
}): { codes: string[]; data: Record<string, Record<string, number>> } {
  let headerRowIdx = -1;
  let nisnColIdx = -1;
  let lastMetaCol = -1;

  const metaHeaders = new Set(["no", "nis", "nisn", "nama", "name", "jk", "l/p", "kelas"]);

  for (let r = 1; r <= Math.min(25, sheet.rowCount); r++) {
    const row = sheet.getRow(r);
    for (let c = 1; c <= 20; c++) {
      const val = cellStr(row.getCell(c)).toLowerCase();
      if (val === "nisn") {
        headerRowIdx = r;
        nisnColIdx = c;
      }
      if (metaHeaders.has(val) && c > lastMetaCol) lastMetaCol = c;
    }
    if (headerRowIdx > 0) break;
  }

  if (headerRowIdx < 0 || nisnColIdx < 0) return { codes: [], data: {} };

  const startCol = (lastMetaCol > 0 ? lastMetaCol : nisnColIdx) + 1;
  const headerRow = sheet.getRow(headerRowIdx);
  const subRow = sheet.getRow(headerRowIdx + 1);

  let hasSubHeader = false;
  for (let c = startCol; c <= startCol + 10; c++) {
    const sv = cellStr(subRow.getCell(c));
    if (sv && isNaN(Number(sv))) {
      hasSubHeader = true;
      break;
    }
  }

  const codeColMap: { col: number; code: string }[] = [];
  const codes: string[] = [];
  let emptyStreak = 0;

  for (let c = startCol; c <= 200; c++) {
    const hv = cellStr(headerRow.getCell(c));
    const sv = hasSubHeader ? cellStr(subRow.getCell(c)) : "";

    if (!hv && !sv) {
      emptyStreak++;
      if (emptyStreak >= 3) break;
      continue;
    }
    emptyStreak = 0;

    const code = sv || hv;
    if (code && isNaN(Number(code))) {
      codeColMap.push({ col: c, code });
      if (!codes.includes(code)) codes.push(code);
    }
  }

  const dataStartRow = hasSubHeader ? headerRowIdx + 2 : headerRowIdx + 1;
  const data: Record<string, Record<string, number>> = {};

  for (let r = dataStartRow; r <= sheet.rowCount; r++) {
    const row = sheet.getRow(r);
    const nisnRaw = cellStr(row.getCell(nisnColIdx));
    const nisn = nisnRaw.replace(/[^0-9]/g, "");
    if (!nisn || nisn.length < 4) continue;

    data[nisn] = {};
    for (const { col, code } of codeColMap) {
      const raw = cellStr(row.getCell(col));
      const num = parseFloat(raw);
      if (!isNaN(num) && num >= 0 && num <= 100) {
        data[nisn][code] = num;
      }
    }
  }

  return { codes, data };
}

function autoMatch(
  excelCodes: string[],
  appSubjects: SubjProp[],
): Record<string, string> {
  const mapping: Record<string, string> = {};
  const appCodes = appSubjects.map((s) => s.kode);

  for (const ec of excelCodes) {
    const exact = appCodes.find(
      (ac) => ac.toLowerCase() === ec.toLowerCase(),
    );
    mapping[ec] = exact ?? "";
  }
  return mapping;
}

export function RaporImportModal({
  subjects,
  students,
  currentSemesterKey,
  currentSemesterLabel,
  onImport,
  onClose,
}: {
  subjects: SubjProp[];
  students: { nisn: string; name: string }[];
  currentSemesterKey?: string;
  currentSemesterLabel?: string;
  onImport: (data: ImportedRaporData) => void;
  onClose: () => void;
}) {
  const [step, setStep] = useState<"upload" | "mapping">("upload");
  const [parsed, setParsed] = useState<ParsedResult | null>(null);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [parsing, setParsing] = useState(false);

  const appNisns = useMemo(() => new Set(students.map((s) => s.nisn)), [students]);

  const handleFile = useCallback(
    async (file: File) => {
      setParsing(true);
      setError(null);
      try {
        const ExcelJS = (await import("exceljs")).default;
        const buffer = await file.arrayBuffer();
        const wb = new ExcelJS.Workbook();
        await wb.xlsx.load(buffer);

        const metaSheet = wb.worksheets.find(
          (s) => s.name.toLowerCase() === "_metadata",
        );
        if (metaSheet) {
          const fileType = String(metaSheet.getCell("B1").value ?? "").trim();
          if (fileType === "exam")
            throw new Error("File ini adalah template Ujian, bukan template Rapor.");
          const fileSemKey = String(metaSheet.getCell("B2").value ?? "").trim();
          const fileSemLabel = String(metaSheet.getCell("B3").value ?? "").trim();
          if (currentSemesterKey && fileSemKey && fileSemKey !== currentSemesterKey) {
            throw new Error(
              `Template ini untuk semester "${fileSemLabel || fileSemKey}", tetapi Anda memilih semester "${currentSemesterLabel || currentSemesterKey}". Pilih semester yang sesuai atau gunakan file yang benar.`,
            );
          }
        }

        const sheetLower = wb.worksheets
          .filter((s) => s.name.toLowerCase() !== "_metadata")
          .map((s) => s.name.toLowerCase());
        const isK13 = sheetLower.includes("pengetahuan");

        if (isK13) {
          const pSheet = wb.worksheets.find(
            (s) => s.name.toLowerCase() === "pengetahuan",
          );
          const kSheet = wb.worksheets.find(
            (s) => s.name.toLowerCase() === "keterampilan",
          );
          if (!pSheet) throw new Error("Sheet 'Pengetahuan' tidak ditemukan.");
          const pR = extractSheetData(pSheet);
          const kR = kSheet ? extractSheetData(kSheet) : { codes: [], data: {} };
          const allCodes = [...new Set([...pR.codes, ...kR.codes])];

          setParsed({
            format: "k13",
            excelCodes: allCodes,
            pengetahuan: pR.data,
            keterampilan: kR.data,
          });
          setMapping(autoMatch(allCodes, subjects));
        } else {
          const sheet = wb.worksheets[0];
          if (!sheet) throw new Error("Sheet tidak ditemukan.");
          const r = extractSheetData(sheet);

          setParsed({
            format: "kurmer",
            excelCodes: r.codes,
            pengetahuan: r.data,
            keterampilan: {},
          });
          setMapping(autoMatch(r.codes, subjects));
        }
        setStep("mapping");
      } catch (err) {
        setError((err as Error).message || "Gagal membaca file Excel.");
      } finally {
        setParsing(false);
      }
    },
    [currentSemesterKey, currentSemesterLabel, subjects],
  );

  const mappedCount = Object.values(mapping).filter(Boolean).length;
  const totalCodes = parsed?.excelCodes.length ?? 0;

  const matchedStudentCount = useMemo(() => {
    if (!parsed) return 0;
    const allNisns = new Set([
      ...Object.keys(parsed.pengetahuan),
      ...Object.keys(parsed.keterampilan),
    ]);
    return [...allNisns].filter((n) => appNisns.has(n)).length;
  }, [parsed, appNisns]);

  const excelStudentCount = useMemo(() => {
    if (!parsed) return 0;
    return new Set([
      ...Object.keys(parsed.pengetahuan),
      ...Object.keys(parsed.keterampilan),
    ]).size;
  }, [parsed]);

  const doImport = useCallback(() => {
    if (!parsed) return;
    const mapData = (src: Record<string, Record<string, number>>) => {
      const out: Record<string, Record<string, number>> = {};
      for (const [nisn, scores] of Object.entries(src)) {
        out[nisn] = {};
        for (const [exCode, val] of Object.entries(scores)) {
          const appCode = mapping[exCode];
          if (appCode) out[nisn][appCode] = val;
        }
      }
      return out;
    };
    onImport({
      pengetahuan: mapData(parsed.pengetahuan),
      keterampilan: mapData(parsed.keterampilan),
    });
  }, [parsed, mapping, onImport]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="max-h-[85dvh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl dark:bg-slate-900">
        <h3 className="mb-4 text-lg font-bold">Import Nilai dari Excel</h3>

        {error && <p className="ui-alert ui-alert-error mb-4">{error}</p>}

        {/* ── Step 1: Upload ── */}
        {step === "upload" && (
          <div className="space-y-4">
            <p className="text-sm text-slate-600 dark:text-slate-300">
              Upload file Excel legger nilai (format RDM atau template).
            </p>
            <ul className="list-inside list-disc space-y-1 text-sm text-slate-500 dark:text-slate-400">
              <li>
                <strong>K13</strong> — Sheet &ldquo;Pengetahuan&rdquo; &amp;
                &ldquo;Keterampilan&rdquo;
              </li>
              <li>
                <strong>Kurikulum Merdeka</strong> — Sheet nama kelas (nilai
                masuk ke Pengetahuan saja)
              </li>
            </ul>

            <label className="flex cursor-pointer flex-col items-center gap-3 rounded-xl border-2 border-dashed border-slate-300 p-8 transition hover:border-indigo-400 hover:bg-indigo-50/30 dark:border-slate-600 dark:hover:border-indigo-500 dark:hover:bg-indigo-950/20">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-10 w-10 text-slate-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                />
              </svg>
              <span className="text-sm font-medium">
                {parsing ? "Membaca file..." : "Pilih file Excel (.xlsx)"}
              </span>
              <input
                type="file"
                accept=".xlsx,.xls"
                className="hidden"
                disabled={parsing}
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void handleFile(f);
                }}
              />
            </label>

            <div className="flex justify-end">
              <button type="button" onClick={onClose} className="ui-btn ui-btn-ghost">
                Batal
              </button>
            </div>
          </div>
        )}

        {/* ── Step 2: Subject mapping ── */}
        {step === "mapping" && parsed && (
          <div className="space-y-4">
            {/* Info badges */}
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-indigo-100 px-3 py-1 text-xs font-bold uppercase text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300">
                {parsed.format === "k13" ? "K13" : "Kurikulum Merdeka"}
              </span>
              <span className="text-xs text-slate-500 dark:text-slate-400">
                {totalCodes} kode mapel &middot; {matchedStudentCount}/
                {excelStudentCount} siswa cocok NISN
              </span>
            </div>

            {parsed.format === "kurmer" && (
              <p className="text-xs font-medium text-amber-600 dark:text-amber-400">
                Kurmer: semua nilai akan diimport ke aspek Pengetahuan saja.
              </p>
            )}

            <p className="text-sm text-slate-600 dark:text-slate-300">
              Cocokkan kode mapel di Excel dengan mapel di aplikasi.
              Pilih &ldquo;— Abaikan —&rdquo; untuk melewati kode yang tidak
              dibutuhkan.
            </p>

            {/* Mapping table */}
            <div className="max-h-[40dvh] overflow-y-auto rounded-xl border border-slate-200 dark:border-slate-700">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-slate-50 dark:bg-slate-800">
                  <tr>
                    <th className="px-3 py-2 text-left font-semibold">
                      Kode Excel
                    </th>
                    <th className="px-3 py-2 text-center font-semibold">→</th>
                    <th className="px-3 py-2 text-left font-semibold">
                      Mapel Aplikasi
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {parsed.excelCodes.map((ec) => (
                    <tr
                      key={ec}
                      className="border-t border-slate-100 dark:border-slate-700/50"
                    >
                      <td className="px-3 py-2 font-mono font-semibold">
                        {ec}
                      </td>
                      <td className="px-3 py-2 text-center text-slate-400">
                        →
                      </td>
                      <td className="px-3 py-2">
                        <select
                          className="ui-select w-full text-sm"
                          value={mapping[ec] ?? ""}
                          onChange={(e) =>
                            setMapping((prev) => ({
                              ...prev,
                              [ec]: e.target.value,
                            }))
                          }
                        >
                          <option value="">— Abaikan —</option>
                          {subjects.map((s) => (
                            <option key={s.kode} value={s.kode}>
                              {s.kode}
                              {s.nama ? ` — ${s.nama}` : ""}
                            </option>
                          ))}
                        </select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {matchedStudentCount === 0 && (
              <p className="ui-alert ui-alert-warn text-xs">
                Tidak ada NISN di file Excel yang cocok dengan siswa di
                aplikasi. Pastikan semester dan kelas sudah sesuai.
              </p>
            )}

            {/* Actions */}
            <div className="flex flex-wrap items-center justify-between gap-2">
              <button
                type="button"
                onClick={() => {
                  setStep("upload");
                  setParsed(null);
                  setError(null);
                }}
                className="ui-btn ui-btn-ghost text-xs"
              >
                ← Pilih file lain
              </button>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="ui-btn ui-btn-ghost"
                >
                  Batal
                </button>
                <button
                  type="button"
                  disabled={mappedCount === 0 || matchedStudentCount === 0}
                  onClick={doImport}
                  className="ui-btn ui-btn-primary"
                >
                  Import {mappedCount} mapel
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
