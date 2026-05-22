"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";

import { useToast } from "@/components/ToastProvider";
import {
  bulkCreateSubjectsAction,
  deleteSubjectAction,
  editSubjectAction,
  updateSubjectOrderAction,
  type SubjectRow,
} from "@/server/actions/subjects";

import {
  defaultJenisUjianForJenjang,
  defaultJenisUjianLabel,
} from "@/lib/subject-jenis-ujian";
import {
  formatJenisUjianLabel,
  jenisUjianOptions,
  normalizeJenisUjianForSchool,
} from "@/lib/school-terminology";

import type { SchoolLevel } from "@prisma/client";

import { SystemMapelImportModal } from "./SystemMapelImportModal";

const KELOMPOK_OPTIONS = ["A", "B", "C", "Muatan Lokal", "Agama", "Umum"];
const SHEET_PASSWORD = "syamsulbahri";

type ParsedMapelRow = {
  kode: string;
  nama: string;
  kelompok?: string;
  jenisUjian?: string;
  error?: string;
};

export function MapelBulk({
  initial,
  schoolJenjang,
}: {
  initial: SubjectRow[];
  schoolJenjang: SchoolLevel | null;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [list, setList] = useState(initial);
  const [bulkText, setBulkText] = useState("");
  const [editTarget, setEditTarget] = useState<SubjectRow | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<SubjectRow | null>(null);
  const [busy, setBusy] = useState(false);

  // excel import
  const fileRef = useRef<HTMLInputElement>(null);
  const [importPreview, setImportPreview] = useState<ParsedMapelRow[] | null>(null);
  const [importing, setImporting] = useState(false);
  const [systemImportOpen, setSystemImportOpen] = useState(false);

  const jenisOptions = jenisUjianOptions(schoolJenjang);
  const defaultJenisLabel = defaultJenisUjianLabel(schoolJenjang);
  const defaultJenisValue = defaultJenisUjianForJenjang(schoolJenjang);

  // drag state
  const dragIdx = useRef<number | null>(null);
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null);

  /* ────────── Import bulk ────────── */

  async function onImport() {
    const lines = bulkText
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean);
    if (lines.length === 0) {
      toast("Tidak ada data untuk diimpor.", "error");
      return;
    }
    const items = lines.map((line) => {
      const parts = line.split(/[\t,;]+/).map((s) => s.trim());
      return {
        kode: parts[0] || "",
        nama: parts[1] || "",
        kelompok: parts[2] || undefined,
        jenisUjian: parts[3] || undefined,
      };
    });
    setBusy(true);
    const res = await bulkCreateSubjectsAction(items);
    setBusy(false);
    if (!res.ok) toast(res.message, "error");
    else {
      setList(res.list);
      toast(`${items.length} mapel berhasil diimpor.`, "success");
      setBulkText("");
      router.refresh();
    }
  }

  /* ────────── Excel template download ────────── */

  async function downloadTemplate() {
    const ExcelJS = (await import("exceljs")).default;
    const wb = new ExcelJS.Workbook();
    wb.creator = "Sistem Nilai Ijazah";

    const ws = wb.addWorksheet("Input Mapel");
    const hFill = { type: "pattern" as const, pattern: "solid" as const, fgColor: { argb: "FF4F46E5" } };
    const hFont = { bold: true, color: { argb: "FFFFFFFF" }, size: 11 };
    const hBorder = {
      top: { style: "thin" as const }, left: { style: "thin" as const },
      bottom: { style: "thin" as const }, right: { style: "thin" as const },
    };

    ws.columns = [
      { header: "Kode", key: "kode", width: 14 },
      { header: "Nama Lengkap", key: "nama", width: 35 },
      { header: "Kelompok", key: "kelompok", width: 18 },
      { header: "Jenis Ujian", key: "jenisUjian", width: 20 },
    ];
    const headerRow = ws.getRow(1);
    headerRow.eachCell((cell) => {
      cell.fill = hFill; cell.font = hFont;
      cell.border = hBorder; cell.alignment = { vertical: "middle", horizontal: "center" };
    });
    headerRow.height = 28;

    const refKelompok = "Ref_Kelompok";
    const refJenis = "Ref_Jenis";

    for (let row = 2; row <= 201; row++) {
      ws.getCell(`C${row}`).dataValidation = {
        type: "list", allowBlank: true,
        formulae: [`'${refKelompok}'!$A$2:$A$${KELOMPOK_OPTIONS.length + 1}`],
        showErrorMessage: true, errorTitle: "Kelompok tidak valid",
        error: "Pilih kelompok dari daftar atau kosongkan.",
      };
      ws.getCell(`D${row}`).dataValidation = {
        type: "list", allowBlank: true,
        formulae: [`'${refJenis}'!$A$2:$A$${jenisOptions.length + 1}`],
        showErrorMessage: true, errorTitle: "Jenis tidak valid",
        error: "Pilih jenis ujian dari daftar.",
      };
    }

    const exRow = ws.getRow(2);
    exRow.getCell(1).value = "MTK";
    exRow.getCell(2).value = "Matematika";
    exRow.getCell(3).value = "A";
    exRow.getCell(4).value = defaultJenisValue;
    exRow.eachCell((cell) => { cell.font = { italic: true, color: { argb: "FF9CA3AF" } }; });

    const buildRefSheet = (name: string, title: string, options: string[]) => {
      const ref = wb.addWorksheet(name);
      ref.getColumn(1).width = 25;
      ref.getCell("A1").value = title;
      ref.getCell("A1").fill = hFill;
      ref.getCell("A1").font = hFont;
      ref.getCell("A1").border = hBorder;
      ref.getCell("A1").alignment = { vertical: "middle", horizontal: "center" };
      ref.getRow(1).height = 28;
      options.forEach((o, i) => { ref.getCell(`A${i + 2}`).value = o; });
      void ref.protect(SHEET_PASSWORD, {
        selectLockedCells: true, selectUnlockedCells: true,
        formatCells: false, formatColumns: false, formatRows: false,
        insertColumns: false, insertRows: false, insertHyperlinks: false,
        deleteColumns: false, deleteRows: false, sort: false, autoFilter: false, pivotTables: false,
      });
    };

    buildRefSheet(refKelompok, "Kelompok Mapel", KELOMPOK_OPTIONS);
    buildRefSheet(refJenis, "Jenis Ujian", [...jenisOptions]);

    const buf = await wb.xlsx.writeBuffer();
    const blob = new Blob([buf as ArrayBuffer], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "template_import_mapel.xlsx";
    a.click();
    URL.revokeObjectURL(url);
  }

  /* ────────── Excel import ────────── */

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const ExcelJS = (await import("exceljs")).default;
      const wb = new ExcelJS.Workbook();
      const buf = await file.arrayBuffer();
      await wb.xlsx.load(buf);

      const ws = wb.getWorksheet("Input Mapel") ?? wb.getWorksheet(1);
      if (!ws) throw new Error("Sheet 'Input Mapel' tidak ditemukan.");

      const rows: ParsedMapelRow[] = [];
      const existingCodes = new Set(list.map((m) => m.kode.toLowerCase()));

      ws.eachRow((row, rowNum) => {
        if (rowNum === 1) return;
        const kode = String(row.getCell(1).value ?? "").trim();
        const nama = String(row.getCell(2).value ?? "").trim();
        const kelompok = String(row.getCell(3).value ?? "").trim() || undefined;
        const jenisUjian = String(row.getCell(4).value ?? "").trim() || undefined;

        if (!kode && !nama) return;

        let error: string | undefined;
        if (!kode) error = "Kode kosong.";
        else if (!nama) error = "Nama kosong.";
        else if (existingCodes.has(kode.toLowerCase())) error = `Kode "${kode}" sudah ada.`;

        rows.push({ kode, nama, kelompok, jenisUjian, error });
      });

      if (rows.length === 0) throw new Error("Tidak ada data mapel di file.");
      setImportPreview(rows);
    } catch (err) {
      toast((err as Error).message, "error");
    }
    if (fileRef.current) fileRef.current.value = "";
  }

  async function confirmImportExcel() {
    if (!importPreview) return;
    const validRows = importPreview.filter((r) => !r.error);
    if (validRows.length === 0) {
      toast("Tidak ada baris yang valid.", "error");
      return;
    }
    setImporting(true);
    const res = await bulkCreateSubjectsAction(
      validRows.map((r) => ({
        kode: r.kode,
        nama: r.nama,
        kelompok: r.kelompok,
        jenisUjian: r.jenisUjian,
      })),
    );
    setImporting(false);
    if (!res.ok) {
      toast(res.message, "error");
    } else {
      setList(res.list);
      setImportPreview(null);
      toast(`${validRows.length} mapel berhasil diimpor dari Excel.`, "success");
      router.refresh();
    }
  }

  /* ────────── Edit ────────── */

  async function handleEdit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!editTarget) return;
    const fd = new FormData(e.currentTarget);
    setBusy(true);
    const res = await editSubjectAction({
      id: editTarget.id,
      kode: String(fd.get("kode")),
      nama: String(fd.get("nama")),
      kelompok: String(fd.get("kelompok")) || undefined,
      jenisUjian: String(fd.get("jenisUjian")),
    });
    setBusy(false);
    if (!res.ok) {
      toast(res.message, "error");
    } else {
      setList(res.list);
      setEditTarget(null);
      toast("Mapel berhasil diperbarui.", "success");
      router.refresh();
    }
  }

  /* ────────── Delete ────────── */

  async function handleDelete() {
    if (!deleteTarget) return;
    setBusy(true);
    const res = await deleteSubjectAction({ subjectId: deleteTarget.id });
    setBusy(false);
    if (!res.ok) {
      toast(res.message, "error");
    } else {
      setList(res.list);
      setDeleteTarget(null);
      toast("Mapel berhasil dihapus.", "success");
      router.refresh();
    }
  }

  /* ────────── Reorder: save to server ────────── */

  async function saveOrder(newList: SubjectRow[]) {
    const items = newList.map((m, i) => ({ id: m.id, orderNo: i + 1 }));
    setBusy(true);
    const res = await updateSubjectOrderAction(items);
    setBusy(false);
    if (!res.ok) {
      toast(res.message, "error");
    } else {
      setList(res.list);
      router.refresh();
    }
  }

  /* ────────── Reorder: move up / down ────────── */

  function moveItem(fromIdx: number, toIdx: number) {
    if (toIdx < 0 || toIdx >= list.length) return;
    const next = [...list];
    const [moved] = next.splice(fromIdx, 1);
    next.splice(toIdx, 0, moved);
    const renumbered = next.map((m, i) => ({ ...m, orderNo: i + 1, row: i + 1 }));
    setList(renumbered);
    void saveOrder(renumbered);
  }

  /* ────────── Drag & drop handlers ────────── */

  function onDragStart(idx: number) {
    dragIdx.current = idx;
  }

  function onDragOver(e: React.DragEvent, idx: number) {
    e.preventDefault();
    setDragOverIdx(idx);
  }

  function onDragLeave() {
    setDragOverIdx(null);
  }

  function onDrop(e: React.DragEvent, toIdx: number) {
    e.preventDefault();
    setDragOverIdx(null);
    const fromIdx = dragIdx.current;
    dragIdx.current = null;
    if (fromIdx === null || fromIdx === toIdx) return;
    moveItem(fromIdx, toIdx);
  }

  function onDragEnd() {
    dragIdx.current = null;
    setDragOverIdx(null);
  }

  /* ────────── render ────────── */

  return (
    <div className="min-w-0 w-full space-y-8 overflow-x-hidden">
      <div className="max-w-3xl space-y-1">
        <h1 className="ui-page-title">Mata pelajaran</h1>
        <p className="ui-muted text-pretty">
          Impor massal mempercepat setup awal. Gunakan katalog sistem sesuai
          jenjang sekolah, atau impor manual lewat teks/Excel.
        </p>
      </div>

      {/* ─── Impor mapel ─── */}
      <section className="ui-card space-y-4">
        <h2 className="ui-section-title">Impor mapel</h2>
        <div className="ui-muted max-w-3xl space-y-2 text-sm">
          <p>
            Format satu baris:{" "}
            <code className="ui-kbd">kode;nama;kelompok;jenis</code>
          </p>
          <ul className="list-disc space-y-1 pl-5">
            <li>
              <strong>Kode</strong> — kode singkat mapel, contoh:{" "}
              <code className="ui-kbd">MTK</code>,{" "}
              <code className="ui-kbd">IPA</code>,{" "}
              <code className="ui-kbd">B.IND</code>.
            </li>
            <li>
              <strong>Nama</strong> — nama lengkap mapel, contoh:{" "}
              <code className="ui-kbd">Matematika</code>,{" "}
              <code className="ui-kbd">Ilmu Pengetahuan Alam</code>.
            </li>
            <li>
              <strong>Kelompok</strong> (opsional) — pengelompokan mapel,
              contoh:{" "}
              <code className="ui-kbd">A</code>,{" "}
              <code className="ui-kbd">B</code>,{" "}
              <code className="ui-kbd">Muatan Lokal</code>,{" "}
              <code className="ui-kbd">Agama</code>. Kosongkan jika tidak perlu.
            </li>
            <li>
              <strong>Jenis</strong> (opsional) — jenis ujian:{" "}
              <code className="ui-kbd">{jenisOptions[0]}</code>,{" "}
              <code className="ui-kbd">Ujian Praktek</code>, atau{" "}
              <code className="ui-kbd">Keduanya</code>.{" "}
              <em>
                Jika dikosongkan, otomatis &quot;{defaultJenisLabel}&quot;.
              </em>
            </li>
          </ul>
        </div>
        <textarea
          value={bulkText}
          onChange={(e) => setBulkText(e.target.value)}
          rows={7}
          className="ui-textarea min-h-[10rem] max-w-3xl text-[13px]"
          placeholder={`MTK;Matematika;A\nIPA;Ilmu Pengetahuan Alam;A\nB.IND;Bahasa Indonesia;A\nSBK;Seni Budaya;B;Ujian Praktek\nMLOK;Bahasa Daerah;Muatan Lokal`}
        />
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => void onImport()}
            disabled={busy}
            className="ui-btn ui-btn-success"
          >
            {busy ? "Mengimpor..." : "Impor mapel (teks)"}
          </button>
          <button
            type="button"
            onClick={() => setSystemImportOpen(true)}
            disabled={busy}
            className="ui-btn ui-btn-primary"
          >
            Impor mapel (sistem)
          </button>
        </div>
        <div className="flex flex-wrap gap-2 border-t border-slate-200 pt-4 dark:border-slate-700">
          <p className="w-full text-sm font-semibold text-slate-700 dark:text-slate-300">
            Atau impor dari file Excel:
          </p>
          <button
            type="button"
            onClick={() => void downloadTemplate()}
            disabled={busy}
            className="ui-btn ui-btn-ghost"
          >
            📄 Download Template
          </button>
          <label className="ui-btn ui-btn-ghost cursor-pointer">
            📥 Upload Excel
            <input
              ref={fileRef}
              type="file"
              accept=".xlsx,.xls"
              className="hidden"
              onChange={(e) => void handleFileChange(e)}
            />
          </label>
        </div>
      </section>

      {/* ─── Modal: Preview import Excel ─── */}
      {importPreview && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/50 p-4">
          <div className="ui-card w-full max-w-3xl">
            <h3 className="ui-section-title mb-3">Preview Import Mapel</h3>
            <p className="ui-muted mb-3 text-sm">
              {importPreview.filter((r) => !r.error).length} valid,{" "}
              {importPreview.filter((r) => r.error).length} bermasalah dari{" "}
              {importPreview.length} baris.
            </p>
            <div className="mb-4 max-h-[50vh] overflow-auto">
              <table className="rekap-table w-full text-sm">
                <thead>
                  <tr>
                    <th className="px-3 py-2 text-left">#</th>
                    <th className="px-3 py-2 text-left">Kode</th>
                    <th className="px-3 py-2 text-left">Nama</th>
                    <th className="px-3 py-2 text-left">Kelompok</th>
                    <th className="px-3 py-2 text-left">Jenis</th>
                    <th className="px-3 py-2 text-left">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {importPreview.map((r, i) => (
                    <tr key={i} className={r.error ? "bg-red-50 dark:bg-red-950/30" : ""}>
                      <td className="px-3 py-1.5">{i + 1}</td>
                      <td className="px-3 py-1.5">{r.kode || <span className="text-red-500">—</span>}</td>
                      <td className="px-3 py-1.5">{r.nama || <span className="text-red-500">—</span>}</td>
                      <td className="px-3 py-1.5">{r.kelompok || "—"}</td>
                      <td className="px-3 py-1.5">
                        {formatJenisUjianLabel(
                          r.jenisUjian || defaultJenisValue,
                          schoolJenjang,
                        )}
                      </td>
                      <td className="px-3 py-1.5 text-xs">
                        {r.error ? (
                          <span className="font-medium text-red-600 dark:text-red-400">{r.error}</span>
                        ) : (
                          <span className="text-emerald-600 dark:text-emerald-400">OK</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setImportPreview(null)}
                disabled={importing}
                className="ui-btn ui-btn-ghost"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={() => void confirmImportExcel()}
                disabled={importing || importPreview.filter((r) => !r.error).length === 0}
                className="ui-btn ui-btn-success"
              >
                {importing ? "Mengimpor..." : `Impor ${importPreview.filter((r) => !r.error).length} mapel`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Daftar mapel ─── */}
      <section className="min-w-0 w-full overflow-hidden">
        <h2 className="ui-section-title mb-1">
          Daftar mapel ({list.length})
        </h2>
        <p className="ui-muted mb-3 text-xs">
          Seret baris atau gunakan tombol panah untuk mengatur urutan mapel. Kolom{" "}
          <strong>Smt</strong> diisi otomatis dari nilai rapor: dihitung semester yang punya
          minimal satu nilai pengetahuan atau keterampilan (seluruh siswa); semester tanpa
          nilai sama sekali tidak masuk perhitungan rata rapor ijazah.
        </p>
        <p className="ui-muted mb-2 text-xs md:hidden">
          Geser tabel ke kanan/kiri untuk melihat semua kolom.
        </p>
        <p className="mb-4 text-base font-bold text-red-600 dark:text-red-500">
          PENTING: Hapus mata pelajaran yang tidak diajarkan atau tidak diperlukan. Semua mata pelajaran dalam daftar ini akan masuk ke dalam perhitungan rekap nilai ijazah.
        </p>
        <div className="ui-table-shell min-w-0 w-full">
          <div className="w-full overflow-x-auto overscroll-x-contain">
            <table className="rekap-table w-full min-w-[56rem] text-sm">
              <thead>
                <tr>
                  <th className="w-24 text-left">Urutan</th>
                  <th className="text-left">Kode</th>
                  <th className="text-left">Nama</th>
                  <th className="text-left">Kelompok</th>
                  <th className="text-left">Jenis Ujian</th>
                  <th
                    className="text-center"
                    title="Jumlah semester rapor yang punya nilai (otomatis dari input rapor)"
                  >
                    Smt
                  </th>
                  <th className="text-left">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {list.map((m, idx) => (
                  <tr
                    key={m.id}
                    draggable
                    onDragStart={() => onDragStart(idx)}
                    onDragOver={(e) => onDragOver(e, idx)}
                    onDragLeave={onDragLeave}
                    onDrop={(e) => onDrop(e, idx)}
                    onDragEnd={onDragEnd}
                    className={`cursor-grab active:cursor-grabbing ${
                      dragOverIdx === idx
                        ? "border-t-2 !border-t-indigo-500"
                        : ""
                    }`}
                  >
                    <td className="text-left">
                      <div className="flex items-center gap-1">
                        <span className="mr-1 cursor-grab text-slate-400" title="Seret untuk mengatur urutan">
                          ⠿
                        </span>
                        <span className="font-mono text-xs">{idx + 1}</span>
                        <button
                          type="button"
                          onClick={() => moveItem(idx, idx - 1)}
                          disabled={idx === 0 || busy}
                          className="rounded px-1 text-sm text-slate-500 hover:bg-slate-200 hover:text-slate-800 disabled:opacity-30 dark:hover:bg-slate-700 dark:hover:text-slate-200"
                          title="Naik"
                        >
                          ▲
                        </button>
                        <button
                          type="button"
                          onClick={() => moveItem(idx, idx + 1)}
                          disabled={idx === list.length - 1 || busy}
                          className="rounded px-1 text-sm text-slate-500 hover:bg-slate-200 hover:text-slate-800 disabled:opacity-30 dark:hover:bg-slate-700 dark:hover:text-slate-200"
                          title="Turun"
                        >
                          ▼
                        </button>
                      </div>
                    </td>
                    <td className="text-left">{m.kode}</td>
                    <td className="text-left">{m.nama}</td>
                    <td className="text-left">
                      {m.kelompok || (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>
                    <td className="text-left">
                      {formatJenisUjianLabel(m.jenisUjian, schoolJenjang)}
                    </td>
                    <td className="text-center tabular-nums font-semibold">
                      {m.semesterCount}
                    </td>
                    <td className="text-left">
                      <div className="flex gap-1">
                        <button
                          type="button"
                          onClick={() => setEditTarget(m)}
                          disabled={busy}
                          className="ui-btn ui-btn-ghost px-2 py-1 text-xs"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeleteTarget(m)}
                          disabled={busy}
                          className="ui-btn ui-btn-ghost px-2 py-1 text-xs text-red-600 dark:text-red-400"
                        >
                          Hapus
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* ═══ Modal: Edit mapel ═══ */}
      {editTarget ? (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/50 p-4">
          <div className="ui-card w-full max-w-lg">
            <h3 className="ui-section-title mb-4">Edit mapel</h3>
            <form onSubmit={handleEdit} className="space-y-3">
              <label className="ui-label">
                Kode
                <input
                  name="kode"
                  defaultValue={editTarget.kode}
                  required
                  className="ui-input mt-1"
                />
              </label>
              <label className="ui-label">
                Nama
                <input
                  name="nama"
                  defaultValue={editTarget.nama}
                  required
                  className="ui-input mt-1"
                />
              </label>
              <label className="ui-label">
                Kelompok
                <input
                  name="kelompok"
                  defaultValue={editTarget.kelompok ?? ""}
                  placeholder="Opsional, contoh: A, B, Muatan Lokal"
                  className="ui-input mt-1"
                />
              </label>
              <label className="ui-label">
                Jenis Ujian
                <select
                  name="jenisUjian"
                  defaultValue={normalizeJenisUjianForSchool(
                    editTarget.jenisUjian,
                    schoolJenjang,
                  )}
                  className="ui-select mt-1"
                >
                  {jenisOptions.map((j) => (
                    <option key={j} value={j}>
                      {formatJenisUjianLabel(j, schoolJenjang)}
                    </option>
                  ))}
                </select>
              </label>
              <p className="rounded-xl border border-slate-200/90 bg-slate-50/80 px-3 py-2.5 text-[12px] leading-relaxed text-slate-600 dark:border-slate-600 dark:bg-slate-900/40 dark:text-slate-300">
                Jumlah semester aktif (kolom Smt): <strong>{editTarget.semesterCount}</strong>{" "}
                — disinkronkan otomatis dari input nilai rapor, tidak dapat diubah manual di
                sini.
              </p>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  className="ui-btn ui-btn-ghost"
                  onClick={() => setEditTarget(null)}
                  disabled={busy}
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="ui-btn ui-btn-primary"
                  disabled={busy}
                >
                  {busy ? "Menyimpan..." : "Simpan"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {/* ═══ Modal: Konfirmasi hapus ═══ */}
      {deleteTarget ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
          <div className="ui-card w-full max-w-sm text-center">
            <h3 className="ui-section-title mb-2">Hapus mapel?</h3>
            <p className="ui-muted mb-4 text-sm">
              Mapel <strong>{deleteTarget.nama}</strong> ({deleteTarget.kode})
              beserta seluruh nilai terkait akan dihapus permanen.
            </p>
            <div className="flex justify-center gap-3">
              <button
                type="button"
                className="ui-btn ui-btn-ghost"
                onClick={() => setDeleteTarget(null)}
                disabled={busy}
              >
                Batal
              </button>
              <button
                type="button"
                className="ui-btn bg-red-600 text-white hover:bg-red-700"
                onClick={handleDelete}
                disabled={busy}
              >
                {busy ? "Menghapus..." : "Ya, hapus"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <SystemMapelImportModal
        open={systemImportOpen}
        schoolJenjang={schoolJenjang}
        onClose={() => setSystemImportOpen(false)}
        onImported={(next) => {
          setList(next);
          router.refresh();
        }}
      />
    </div>
  );
}
