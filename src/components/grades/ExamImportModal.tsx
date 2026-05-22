"use client";

import { useCallback, useMemo, useState } from "react";

type SubjProp = { id: string; kode: string; nama: string; jenisUjian: string };

export type ImportedExamData = {
  tertulis: Record<string, Record<string, number>>;
  praktek: Record<string, Record<string, number>>;
};

type SheetKind = "tertulis" | "praktek";

type ParsedSheet = {
  kind: SheetKind;
  excelCodes: string[];
  data: Record<string, Record<string, number>>;
};

type ParsedResult = {
  sheets: ParsedSheet[];
  allCodes: { code: string; kind: SheetKind }[];
};

function cellStr(cell: { value: unknown }): string {
  const v = cell?.value;
  if (v === null || v === undefined) return "";
  if (typeof v === "object" && v !== null && "result" in v)
    return String((v as { result: unknown }).result ?? "").trim();
  return String(v).trim();
}

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
      if (val === "nisn") { headerRowIdx = r; nisnColIdx = c; }
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
    if (sv && isNaN(Number(sv))) { hasSubHeader = true; break; }
  }

  const codeColMap: { col: number; code: string }[] = [];
  const codes: string[] = [];
  let emptyStreak = 0;

  for (let c = startCol; c <= 200; c++) {
    const hv = cellStr(headerRow.getCell(c));
    const sv = hasSubHeader ? cellStr(subRow.getCell(c)) : "";
    if (!hv && !sv) { emptyStreak++; if (emptyStreak >= 3) break; continue; }
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
      if (!isNaN(num) && num >= 0 && num <= 100) data[nisn][code] = num;
    }
  }

  return { codes, data };
}

function autoMatch(
  allCodes: { code: string; kind: SheetKind }[],
  appSubjects: SubjProp[],
): Record<string, string> {
  const mapping: Record<string, string> = {};
  const appCodes = appSubjects.map((s) => s.kode);
  for (const { code, kind } of allCodes) {
    const key = `${kind}::${code}`;
    const exact = appCodes.find((ac) => ac.toLowerCase() === code.toLowerCase());
    mapping[key] = exact ?? "";
  }
  return mapping;
}

