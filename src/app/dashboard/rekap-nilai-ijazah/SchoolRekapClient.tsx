"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";

import type { RekapitulasiResult, RekapStudentRow } from "@/domain/rekapitulasi";
import { studentClassLabel, uniqueClassLabelsSorted } from "@/lib/class-name-sort";
import { RekapTable } from "@/components/rekap/RekapTables";
import { useToast } from "@/components/ToastProvider";
import { exportRekapExcel, exportRekapPdf } from "@/lib/rekap-export";
import { recomputeRekapitulasiAction } from "@/server/actions/rekap";

function filterRowsByClass(
  rows: RekapStudentRow[],
  activeClass: string,
  multiClass: boolean,
): RekapStudentRow[] {
  if (!multiClass || !activeClass) return rows;
  return rows.filter((r) => studentClassLabel(r.kelas) === activeClass);
}

function applyWeight(rows: RekapStudentRow[], weightPct: number): RekapStudentRow[] {
  const factor = weightPct / 100;
  return rows.map((r) => {
    const newScores: Record<string, number> = {};
    let jumlah = 0;
    for (const [code, val] of Object.entries(r.scoresByCode)) {
      const weighted = Math.round(val * factor * 100) / 100;
      newScores[code] = weighted;
      jumlah += weighted;
    }
    const count = Object.keys(newScores).length;
    const avg = count > 0 ? Math.round((jumlah / count) * 100) / 100 : 0;
    return {
      ...r,
      scoresByCode: newScores,
      jumlah: Math.round(jumlah * 100) / 100,
      rataRataDisplay: avg.toFixed(2).replace(".", ","),
      rataRataNumeric: avg,
      rataRataAmPdum: r.rataRataAmPdum !== undefined ? Math.round(avg) : undefined,
    };
  });
}

