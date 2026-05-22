"use client";

import { useCallback, useMemo, useState } from "react";

import { useToast } from "@/components/ToastProvider";
import { importTeachersBulkAction } from "@/server/actions/teachers";

type Subj = { id: string; kode: string; nama?: string };
type Kelas = { id: string; name: string };

function cellStr(cell: { value: unknown; text?: string }): string {
  /* exceljs: `.text` mengikuti tipe (hyperlink, richText, formula result); lebih andal daripada `value` mentah. */
  if (cell && typeof cell.text === "string") {
    return cell.text.replace(/\u00a0/g, " ").trim();
  }
  const v = cell?.value;
  if (v === null || v === undefined) return "";
  if (typeof v === "object" && v !== null && "result" in v)
    return String((v as { result: unknown }).result ?? "").trim();
  return String(v).trim();
}

function normHeader(s: string): string {
  return s
    .toLowerCase()
    .replace(/\s*\([^)]*\)\s*/g, " ")
    .replace(/[*:]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function findInputColumns(headerRow: { getCell: (n: number) => { value: unknown } }): {
  email: number;
  nama: number;
  nip: number;
  mapel: number;
  kelas: number;
} | null {
  let email = 0;
  let nama = 0;
  let nip = 0;
  let mapel = 0;
  let kelas = 0;
  for (let c = 1; c <= 30; c++) {
    const h = normHeader(cellStr(headerRow.getCell(c)));
    if (h === "email" || h.startsWith("email ")) email = c;
    else if (h === "nama" || h.startsWith("nama ")) nama = c;
    else if (h === "nip" || h.startsWith("nip ")) nip = c;
    else if (h.includes("pilih mapel") || h === "mapel") mapel = c;
    else if (h.includes("pilih kelas") || h === "kelas") kelas = c;
  }
  if (!email || !nama) return null;
  return { email, nama, nip, mapel, kelas };
}

/** exceljs Worksheet punya `dataValidations` di runtime; typings resmi tidak lengkap. */
type WorksheetWithDataValidations = {
  dataValidations: {
    add: (
      address: string,
      validation: {
        type: string;
        allowBlank?: boolean;
        formulae?: string[];
        showErrorMessage?: boolean;
        errorStyle?: string;
        errorTitle?: string;
        error?: string;
        showInputMessage?: boolean;
        promptTitle?: string;
        prompt?: string;
      },
    ) => void;
  };
};

export function buildTeacherImportTemplate(
  subjects: Subj[],
  classRooms: Kelas[],
  yearLabel: string,
): Promise<Blob> {
  return (async () => {
    const ExcelJS = (await import("exceljs")).default;
    const wb = new ExcelJS.Workbook();
    wb.creator = "Sistem Nilai Ijazah";

    /* Sheet pertama = Input (dibuka default di Excel). */
    const wsIn = wb.addWorksheet("Input", { properties: { tabColor: { argb: "FFCA8A04" } } });
    const headers = [
      "Email (wajib)",
      "Nama (wajib)",
      "NIP (opsional)",
      "Pilih mapel (opsional)",
      "Pilih kelas (opsional)",
    ];
    headers.forEach((h, i) => {
      const cell = wsIn.getCell(1, i + 1);
      cell.value = h;
      cell.font = { bold: true };
    });
    wsIn.columns = [{ width: 32 }, { width: 28 }, { width: 16 }, { width: 40 }, { width: 28 }];
    for (let row = 2; row <= 500; row++) {
      for (let col = 1; col <= 5; col++) {
        wsIn.getCell(row, col).protection = { locked: false };
      }
    }
    wsIn.getRow(1).protection = { locked: false };

    const wsMapel = wb.addWorksheet("Referensi_mapel", {
      properties: { tabColor: { argb: "FF4338CA" } },
    });
    wsMapel.getCell("A1").value = "Kode";
    wsMapel.getCell("B1").value = "Nilai untuk kolom Pilih mapel (sheet Input)";
    wsMapel.getRow(1).font = { bold: true };
    let r = 2;
    for (const s of subjects) {
      wsMapel.getCell(`A${r}`).value = s.kode;
      wsMapel.getCell(`B${r}`).value = `${s.kode} — ${s.nama ?? ""}`;
      r += 1;
    }
    wsMapel.columns = [{ width: 12 }, { width: 48 }];
    try {
      await wsMapel.protect("", {
        selectLockedCells: true,
        selectUnlockedCells: false,
        formatCells: false,
        formatColumns: false,
        formatRows: false,
        insertColumns: false,
        insertRows: false,
        deleteColumns: false,
        deleteRows: false,
      });
    } catch {
      /* lembar referensi tetap bisa diedit jika proteksi tidak didukung */
    }

    const wsKelas = wb.addWorksheet("Referensi_kelas", {
      properties: { tabColor: { argb: "FF0D9488" } },
    });
    wsKelas.getCell("A1").value = "Nama kelas";
    wsKelas.getCell("B1").value = "Nilai untuk kolom Pilih kelas (sheet Input)";
    wsKelas.getRow(1).font = { bold: true };
    r = 2;
    for (const c of classRooms) {
      const m = /\s*\(([^)]+)\)\s*$/.exec(c.name);
      wsKelas.getCell(`A${r}`).value = m ? c.name.slice(0, c.name.length - m[0].length).trim() : c.name;
      wsKelas.getCell(`B${r}`).value = c.name.trim();
      r += 1;
    }
    wsKelas.columns = [{ width: 18 }, { width: 36 }];
    try {
      await wsKelas.protect("", {
        selectLockedCells: true,
        selectUnlockedCells: false,
        formatCells: false,
        formatColumns: false,
        formatRows: false,
        insertColumns: false,
        insertRows: false,
        deleteColumns: false,
        deleteRows: false,
      });
    } catch {
      /* */
    }

    const wsDv = wsIn as unknown as WorksheetWithDataValidations;
    const lastMapel = Math.max(2, subjects.length + 1);
    if (subjects.length > 0) {
      wsDv.dataValidations.add("D2:D500", {
        type: "list",
        allowBlank: true,
        showErrorMessage: true,
        errorStyle: "stop",
        errorTitle: "Mapel",
        error: "Pilih salah satu mapel dari daftar (kolom B sheet Referensi_mapel) atau kosongkan.",
        formulae: [`=Referensi_mapel!$B$2:$B$${lastMapel}`],
      });
    }
    const lastKelas = Math.max(2, classRooms.length + 1);
    if (classRooms.length > 0) {
      wsDv.dataValidations.add("E2:E500", {
        type: "list",
        allowBlank: true,
        showErrorMessage: true,
        errorStyle: "stop",
        errorTitle: "Kelas",
        error: "Pilih salah satu kelas dari daftar (kolom B sheet Referensi_kelas) atau kosongkan.",
        formulae: [`=Referensi_kelas!$B$2:$B$${lastKelas}`],
      });
    }

    const meta = wb.addWorksheet("_petunjuk");
    meta.getCell("A1").value =
      "Lembar pertama: Input. Email & Nama wajib. NIP opsional. Satu guru boleh beberapa baris dengan email yang sama untuk beberapa kombinasi mapel+kelas; nama (dan NIP jika diisi) harus konsisten di semua baris itu. Kolom Pilih mapel / Pilih kelas memakai dropdown dari sheet referensi (opsional). Jangan mengubah nama sheet agar validasi tetap berfungsi.";
    meta.getCell("A2").value = `Tahun ajaran aktif (label kelas): ${yearLabel}`;
    meta.getCell("A1").alignment = { wrapText: true };
    meta.getColumn(1).width = 90;
    meta.state = "veryHidden";

    const buf = await wb.xlsx.writeBuffer();
    return new Blob([buf], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
  })();
}

export function GuruImportModal(props: {
  onClose: () => void;
  onImported: () => void;
}) {
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState<
    { excelRow: number; email: string; nama: string; nip: string; mapel: string; kelas: string }[]
  | null>(null);
  const [dupMsg, setDupMsg] = useState<string | null>(null);
  const [selectedFileName, setSelectedFileName] = useState<string | null>(null);

  const parseFile = useCallback(
    async (file: File) => {
      setDupMsg(null);
      setPreview(null);
      const ExcelJS = (await import("exceljs")).default;
      const buf = await file.arrayBuffer();
      const wb = new ExcelJS.Workbook();
      await wb.xlsx.load(buf);
      const sheet =
        wb.getWorksheet("Input") ??
        wb.worksheets.find((w) => /input/i.test(w.name)) ??
        wb.worksheets[0];
      if (!sheet) {
        toast("File tidak berisi lembar kerja.", "error");
        return;
      }

      let headerRowIdx = 1;
      const firstRow = findInputColumns(sheet.getRow(1));
      if (!firstRow) {
        for (let tryR = 1; tryR <= 15; tryR++) {
          const cols = findInputColumns(sheet.getRow(tryR));
          if (cols) {
            headerRowIdx = tryR;
            break;
          }
        }
      }
      const cols = findInputColumns(sheet.getRow(headerRowIdx));
      if (!cols) {
        toast("Baris judul tidak ditemukan (butuh kolom Email dan Nama).", "error");
        return;
      }

      const out: {
        excelRow: number;
        email: string;
        nama: string;
        nip: string;
        mapel: string;
        kelas: string;
      }[] = [];

      /* rowCount sering = baris terakhir berisi data di file; file dari Excel bisa hanya 1 baris judul.
         Selalu pindai area cukup besar di bawah header agar baris data tidak terlewat. */
      const maxDataRow = Math.min(Math.max(sheet.rowCount, headerRowIdx + 500), 10_000);

      for (let excelRow = headerRowIdx + 1; excelRow <= maxDataRow; excelRow++) {
        const row = sheet.getRow(excelRow);
        const email = cellStr(row.getCell(cols.email));
        const nama = cellStr(row.getCell(cols.nama));
        if (!email && !nama) continue;
        const nip = cols.nip ? cellStr(row.getCell(cols.nip)) : "";
        const mapel = cols.mapel ? cellStr(row.getCell(cols.mapel)) : "";
        const kelas = cols.kelas ? cellStr(row.getCell(cols.kelas)) : "";
        out.push({ excelRow, email, nama, nip, mapel, kelas });
      }

      const byEmail = new Map<string, typeof out>();
      for (const row of out) {
        const k = row.email.trim().toLowerCase();
        if (!k) continue;
        if (!byEmail.has(k)) byEmail.set(k, []);
        const bucket = byEmail.get(k);
        if (bucket) bucket.push(row);
      }
      let blockMsg: string | null = null;
      for (const [emailKey, group] of byEmail) {
        if (group.length <= 1) continue;
        const namas = new Set(group.map((g) => g.nama.trim()));
        if (namas.size > 1) {
          blockMsg = `Email "${emailKey}" dipakai di beberapa baris dengan nama yang berbeda. Samakan nama untuk guru yang sama.`;
          break;
        }
        const nips = new Set(group.map((g) => g.nip.trim()).filter(Boolean));
        if (nips.size > 1) {
          blockMsg = `Email "${emailKey}" dipakai di beberapa baris dengan NIP yang berbeda. Samakan NIP di semua baris itu.`;
          break;
        }
      }
      if (blockMsg) {
        setDupMsg(blockMsg);
        setPreview(out);
        return;
      }

      if (out.length === 0) {
        toast(
          "Tidak ada baris data: isi kolom Email dan Nama mulai baris tepat di bawah judul (baris 2 dst.), lalu pilih file lagi atau simpan ulang file Excel.",
          "info",
        );
      }

      setPreview(out);
    },
    [toast],
  );

  const payloadRows = useMemo(() => {
    if (!preview || dupMsg) return [];
    return preview.map((p) => ({
      email: p.email.trim(),
      nama: p.nama.trim(),
      nip: p.nip.trim() || null,
      mapelPilihan: p.mapel.trim() || null,
      kelasPilihan: p.kelas.trim() || null,
    }));
  }, [preview, dupMsg]);

  async function onConfirmImport() {
    if (!preview?.length || dupMsg) return;
    setBusy(true);
    try {
      const r = await importTeachersBulkAction(payloadRows);
      if (!r.ok) {
        toast(r.message, "error");
        return;
      }
      toast(
        `Berhasil: ${r.imported} guru. Penugasan diproses: ${r.assignmentsUpserted}.`,
        "success",
      );
      props.onImported();
      props.onClose();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-[70] flex items-end justify-center bg-slate-900/55 p-0 backdrop-blur-sm sm:items-center sm:p-4 sm:pt-[max(1rem,env(safe-area-inset-top))] sm:pb-[max(1rem,env(safe-area-inset-bottom))]"
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="guru-import-title"
        aria-busy={busy}
        className="ui-card flex max-h-[min(92dvh,calc(100dvh-env(safe-area-inset-top)-env(safe-area-inset-bottom)-0.5rem))] w-full max-w-2xl flex-col overflow-hidden rounded-t-2xl rounded-b-none p-0 sm:max-h-[min(90dvh,calc(100dvh-env(safe-area-inset-top)-env(safe-area-inset-bottom)-2rem))] sm:rounded-2xl sm:rounded-b-2xl"
      >
        <div className="shrink-0 border-b border-slate-200 px-4 py-3 dark:border-slate-700 sm:px-5 sm:py-4">
          <h3 id="guru-import-title" className="text-base font-bold text-slate-900 sm:text-lg dark:text-white">
            Import guru dari Excel
          </h3>
          <p className="mt-1.5 text-xs leading-relaxed text-slate-600 sm:text-sm dark:text-slate-400">
            Wajib: <strong>Email</strong> dan <strong>Nama</strong>. Opsional: NIP, Pilih mapel, Pilih kelas (keduanya
            harus diisi jika ingin penugasan). Satu guru bisa beberapa baris dengan email sama untuk mapel/kelas
            berbeda; nama dan NIP harus konsisten. Gunakan template dari halaman ini: lembar <strong>Input</strong>{" "}
            pertama; kolom mapel & kelas memakai dropdown dari sheet referensi.
          </p>
        </div>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain px-4 py-3 subtle-scrollbar sm:px-5 sm:py-4">
          <label className="block">
            <span className="mb-1.5 block text-[12px] font-bold uppercase tracking-wide text-slate-500">
              Pilih file .xlsx
            </span>
            <input
              type="file"
              accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              disabled={busy}
              className="block w-full text-sm"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (!f) return;
                setSelectedFileName(f.name);
                void parseFile(f);
              }}
            />
            {selectedFileName ? (
              <p className="mt-1.5 text-sm text-slate-600 dark:text-slate-400">
                Berkas terpilih: <span className="font-medium text-slate-800 dark:text-slate-200">{selectedFileName}</span>
              </p>
            ) : null}
          </label>

          {dupMsg ? (
            <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-medium text-rose-900 dark:border-rose-500/40 dark:bg-rose-950/60 dark:text-rose-100">
              {dupMsg}
            </p>
          ) : null}

          {preview !== null && preview.length === 0 && !dupMsg ? (
            <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950 dark:border-amber-500/40 dark:bg-amber-950/50 dark:text-amber-100">
              File terbaca, tetapi belum ada baris dengan Email atau Nama. Isi data di lembar Input mulai baris di
              bawah judul, simpan, lalu unggah lagi.
            </p>
          ) : null}

          {preview && preview.length > 0 ? (
            <div className="space-y-2">
              <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                Pratinjau ({preview.length} baris){dupMsg ? " — perbaiki pesan di atas sebelum impor." : ""}
              </p>
              <div className="max-h-[40dvh] min-h-0 overflow-auto rounded-xl border border-slate-200 sm:max-h-52 dark:border-slate-700">
                <div className="min-w-0 overflow-x-auto">
                  <table className="w-full min-w-[32rem] border-collapse text-left text-[12px]">
                    <thead className="sticky top-0 z-[1] bg-slate-100 dark:bg-slate-800">
                    <tr>
                      <th className="border-b px-2 py-1.5">Baris</th>
                      <th className="border-b px-2 py-1.5">Email</th>
                      <th className="border-b px-2 py-1.5">Nama</th>
                      <th className="border-b px-2 py-1.5">Mapel</th>
                      <th className="border-b px-2 py-1.5">Kelas</th>
                    </tr>
                  </thead>
                  <tbody>
                    {preview.map((p) => (
                      <tr key={p.excelRow} className="odd:bg-white even:bg-slate-50/80 dark:odd:bg-slate-900/40 dark:even:bg-slate-800/40">
                        <td className="border-b border-slate-100 px-2 py-1 tabular-nums dark:border-slate-700">
                          {p.excelRow}
                        </td>
                        <td className="border-b border-slate-100 px-2 py-1 font-mono text-[11px] dark:border-slate-700">
                          {p.email || "—"}
                        </td>
                        <td className="border-b border-slate-100 px-2 py-1 dark:border-slate-700">{p.nama || "—"}</td>
                        <td className="border-b border-slate-100 px-2 py-1 text-slate-600 dark:border-slate-700">
                          {p.mapel || "—"}
                        </td>
                        <td className="border-b border-slate-100 px-2 py-1 text-slate-600 dark:border-slate-700">
                          {p.kelas || "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  </table>
                </div>
              </div>
            </div>
          ) : null}
        </div>

        {busy ? (
          <div
            className="shrink-0 border-t border-indigo-200/80 bg-indigo-50/90 px-4 py-3 dark:border-indigo-500/30 dark:bg-indigo-950/50 sm:px-5"
            aria-live="polite"
          >
            <p className="mb-2 text-center text-xs font-semibold text-indigo-900 dark:text-indigo-100">
              Mengimpor {preview?.length ?? 0} baris ke server…
            </p>
            <div className="guru-import-progress-track">
              <div className="guru-import-progress-thumb" aria-hidden />
            </div>
            <p className="mt-1.5 text-center text-[11px] text-indigo-700/90 dark:text-indigo-300/90">
              Mohon tunggu, jangan tutup jendela ini.
            </p>
          </div>
        ) : null}

        <div className="flex shrink-0 flex-col gap-2 border-t border-slate-200 bg-white/95 px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] dark:border-slate-700 dark:bg-slate-900/95 sm:flex-row sm:justify-end sm:px-5 sm:py-4 sm:pb-4">
          <button type="button" className="ui-btn ui-btn-ghost w-full sm:w-auto" disabled={busy} onClick={props.onClose}>
            Tutup
          </button>
          <button
            type="button"
            disabled={busy || !preview?.length || Boolean(dupMsg)}
            onClick={() => void onConfirmImport()}
            className="ui-btn ui-btn-primary w-full sm:w-auto"
          >
            {busy ? "Mengimpor…" : "Impor ke sistem"}
          </button>
        </div>
      </div>
    </div>
  );
}