export function ExamImportModal({
  subjects,
  students,
  onImport,
  onClose,
}: {
  subjects: SubjProp[];
  students: { nisn: string; name: string }[];
  onImport: (data: ImportedExamData) => void;
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
          if (fileType === "rapor")
            throw new Error("File ini adalah template Rapor, bukan template Ujian.");
        }

        const dataSheets = wb.worksheets.filter(
          (s) => s.name.toLowerCase() !== "_metadata",
        );
        if (dataSheets.length === 0) throw new Error("Sheet tidak ditemukan.");

        const parsedSheets: ParsedSheet[] = [];
        const allCodes: { code: string; kind: SheetKind }[] = [];

        for (const sheet of dataSheets) {
          const name = sheet.name.toLowerCase();
          const kind: SheetKind = name.includes("praktik") || name.includes("praktek")
            ? "praktek"
            : "tertulis";
          const r = extractSheetData(sheet);
          if (r.codes.length === 0) continue;
          parsedSheets.push({ kind, excelCodes: r.codes, data: r.data });
          for (const code of r.codes) {
            if (!allCodes.some((c) => c.code === code && c.kind === kind)) {
              allCodes.push({ code, kind });
            }
          }
        }

        if (allCodes.length === 0)
          throw new Error("Tidak ditemukan kode mapel di header Excel.");

        setParsed({ sheets: parsedSheets, allCodes });
        setMapping(autoMatch(allCodes, subjects));
        setStep("mapping");
      } catch (err) {
        setError((err as Error).message || "Gagal membaca file Excel.");
      } finally {
        setParsing(false);
      }
    },
    [subjects],
  );

  const mappedCount = Object.values(mapping).filter(Boolean).length;

  const matchedStudentCount = useMemo(() => {
    if (!parsed) return 0;
    const allNisns = new Set<string>();
    for (const sh of parsed.sheets) {
      for (const n of Object.keys(sh.data)) allNisns.add(n);
    }
    return [...allNisns].filter((n) => appNisns.has(n)).length;
  }, [parsed, appNisns]);

  const excelStudentCount = useMemo(() => {
    if (!parsed) return 0;
    const allNisns = new Set<string>();
    for (const sh of parsed.sheets) {
      for (const n of Object.keys(sh.data)) allNisns.add(n);
    }
    return allNisns.size;
  }, [parsed]);

  const doImport = useCallback(() => {
    if (!parsed) return;
    const tertulis: Record<string, Record<string, number>> = {};
    const praktek: Record<string, Record<string, number>> = {};

    for (const sheet of parsed.sheets) {
      for (const [nisn, scores] of Object.entries(sheet.data)) {
        for (const [exCode, val] of Object.entries(scores)) {
          const key = `${sheet.kind}::${exCode}`;
          const appCode = mapping[key];
          if (!appCode) continue;

          if (sheet.kind === "tertulis") {
            if (!tertulis[nisn]) tertulis[nisn] = {};
            tertulis[nisn][appCode] = val;
          } else {
            if (!praktek[nisn]) praktek[nisn] = {};
            praktek[nisn][appCode] = val;
          }
        }
      }
    }
    onImport({ tertulis, praktek });
  }, [parsed, mapping, onImport]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="max-h-[85dvh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl dark:bg-slate-900">
        <h3 className="mb-4 text-lg font-bold">Import Nilai Ujian dari Excel</h3>

        {error && <p className="ui-alert ui-alert-error mb-4">{error}</p>}

        {step === "upload" && (
          <div className="space-y-4">
            <p className="text-sm text-slate-600 dark:text-slate-300">
              Upload file Excel yang berisi nilai ujian. Semua sheet
              (Tertulis &amp; Praktik) akan dibaca otomatis.
            </p>

            <label className="flex cursor-pointer flex-col items-center gap-3 rounded-xl border-2 border-dashed border-slate-300 p-8 transition hover:border-indigo-400 hover:bg-indigo-50/30 dark:border-slate-600 dark:hover:border-indigo-500 dark:hover:bg-indigo-950/20">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
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

        {step === "mapping" && parsed && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs text-slate-500 dark:text-slate-400">
                {parsed.allCodes.length} kode mapel &middot;{" "}
                {matchedStudentCount}/{excelStudentCount} siswa cocok NISN
              </span>
            </div>

            <p className="text-sm text-slate-600 dark:text-slate-300">
              Cocokkan kode mapel di Excel dengan mapel di aplikasi. Data akan
              dimasukkan ke kolom Tertulis atau Praktik sesuai sheet asal.
            </p>

            <div className="max-h-[35dvh] overflow-y-auto rounded-xl border border-slate-200 dark:border-slate-700">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-slate-50 dark:bg-slate-800">
                  <tr>
                    <th className="px-3 py-2 text-left font-semibold">Sheet</th>
                    <th className="px-3 py-2 text-left font-semibold">Kode Excel</th>
                    <th className="px-3 py-2 text-center font-semibold">→</th>
                    <th className="px-3 py-2 text-left font-semibold">Mapel Aplikasi</th>
                  </tr>
                </thead>
                <tbody>
                  {parsed.allCodes.map(({ code, kind }) => {
                    const key = `${kind}::${code}`;
                    return (
                      <tr key={key} className="border-t border-slate-100 dark:border-slate-700/50">
                        <td className="px-3 py-2">
                          <span className={`inline-block rounded px-1.5 py-0.5 text-[11px] font-semibold ${kind === "tertulis" ? "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300" : "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300"}`}>
                            {kind === "tertulis" ? "Tertulis" : "Praktik"}
                          </span>
                        </td>
                        <td className="px-3 py-2 font-mono font-semibold">{code}</td>
                        <td className="px-3 py-2 text-center text-slate-400">→</td>
                        <td className="px-3 py-2">
                          <select
                            className="ui-select w-full text-sm"
                            value={mapping[key] ?? ""}
                            onChange={(e) =>
                              setMapping((prev) => ({ ...prev, [key]: e.target.value }))
                            }
                          >
                            <option value="">— Abaikan —</option>
                            {subjects.map((s) => (
                              <option key={s.kode} value={s.kode}>
                                {s.kode} — {s.nama}
                              </option>
                            ))}
                          </select>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {matchedStudentCount === 0 && (
              <p className="ui-alert ui-alert-warn text-xs">
                Tidak ada NISN di file Excel yang cocok dengan siswa di aplikasi.
              </p>
            )}

            <div className="flex flex-wrap items-center justify-between gap-2">
              <button
                type="button"
                onClick={() => { setStep("upload"); setParsed(null); setError(null); }}
                className="ui-btn ui-btn-ghost text-xs"
              >
                ← Pilih file lain
              </button>
              <div className="flex gap-2">
                <button type="button" onClick={onClose} className="ui-btn ui-btn-ghost">
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