export function SchoolRekapClient(props: {
  mapel: { kode: string; nama: string }[];
  schoolName?: string;
  /** Wali kelas: rekap hanya siswa di kelas homeroom. */
  homeroomOnly?: boolean;
}) {
  const { toast } = useToast();
  const [rekap, setRekap] = useState<RekapitulasiResult | null>(null);
  const [bobotUjian, setBobotUjian] = useState(40);
  const [bobotRapor, setBobotRapor] = useState(60);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [showRaporBobot, setShowRaporBobot] = useState(false);
  const [showUjianBobot, setShowUjianBobot] = useState(false);
  const [ijazahBulat, setIjazahBulat] = useState(true);

  type ViewFilter = "semua" | "ijazah" | "rapor" | "ujian";
  const [view, setView] = useState<ViewFilter>("semua");
  const [selectedClass, setSelectedClass] = useState("");

  const hitung = useCallback(async () => {
    setBusy(true);
    setMsg(null);
    const r = await recomputeRekapitulasiAction();
    setBusy(false);
    if (!r.ok) setMsg(r.message);
    else {
      setRekap(r.result);
      setBobotUjian(r.bobotUjian);
      setBobotRapor(r.bobotRapor);
    }
  }, []);

  const classOptions = useMemo(() => {
    if (!rekap) return [];
    return uniqueClassLabelsSorted(
      rekap.rowsIjazah.map((r) => ({ classLabel: r.kelas })),
    );
  }, [rekap]);

  const multiClass = classOptions.length > 1;

  useEffect(() => {
    if (!multiClass) {
      setSelectedClass("");
      return;
    }
    setSelectedClass((prev) =>
      prev && classOptions.includes(prev) ? prev : classOptions[0]!,
    );
  }, [classOptions, multiClass]);

  const activeClass =
    multiClass && selectedClass && classOptions.includes(selectedClass)
      ? selectedClass
      : "";

  const rowsIjazah = useMemo(() => {
    if (!rekap) return [];
    return filterRowsByClass(rekap.rowsIjazah, activeClass, multiClass);
  }, [rekap, activeClass, multiClass]);

  const displayedRapor = useMemo(() => {
    if (!rekap) return [];
    const base = filterRowsByClass(rekap.rowsRapor, activeClass, multiClass);
    return showRaporBobot ? applyWeight(base, bobotRapor) : base;
  }, [rekap, activeClass, multiClass, showRaporBobot, bobotRapor]);

  const displayedUjian = useMemo(() => {
    if (!rekap) return [];
    const base = filterRowsByClass(rekap.rowsUjian, activeClass, multiClass);
    return showUjianBobot ? applyWeight(base, bobotUjian) : base;
  }, [rekap, activeClass, multiClass, showUjianBobot, bobotUjian]);

  const exportIjazahExcel = useCallback(async () => {
    if (!rekap) return;
    try {
      await exportRekapExcel({
        title: `Rekap Nilai Ijazah (${bobotUjian}% Ujian + ${bobotRapor}% Rapor)`,
        schoolName: props.schoolName,
        mapel: props.mapel,
        rows: rowsIjazah,
        decimals: ijazahBulat ? 0 : 2,
        showStatus: true,
        fileBase: "rekap-nilai-ijazah",
      });
      toast("File Excel berhasil diunduh.", "success");
    } catch (e) {
      toast((e as Error).message ?? "Gagal mengekspor Excel", "error");
    }
  }, [rekap, rowsIjazah, props.mapel, props.schoolName, bobotUjian, bobotRapor, ijazahBulat, toast]);

  const exportIjazahPdf = useCallback(async () => {
    if (!rekap) return;
    try {
      await exportRekapPdf({
        title: `Rekap Nilai Ijazah (${bobotUjian}% Ujian + ${bobotRapor}% Rapor)`,
        schoolName: props.schoolName,
        mapel: props.mapel,
        rows: rowsIjazah,
        decimals: ijazahBulat ? 0 : 2,
        showStatus: true,
        fileBase: "rekap-nilai-ijazah",
      });
      toast("File PDF berhasil diunduh.", "success");
    } catch (e) {
      toast((e as Error).message ?? "Gagal mengekspor PDF", "error");
    }
  }, [rekap, rowsIjazah, props.mapel, props.schoolName, bobotUjian, bobotRapor, ijazahBulat, toast]);

  const exportRaporExcel = useCallback(async () => {
    if (!rekap || displayedRapor.length === 0) return;
    try {
      await exportRekapExcel({
        title: `Rekap Nilai Rapor${showRaporBobot ? ` (bobot ${bobotRapor}%)` : ""}`,
        schoolName: props.schoolName,
        mapel: props.mapel,
        rows: displayedRapor,
        decimals: 2,
        fileBase: showRaporBobot ? "rekap-rapor-bobot" : "rekap-rapor-asli",
      });
      toast("File Excel berhasil diunduh.", "success");
    } catch (e) {
      toast((e as Error).message ?? "Gagal mengekspor Excel", "error");
    }
  }, [rekap, displayedRapor, props.mapel, props.schoolName, showRaporBobot, bobotRapor, toast]);

  const exportRaporPdf = useCallback(async () => {
    if (!rekap || displayedRapor.length === 0) return;
    try {
      await exportRekapPdf({
        title: `Rekap Nilai Rapor${showRaporBobot ? ` (bobot ${bobotRapor}%)` : ""}`,
        schoolName: props.schoolName,
        mapel: props.mapel,
        rows: displayedRapor,
        decimals: 2,
        fileBase: showRaporBobot ? "rekap-rapor-bobot" : "rekap-rapor-asli",
      });
      toast("File PDF berhasil diunduh.", "success");
    } catch (e) {
      toast((e as Error).message ?? "Gagal mengekspor PDF", "error");
    }
  }, [rekap, displayedRapor, props.mapel, props.schoolName, showRaporBobot, bobotRapor, toast]);

  const exportUjianExcel = useCallback(async () => {
    if (!rekap || displayedUjian.length === 0) return;
    try {
      await exportRekapExcel({
        title: `Rekap Nilai Ujian${showUjianBobot ? ` (bobot ${bobotUjian}%)` : ""}`,
        schoolName: props.schoolName,
        mapel: props.mapel,
        rows: displayedUjian,
        decimals: 2,
        showPdum: true,
        fileBase: showUjianBobot ? "rekap-ujian-bobot" : "rekap-ujian-asli",
      });
      toast("File Excel berhasil diunduh.", "success");
    } catch (e) {
      toast((e as Error).message ?? "Gagal mengekspor Excel", "error");
    }
  }, [rekap, displayedUjian, props.mapel, props.schoolName, showUjianBobot, bobotUjian, toast]);

  const exportUjianPdf = useCallback(async () => {
    if (!rekap || displayedUjian.length === 0) return;
    try {
      await exportRekapPdf({
        title: `Rekap Nilai Ujian${showUjianBobot ? ` (bobot ${bobotUjian}%)` : ""}`,
        schoolName: props.schoolName,
        mapel: props.mapel,
        rows: displayedUjian,
        decimals: 2,
        showPdum: true,
        fileBase: showUjianBobot ? "rekap-ujian-bobot" : "rekap-ujian-asli",
      });
      toast("File PDF berhasil diunduh.", "success");
    } catch (e) {
      toast((e as Error).message ?? "Gagal mengekspor PDF", "error");
    }
  }, [rekap, displayedUjian, props.mapel, props.schoolName, showUjianBobot, bobotUjian, toast]);

  return (
    <div className="space-y-8">
      <div className="max-w-3xl space-y-1">
        <h1 className="ui-page-title">Rekap nilai ijazah</h1>
        <p className="ui-muted text-pretty">
          Hitung ulang agar formula bobot ujian/rapor serta aspek terbaru langsung tercermin pada tabel.
        </p>
        <p className="mb-4 text-base font-bold text-red-600 dark:text-red-500">
          PENTING: Hapus mata pelajaran yang tidak diajarkan atau tidak diperlukan. Semua mata pelajaran dalam daftar ini akan masuk ke dalam perhitungan rekap nilai ijazah. Silakan hapus di halaman <Link href="/dashboard/mapel" className="underline hover:text-red-700 dark:hover:text-red-400">Mata pelajaran</Link>.
        </p>
        {props.homeroomOnly ? (
          <p className="text-sm text-amber-800 dark:text-amber-200/90">
            Tampilan ini hanya memuat siswa di kelas tempat Anda bertugas sebagai wali kelas.
          </p>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          disabled={busy}
          onClick={() => void hitung()}
          className="ui-btn ui-btn-success"
        >
          {busy ? "Menghitung…" : "Hitung / muat ulang rekap"}
        </button>
        {rekap ? (
          <span className="rounded-full bg-emerald-100 px-3 py-1 text-[12px] font-semibold text-emerald-900 dark:bg-emerald-500/15 dark:text-emerald-100">
            Data siap diekspor manual
          </span>
        ) : null}
      </div>

      {msg ? <p className="ui-alert ui-alert-error font-medium">{msg}</p> : null}

      {rekap ? (
        <div className="space-y-6">
          {/* Filter view */}
          <div className="flex flex-wrap items-center gap-1.5 rounded-xl border border-slate-200/80 bg-slate-50/80 p-1.5 dark:border-slate-700/60 dark:bg-slate-800/60">
            {([
              ["semua", "Ketiganya"],
              ["ijazah", "Nilai Ijazah"],
              ["rapor", "Nilai Rapor"],
              ["ujian", "Nilai Ujian"],
            ] as [ViewFilter, string][]).map(([val, label]) => (
              <button
                key={val}
                type="button"
                onClick={() => setView(val)}
                className={`rounded-lg px-3 py-1.5 text-[12px] font-semibold transition ${
                  view === val
                    ? "bg-indigo-600 text-white shadow-sm"
                    : "text-slate-600 hover:bg-white dark:text-slate-300 dark:hover:bg-slate-700"
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {multiClass ? (
            <label className="ui-label block max-w-xs">
              Kelas
              <select
                value={activeClass}
                onChange={(e) => setSelectedClass(e.target.value)}
                className="ui-select mt-1.5"
                disabled={busy}
                aria-label="Pilih kelas untuk ditampilkan"
              >
                {classOptions.map((label) => (
                  <option key={label} value={label}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
          ) : null}

          {(view === "semua" || view === "ijazah") && (
            <RekapTable
              title={`Rekap Nilai Ijazah (${bobotUjian}% Ujian + ${bobotRapor}% Rapor)`}
              mapel={props.mapel}
              rows={rowsIjazah}
              showStatus
              decimals={ijazahBulat ? 0 : 2}
              toggleLabel={ijazahBulat ? "Nilai Murni" : "Nilai Bulat"}
              onToggle={() => setIjazahBulat((p) => !p)}
              onExportExcel={exportIjazahExcel}
              onExportPdf={exportIjazahPdf}
            />
          )}

          {(view === "semua" || view === "rapor") && (
            <RekapTable
              title={`Rekap Nilai Rapor${showRaporBobot ? ` (×${bobotRapor}%)` : ""}`}
              mapel={props.mapel}
              rows={displayedRapor}
              decimals={2}
              badge={`Bobot: ${bobotRapor}%`}
              toggleLabel={showRaporBobot ? "Lihat Nilai Asli" : "Lihat Nilai Bobot"}
              onToggle={() => setShowRaporBobot((p) => !p)}
              onExportExcel={exportRaporExcel}
              onExportPdf={exportRaporPdf}
            />
          )}

          {(view === "semua" || view === "ujian") && (
            <RekapTable
              title={`Rekap Nilai Ujian${showUjianBobot ? ` (×${bobotUjian}%)` : ""}`}
              mapel={props.mapel}
              rows={displayedUjian}
              decimals={2}
              showPdum
              badge={`Bobot: ${bobotUjian}%`}
              toggleLabel={showUjianBobot ? "Lihat Nilai Asli" : "Lihat Nilai Bobot"}
              onToggle={() => setShowUjianBobot((p) => !p)}
              onExportExcel={exportUjianExcel}
              onExportPdf={exportUjianPdf}
            />
          )}
        </div>
      ) : (
        <div className="ui-card ui-card-tight max-w-xl">
          <p className="ui-muted text-pretty">
            Tekan tombol hijau untuk menghitung rekap. Proses ini membaca semua input nilai terkini.
          </p>
        </div>
      )}
    </div>
  );
}
