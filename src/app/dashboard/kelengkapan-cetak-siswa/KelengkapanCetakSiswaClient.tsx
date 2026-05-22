"use client";

import { AnimatePresence, motion } from "framer-motion";
import { AlertTriangle, Download, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

import { useToast } from "@/components/ToastProvider";
import {
  clearStudentPrintCompletenessAction,
} from "@/server/actions/student-print-completeness";

import type { PrintCompletenessRow } from "./types";


export function KelengkapanCetakSiswaClient(props: { initialRows: PrintCompletenessRow[] }) {
  const router = useRouter();
  const { toast } = useToast();
  const [busyExport, setBusyExport] = useState(false);
  const [busyClear, setBusyClear] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);

  const sorted = useMemo(
    () =>
      [...props.initialRows].sort(
        (a, b) =>
          (a.classLabel || "").localeCompare(b.classLabel || "", "id") || a.name.localeCompare(b.name, "id"),
      ),
    [props.initialRows],
  );


  const exportDataExcel = useCallback(async () => {
    if (sorted.length === 0) {
      toast("Tidak ada data siswa untuk diekspor.", "error");
      return;
    }
    setBusyExport(true);
    try {
      const res = await fetch("/api/students/export", { credentials: "include" });
      if (!res.ok) {
        toast("Gagal mengekspor data.", "error");
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "export_data_siswa.xlsx";
      a.click();
      URL.revokeObjectURL(url);
      toast("Data berhasil diekspor ke Excel.", "success");
    } catch (e) {
      toast((e as Error).message ?? "Gagal mengekspor Excel.", "error");
    } finally {
      setBusyExport(false);
    }
  }, [sorted, toast]);

  useEffect(() => {
    if (!showClearConfirm) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !busyClear) setShowClearConfirm(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [showClearConfirm, busyClear]);

  const executeClearData = useCallback(async () => {
    setBusyClear(true);
    try {
      const res = await clearStudentPrintCompletenessAction();
      if (!res.ok) {
        toast(res.message, "error");
        return;
      }
      toast(`Data kelengkapan dikosongkan (${res.cleared} baris siswa diperbarui).`, "success");
      setShowClearConfirm(false);
      router.refresh();
    } finally {
      setBusyClear(false);
    }
  }, [router, toast]);

  return (
    <div className="space-y-8">
      <div className="max-w-3xl space-y-1">
        <h1 className="ui-page-title">Kelengkapan cetak siswa</h1>
        <p className="ui-muted text-pretty">
          Isi <strong>Nomor Peserta Ujian</strong> dan <strong>Nama Ruang Ujian</strong> untuk setiap siswa. Jika terdapat kesalahan atau kekurangan data, Anda dapat menekan tombol <strong>Eksport data</strong>, memperbaruinya di Excel, lalu mengunggahnya kembali di menu <Link href="/dashboard/import-master-siswa" className="font-semibold text-indigo-600 hover:underline dark:text-indigo-400">Import Master Siswa</Link>.
        </p>
      </div>


      <section className="min-w-0 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-base font-semibold tracking-tight">Data siswa</h2>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              disabled={busyExport || sorted.length === 0}
              onClick={() => void exportDataExcel()}
              className="ui-btn ui-btn-ghost"
            >
              {busyExport ? "Mengekspor…" : "Eksport data"}
            </button>
            <button
              type="button"
              disabled={busyClear}
              onClick={() => setShowClearConfirm(true)}
              className="ui-btn border border-red-300 bg-red-50 text-red-900 hover:bg-red-100 dark:border-red-900/60 dark:bg-red-950/50 dark:text-red-100 dark:hover:bg-red-950/80"
            >
              Bersihkan data
            </button>
          </div>
        </div>
        <div className="overflow-x-auto rounded-xl border border-slate-200/80 dark:border-slate-700/60">
          <table className="w-full min-w-[640px] border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/90 dark:border-slate-700 dark:bg-slate-800/80">
                <th className="px-3 py-2.5 font-semibold">Nama</th>
                <th className="px-3 py-2.5 font-semibold">NISN</th>
                <th className="px-3 py-2.5 font-semibold">Kelas</th>
                <th className="px-3 py-2.5 font-semibold">Nomor Peserta Ujian</th>
                <th className="px-3 py-2.5 font-semibold">Nama Ruang Ujian</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((s) => (
                <tr
                  key={s.id}
                  className="border-b border-slate-100 odd:bg-white even:bg-slate-50/50 dark:border-slate-800 dark:odd:bg-slate-950/40 dark:even:bg-slate-900/30"
                >
                  <td className="px-3 py-2">{s.name}</td>
                  <td className="px-3 py-2 font-mono text-[13px]">{s.nisn}</td>
                  <td className="px-3 py-2">{s.classLabel ?? "—"}</td>
                  <td className="px-3 py-2">{s.nomorUjian?.trim() ? s.nomorUjian : "—"}</td>
                  <td className="px-3 py-2">{s.ruangUjian?.trim() ? s.ruangUjian : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {sorted.length === 0 ? (
          <p className="ui-muted text-sm">Belum ada siswa aktif. Tambahkan siswa di menu Data Siswa.</p>
        ) : null}
      </section>

      <AnimatePresence>
        {showClearConfirm ? (
          <motion.div
            key="clear-modal-root"
            className="fixed inset-0 z-[100] flex items-center justify-center p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            <button
              type="button"
              aria-label="Tutup"
              disabled={busyClear}
              className="absolute inset-0 bg-slate-950/65 backdrop-blur-[3px]"
              onClick={() => {
                if (!busyClear) setShowClearConfirm(false);
              }}
            />
            <motion.div
              role="dialog"
              aria-modal="true"
              aria-labelledby="clear-modal-title"
              initial={{ opacity: 0, scale: 0.94, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.94, y: 12 }}
              transition={{ type: "spring", stiffness: 420, damping: 32 }}
              className="relative z-10 w-full max-w-md overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-2xl shadow-slate-900/15 dark:border-slate-700/80 dark:bg-slate-900 dark:shadow-black/40"
            >
              <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-amber-400 via-red-500 to-rose-600" />
              <div className="space-y-4 p-6 pt-7">
                <div className="flex gap-4">
                  <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-red-500 to-rose-600 shadow-lg shadow-red-500/25">
                    <Trash2 className="size-7 text-white" aria-hidden />
                  </div>
                  <div className="min-w-0 flex-1 space-y-1">
                    <h3 id="clear-modal-title" className="text-lg font-bold tracking-tight text-slate-900 dark:text-slate-50">
                      Kosongkan data kelengkapan?
                    </h3>
                    <p className="text-sm leading-relaxed text-slate-600 dark:text-slate-400">
                      Nomor peserta ujian dan nama ruang ujian akan dihapus dari database untuk{" "}
                      <strong>semua siswa</strong> di sekolah ini. Tindakan ini tidak dapat dibatalkan.
                    </p>
                  </div>
                </div>

                <div className="flex gap-3 rounded-xl border border-amber-200/90 bg-gradient-to-br from-amber-50 to-orange-50/80 p-4 dark:border-amber-900/40 dark:from-amber-950/50 dark:to-orange-950/30">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-400/90 text-amber-950 dark:bg-amber-500/30 dark:text-amber-100">
                    <Download className="size-5" aria-hidden />
                  </div>
                  <div className="min-w-0 space-y-1">
                    <p className="text-sm font-semibold text-amber-950 dark:text-amber-100">Ekspor dulu (disarankan)</p>
                    <p className="text-sm leading-relaxed text-amber-900/90 dark:text-amber-200/90">
                      Gunakan tombol <strong>Eksport data</strong> terlebih dahulu agar Anda memiliki salinan Excel
                      sebelum data dikosongkan dari sistem.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-2 rounded-lg border border-red-200/80 bg-red-50/90 px-3 py-2.5 text-sm text-red-900 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-100">
                  <AlertTriangle className="mt-0.5 size-4 shrink-0 opacity-90" aria-hidden />
                  <span>Pastikan Anda sudah menyimpan berkas cadangan jika data masih dibutuhkan.</span>
                </div>

                <div className="flex flex-col-reverse gap-2 pt-1 sm:flex-row sm:justify-end sm:gap-3">
                  <button
                    type="button"
                    disabled={busyClear}
                    onClick={() => setShowClearConfirm(false)}
                    className="ui-btn ui-btn-ghost w-full sm:w-auto"
                  >
                    Batal
                  </button>
                  <button
                    type="button"
                    disabled={busyClear || busyExport || sorted.length === 0}
                    title={sorted.length === 0 ? "Tidak ada data siswa untuk diekspor" : undefined}
                    onClick={() => void exportDataExcel()}
                    className="ui-btn w-full border border-slate-300 bg-white text-slate-800 hover:bg-slate-50 disabled:opacity-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700/50 sm:w-auto"
                  >
                    {busyExport ? "Mengekspor…" : (
                      <>
                        <Download className="mr-2 inline size-4 -translate-y-px" aria-hidden />
                        Eksport dulu
                      </>
                    )}
                  </button>
                  <button
                    type="button"
                    disabled={busyClear}
                    onClick={() => void executeClearData()}
                    className="ui-btn w-full bg-gradient-to-r from-red-600 to-rose-600 px-5 text-white shadow-md shadow-red-600/25 hover:from-red-700 hover:to-rose-700 sm:w-auto"
                  >
                    {busyClear ? "Memproses…" : "Ya, kosongkan data"}
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
