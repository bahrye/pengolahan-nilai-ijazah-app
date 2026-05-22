"use client";

import Link from "next/link";
import { useMemo, useRef, useState } from "react";

import { StudentQuotaBanner } from "@/components/subscription/StudentQuotaBanner";
import { useSubscriptionUsage } from "@/components/subscription/SubscriptionUsageProvider";
import { useToast } from "@/components/ToastProvider";
import {
  parseStudentImportWorksheet,
  pickStudentImportWorksheet,
  type ParsedStudentImportRow,
} from "@/lib/student-import-excel";
import type { ImportSkip, ImportWarning } from "@/server/actions/students";
import { importStudentsChunkAction } from "@/server/actions/students";

const IMPORT_CHUNK = 50;

function countPendingNewStudents(
  rows: ParsedStudentImportRow[],
  existingNisns: Set<string>,
): number {
  const seen = new Set<string>();
  let n = 0;
  for (const r of rows) {
    if (r.error) continue;
    if (!/^\d{10}$/.test(r.nisn)) continue;
    if (existingNisns.has(r.nisn)) continue;
    if (seen.has(r.nisn)) continue;
    seen.add(r.nisn);
    n += 1;
  }
  return n;
}

export function ImportMasterSiswaClient({
  activeYearLabel,
  existingNisns: existingNisnsProp,
}: {
  activeYearLabel: string | null;
  existingNisns: string[];
}) {
  const { toast } = useToast();
  const subscription = useSubscriptionUsage();
  const fileRef = useRef<HTMLInputElement>(null);

  const [importPreview, setImportPreview] = useState<ParsedStudentImportRow[] | null>(
    null,
  );
  const [detectedFormat, setDetectedFormat] = useState<"pdum" | "internal" | null>(
    null,
  );
  const [importResult, setImportResult] = useState<{
    imported: number;
    classesCreated: number;
    skipped: ImportSkip[];
    warnings: ImportWarning[];
  } | null>(null);
  const [importing, setImporting] = useState(false);
  const [importProgress, setImportProgress] = useState<
    | { kind: "parse"; loadedRows: number }
    | { kind: "upload"; processed: number; total: number }
    | null
  >(null);
  const [templateDownload, setTemplateDownload] = useState<
    | null
    | { phase: "connecting" | "downloading"; loaded: number; total: number | null }
  >(null);

  const canImport = activeYearLabel != null;

  const existingNisns = useMemo(
    () => new Set(existingNisnsProp),
    [existingNisnsProp],
  );

  const pendingImportNewCount = useMemo(() => {
    if (!importPreview) return 0;
    return countPendingNewStudents(importPreview, existingNisns);
  }, [importPreview, existingNisns]);

  const importExceedsQuota =
    subscription != null &&
    !subscription.studentQuotaUnlimited &&
    pendingImportNewCount > subscription.studentAddsRemaining;

  function applyQuotaFromServer(quota?: {
    studentAddsUsed: number;
    studentAddsRemaining: number;
  }) {
    if (quota) {
      subscription?.setStudentQuotaFromServer(
        quota.studentAddsUsed,
        quota.studentAddsRemaining,
      );
    }
  }

  async function handleDownloadTemplate() {
    if (!canImport || templateDownload !== null) return;
    setTemplateDownload({ phase: "connecting", loaded: 0, total: null });
    try {
      const res = await fetch("/api/students/template", { credentials: "include" });
      if (!res.ok) {
        let msg = "Gagal mengunduh template.";
        try {
          const j = (await res.json()) as { error?: string };
          if (typeof j.error === "string" && j.error) msg = j.error;
        } catch {
          /* default */
        }
        toast(msg, "error");
        return;
      }
      const buf = await res.arrayBuffer();
      const blob = new Blob([buf], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "template_import_master_siswa.xlsx";
      a.click();
      URL.revokeObjectURL(url);
      toast("Template berhasil diunduh.", "success");
    } catch (e) {
      toast((e as Error).message ?? "Gagal mengunduh template.", "error");
    } finally {
      setTemplateDownload(null);
    }
  }

  function handleFilePicked(e: React.ChangeEvent<HTMLInputElement>) {
    if (!canImport) return;
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true);
    setImportProgress({ kind: "parse", loadedRows: 0 });
    setImportPreview(null);
    setImportResult(null);
    setDetectedFormat(null);

    void (async () => {
      try {
        const ExcelJS = (await import("exceljs")).default;
        const buf = await file.arrayBuffer();
        const wb = new ExcelJS.Workbook();
        await wb.xlsx.load(buf);
        const ws = pickStudentImportWorksheet(wb.worksheets);
        if (!ws) {
          toast("Tidak ada sheet data siswa di file Excel.", "error");
          return;
        }

        const parsed = parseStudentImportWorksheet(ws);
        if (parsed.rows.length === 0) {
          toast(
            "Tidak ada baris siswa yang terbaca. Pastikan format template atau ekspor PDUM benar.",
            "error",
          );
          return;
        }

        setDetectedFormat(parsed.format);
        setImportPreview(parsed.rows);
        setImportProgress({ kind: "parse", loadedRows: parsed.rows.length });
      } catch (err) {
        toast(`Gagal membaca file: ${(err as Error).message}`, "error");
      } finally {
        setImportProgress(null);
        setImporting(false);
      }
    })();

    if (fileRef.current) fileRef.current.value = "";
  }

  async function confirmImport() {
    if (!canImport || !importPreview) return;
    const rowsWithMeta = importPreview
      .map((r) => ({ r, excelRow: r.excelRow }))
      .filter((x) => !x.r.error);
    if (rowsWithMeta.length === 0) {
      toast("Tidak ada baris yang valid untuk diimport.", "error");
      return;
    }

    setImporting(true);
    setImportProgress({ kind: "upload", processed: 0, total: rowsWithMeta.length });

    const allSkipped: ImportSkip[] = [];
    const allWarnings: ImportWarning[] = [];
    let importedSum = 0;
    let classesCreatedSum = 0;

    try {
      for (let i = 0; i < rowsWithMeta.length; i += IMPORT_CHUNK) {
        const slice = rowsWithMeta.slice(i, i + IMPORT_CHUNK);
        setImportProgress({
          kind: "upload",
          processed: i,
          total: rowsWithMeta.length,
        });
        const chunk = slice.map(({ r, excelRow }) => ({
          excelRow,
          nisn: r.nisn,
          name: r.name,
          gender: r.gender,
          birthPlace: r.birthPlace,
          birthDate: r.birthDate,
          className: r.className,
          classRoomName: r.classRoomName,
          nomorUjian: r.nomorUjian || undefined,
          ruangUjian: r.ruangUjian || "1",
          parentGuardianName: r.parentGuardianName || undefined,
          sklLetterNumber: r.sklLetterNumber || undefined,
          nis: r.nis || undefined,
        }));
        const res = await importStudentsChunkAction(chunk);
        if (!res.ok) {
          toast(res.message, "error");
          return;
        }
        importedSum += res.imported;
        classesCreatedSum += res.classesCreated;
        allSkipped.push(...res.skipped);
        allWarnings.push(...res.warnings);
        if (res.quota) applyQuotaFromServer(res.quota);
        else if (res.imported > 0) subscription?.applyStudentAdds(res.imported);
      }

      setImportResult({
        imported: importedSum,
        classesCreated: classesCreatedSum,
        skipped: allSkipped,
        warnings: allWarnings,
      });
      setImportPreview(null);
      setDetectedFormat(null);

      const parts = [`${importedSum} siswa berhasil diimport.`];
      if (classesCreatedSum > 0) {
        parts.push(`${classesCreatedSum} kelas baru dibuat di Data Kelas.`);
      }
      toast(parts.join(" "), "success");
      if (allWarnings.length > 0) {
        toast(
          `${allWarnings.length} baris memiliki NISN yang juga terdaftar di sekolah lain.`,
          "warning",
        );
      }
    } finally {
      setImportProgress(null);
      setImporting(false);
    }
  }

  const invalidImportCount = importPreview?.filter((r) => r.error).length ?? 0;
  const validImportCount = (importPreview?.length ?? 0) - invalidImportCount;

  return (
    <div className="min-w-0 w-full space-y-8 overflow-x-hidden">
      <div className="max-w-3xl space-y-1">
        <h1 className="ui-page-title">Import Master Siswa</h1>
        <p className="ui-muted text-pretty">
          Unggah data siswa sekaligus dari template dinas atau ekspor PDUM Kemenag.
          Nomor peserta ujian, ruang ujian, kelas, nama ayah, nomor surat SKL, dan
          NIS lokal akan diisi otomatis.
        </p>
      </div>

      {!activeYearLabel ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-200">
          Belum ada tahun ajaran aktif. Buat dan aktifkan tahun ajaran di{" "}
          <Link href="/dashboard/tahun-ajaran" className="font-semibold underline">
            Tahun Ajaran
          </Link>{" "}
          agar kelas dari file dapat dibuat otomatis di menu Data Kelas.
        </div>
      ) : (
        <p className="text-sm text-slate-600 dark:text-slate-400">
          Tahun ajaran aktif: <strong>{activeYearLabel}</strong> — kelas baru dari
          kolom Kelas akan ditambahkan ke Data Kelas untuk tahun ini.
        </p>
      )}

      <section className="ui-card ui-card-tight space-y-4">
        <h2 className="ui-section-title">Panduan</h2>
        <div className="space-y-3 text-sm text-slate-700 dark:text-slate-300">
          <p>
            <strong>Dari dinas / format standar:</strong> unduh template Excel di
            bawah, lengkapi data siswa, lalu unggah file yang sama.
          </p>
          <p>
            <strong>Khusus Kemenag (PDUM):</strong> di aplikasi PDUM buka{" "}
            <span className="font-medium">
              Siswa Tingkat Akhir → Cetak DNT → Download Data
            </span>
            , lalu unggah file Excel yang diunduh tanpa mengubah struktur kolom.
          </p>
          <ul className="list-disc space-y-1 pl-5 text-slate-600 dark:text-slate-400">
            <li>
              <strong>Nomor Peserta</strong> → nomor peserta ujian (kelengkapan
              cetak)
            </li>
            <li>
              <strong>Nomor ruang</strong> default <strong>1</strong> jika kosong
            </li>
            <li>
              <strong>Kelas</strong> (mis. &quot;Kelas 9&quot;) → nama kelas{" "}
              <strong>9</strong> di Data Kelas
            </li>
            <li>
              <strong>Nama Ayah</strong> → data SKL (nama orang tua/wali)
            </li>
            <li>
              <strong>Nomor Surat SKL</strong> → nomor surat per siswa di menu SKL
            </li>
            <li>
              <strong>NIS Lokal</strong> → nomor induk siswa madrasah (NIS lengkap)
            </li>
          </ul>
        </div>
      </section>

      <section
        className={`ui-card ui-card-tight${!canImport ? " opacity-90" : ""}`}
        aria-disabled={!canImport}
      >
        <h2 className="ui-section-title mb-4">Unduh & unggah file</h2>
        {!canImport ? (
          <p className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-200">
            Unduh template dan unggah file dinonaktifkan sampai ada tahun ajaran
            yang aktif. Atur di{" "}
            <Link href="/dashboard/tahun-ajaran" className="font-semibold underline">
              Tahun Ajaran
            </Link>
            .
          </p>
        ) : null}
        <StudentQuotaBanner
          pendingAdds={importPreview ? pendingImportNewCount : 0}
          className="mb-4"
        />
        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            disabled={!canImport || templateDownload !== null}
            title={
              !canImport ? "Aktifkan tahun ajaran terlebih dahulu" : undefined
            }
            onClick={() => void handleDownloadTemplate()}
            className="ui-btn ui-btn-primary disabled:cursor-not-allowed disabled:opacity-50"
          >
            {templateDownload ? "Mengunduh template…" : "Download template Excel"}
          </button>
          <label
            className={`ui-btn ui-btn-success ${
              canImport && !importing && templateDownload === null
                ? "cursor-pointer"
                : "cursor-not-allowed opacity-50 pointer-events-none"
            }`}
            title={
              !canImport ? "Aktifkan tahun ajaran terlebih dahulu" : undefined
            }
          >
            {importing && importProgress?.kind === "parse"
              ? `Membaca file… (${importProgress.loadedRows} baris)`
              : importing && importProgress?.kind === "upload"
                ? `Mengimport… (${importProgress.processed}/${importProgress.total})`
                : importing
                  ? "Memproses…"
                  : "Upload file Excel"}
            <input
              ref={fileRef}
              type="file"
              accept=".xlsx,.xls"
              className="hidden"
              disabled={!canImport || importing || templateDownload !== null}
              onChange={handleFilePicked}
            />
          </label>
        </div>

        {canImport && detectedFormat && importPreview ? (
          <p className="mt-3 text-sm text-slate-600 dark:text-slate-400">
            Format terdeteksi:{" "}
            <strong>
              {detectedFormat === "pdum"
                ? "Ekspor PDUM Kemenag"
                : "Template standar aplikasi"}
            </strong>
            {" · "}
            {validImportCount} baris siap, {invalidImportCount} baris bermasalah.
          </p>
        ) : null}

        {canImport && importPreview && importPreview.length > 0 ? (
          <div className="mt-6 space-y-4">
            <div className="max-h-64 overflow-auto rounded-lg border border-slate-200 dark:border-slate-700">
              <table className="w-full min-w-[640px] text-left text-xs">
                <thead className="sticky top-0 bg-slate-100 dark:bg-slate-800">
                  <tr>
                    <th className="px-2 py-2">Baris</th>
                    <th className="px-2 py-2">NISN</th>
                    <th className="px-2 py-2">Nama</th>
                    <th className="px-2 py-2">Kelas</th>
                    <th className="px-2 py-2">No. peserta</th>
                    <th className="px-2 py-2">Nama ayah</th>
                    <th className="px-2 py-2">No. surat SKL</th>
                    <th className="px-2 py-2">NIS lokal</th>
                    <th className="px-2 py-2">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {importPreview.slice(0, 80).map((r) => (
                    <tr
                      key={r.excelRow}
                      className={
                        r.error
                          ? "bg-red-50/80 dark:bg-red-950/30"
                          : "odd:bg-white even:bg-slate-50/50 dark:odd:bg-slate-900 dark:even:bg-slate-900/50"
                      }
                    >
                      <td className="px-2 py-1.5">{r.excelRow}</td>
                      <td className="px-2 py-1.5 font-mono">{r.nisn || "—"}</td>
                      <td className="px-2 py-1.5">{r.name || "—"}</td>
                      <td className="px-2 py-1.5">{r.className || "—"}</td>
                      <td className="px-2 py-1.5">{r.nomorUjian || "—"}</td>
                      <td className="px-2 py-1.5">{r.parentGuardianName || "—"}</td>
                      <td className="px-2 py-1.5">{r.sklLetterNumber || "—"}</td>
                      <td className="px-2 py-1.5">{r.nis || "—"}</td>
                      <td className="px-2 py-1.5">
                        {r.error ? (
                          <span className="text-red-600 dark:text-red-400">
                            {r.error}
                          </span>
                        ) : (
                          <span className="text-emerald-600 dark:text-emerald-400">
                            OK
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {importPreview.length > 80 ? (
              <p className="text-xs text-slate-500">
                Menampilkan 80 baris pertama dari {importPreview.length} baris.
              </p>
            ) : null}
            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                className="ui-btn ui-btn-success"
                disabled={
                  importing || validImportCount === 0 || importExceedsQuota
                }
                onClick={() => void confirmImport()}
              >
                Import {validImportCount} siswa
              </button>
              <button
                type="button"
                className="ui-btn ui-btn-ghost"
                disabled={importing}
                onClick={() => {
                  setImportPreview(null);
                  setDetectedFormat(null);
                }}
              >
                Batal
              </button>
            </div>
            {importExceedsQuota ? (
              <p className="text-sm text-amber-700 dark:text-amber-400">
                Kuota penambahan siswa tidak mencukupi. Kurangi jumlah baris atau
                berlangganan di menu Langganan.
              </p>
            ) : null}
          </div>
        ) : null}

        {importResult ? (
          <div className="mt-6 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm dark:border-slate-700 dark:bg-slate-900/50">
            <p className="font-semibold text-slate-900 dark:text-slate-100">
              Hasil import terakhir
            </p>
            <ul className="mt-2 list-disc pl-5 text-slate-700 dark:text-slate-300">
              <li>{importResult.imported} siswa ditambahkan</li>
              {importResult.classesCreated > 0 ? (
                <li>
                  {importResult.classesCreated} kelas baru dibuat — cek{" "}
                  <Link href="/dashboard/kelas" className="font-medium underline">
                    Data Kelas
                  </Link>
                </li>
              ) : null}
              {importResult.skipped.length > 0 ? (
                <li>{importResult.skipped.length} baris dilewati</li>
              ) : null}
            </ul>
            {importResult.skipped.length > 0 ? (
              <details className="mt-3">
                <summary className="cursor-pointer font-medium">
                  Detail baris dilewati
                </summary>
                <ul className="mt-2 max-h-40 overflow-auto space-y-1 text-xs">
                  {importResult.skipped.map((s) => (
                    <li key={`${s.row}-${s.nisn}`}>
                      Baris {s.row}: {s.nisn} — {s.name}: {s.reason}
                    </li>
                  ))}
                </ul>
              </details>
            ) : null}
            <p className="mt-4">
              <Link href="/dashboard/siswa" className="ui-btn ui-btn-ghost text-sm">
                Lihat Data Siswa
              </Link>
            </p>
          </div>
        ) : null}
      </section>
    </div>
  );
}
