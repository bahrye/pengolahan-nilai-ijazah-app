"use client";

import { useEffect, useRef, useState } from "react";

import type { RekapitulasiResult } from "@/domain/rekapitulasi";
import { FileSpreadsheet, FileText } from "lucide-react";

function SubjectTooltipRekap({ kode, nama }: { kode: string; nama?: string }) {
  const [show, setShow] = useState(false);
  const ref = useRef<HTMLTableCellElement>(null);

  useEffect(() => {
    if (!show) return undefined;
    function handleOutside(e: MouseEvent | TouchEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setShow(false);
    }
    document.addEventListener("pointerdown", handleOutside);
    return () => document.removeEventListener("pointerdown", handleOutside);
  }, [show]);

  if (!nama)
    return <th className="rekap-mapel-header text-center">{kode}</th>;

  return (
    <th
      ref={ref}
      className="rekap-mapel-header relative cursor-pointer text-center"
      onMouseEnter={() => setShow(true)}
      onMouseLeave={() => setShow(false)}
      onClick={() => setShow((p) => !p)}
    >
      <span className="border-b border-dashed border-current">{kode}</span>
      {show && (
        <span className="absolute left-1/2 top-full z-30 mt-1 -translate-x-1/2 whitespace-nowrap rounded-lg bg-slate-800 px-3 py-1.5 text-[11px] font-medium normal-case tracking-normal text-white shadow-lg dark:bg-slate-200 dark:text-slate-900">
          {nama}
          <span className="absolute -top-1 left-1/2 -translate-x-1/2 border-4 border-transparent border-b-slate-800 dark:border-b-slate-200" />
        </span>
      )}
    </th>
  );
}

export function RekapTable({
  title,
  mapel,
  rows,
  showStatus,
  showPdum,
  badge,
  toggleLabel,
  onToggle,
  decimals = 2,
  onExportExcel,
  onExportPdf,
  /** Sementara: sembunyikan angka nilai (mis. untuk akun siswa). */
  maskScores = false,
}: {
  title: string;
  mapel: { kode: string; nama?: string }[];
  rows: RekapitulasiResult["rowsIjazah"];
  showStatus?: boolean;
  showPdum?: boolean;
  badge?: string;
  toggleLabel?: string;
  onToggle?: () => void;
  decimals?: number;
  onExportExcel?: () => void | Promise<void>;
  onExportPdf?: () => void | Promise<void>;
  maskScores?: boolean;
}) {
  const masked = "****";

  return (
    <div className="mb-10">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <h3 className="ui-section-title text-[17px]">{title}</h3>
        {badge ? (
          <span className="rounded-full bg-indigo-100 px-2.5 py-1 text-[11px] font-bold text-indigo-800 dark:bg-indigo-500/20 dark:text-indigo-200">
            {badge}
          </span>
        ) : null}
        {toggleLabel && onToggle && !maskScores ? (
          <button
            type="button"
            onClick={onToggle}
            className="rounded-full border border-indigo-300 bg-indigo-50 px-3 py-1 text-[11px] font-semibold text-indigo-700 transition hover:bg-indigo-100 dark:border-indigo-500/40 dark:bg-indigo-950/60 dark:text-indigo-200 dark:hover:bg-indigo-900/60"
          >
            {toggleLabel}
          </button>
        ) : null}
        {(onExportExcel || onExportPdf) && rows.length > 0 ? (
          <span className="inline-flex items-center gap-0.5 rounded-full border border-slate-200/90 bg-white/90 p-0.5 shadow-sm dark:border-slate-600 dark:bg-slate-800/90">
            {onExportExcel ? (
              <button
                type="button"
                title="Unduh Excel"
                aria-label="Ekspor ke Excel"
                onClick={() => void onExportExcel()}
                className="rounded-full p-1.5 text-emerald-700 transition hover:bg-emerald-50 dark:text-emerald-400 dark:hover:bg-emerald-950/50"
              >
                <FileSpreadsheet className="h-4 w-4" strokeWidth={2} />
              </button>
            ) : null}
            {onExportPdf ? (
              <button
                type="button"
                title="Unduh PDF (A4 lanskap)"
                aria-label="Ekspor ke PDF"
                onClick={() => void onExportPdf()}
                className="rounded-full p-1.5 text-red-700 transition hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/40"
              >
                <FileText className="h-4 w-4" strokeWidth={2} />
              </button>
            ) : null}
          </span>
        ) : null}
        <span className="ml-auto rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-slate-600 dark:bg-white/10 dark:text-slate-300">
          {rows.length} baris
        </span>
      </div>
      <p className="ui-muted mb-2 text-[12px]">
        {maskScores
          ? "Nilai angka dan status sementara disembunyikan (ditampilkan sebagai ****)."
          : "Arahkan kursor / tap kode mapel untuk melihat nama lengkap."}
      </p>
      <div className="ui-table-shell scroll-table-wrap">
        <table className="rekap-table text-sm">
          <thead>
            <tr>
              <th className="nisn-col text-left">NISN</th>
              <th className="text-left">Nama</th>
              <th className="text-center">Kelas</th>
              {mapel.map((m) => (
                <SubjectTooltipRekap key={m.kode} kode={m.kode} nama={m.nama} />
              ))}
              <th className="rekap-total-header text-center">Jumlah</th>
              <th className="rekap-total-header text-center">Rata²</th>
              {showStatus ? <th className="text-center">Status</th> : null}
              {showPdum ? <th className="text-center">PDUM</th> : null}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.nisn}>
                <td className="nisn-col font-mono text-[13px]">{r.nisn}</td>
                <td className="nama-siswa-cell">{r.nama}</td>
                <td className="text-center">{r.kelas}</td>
                {mapel.map((m) => {
                  const val = r.scoresByCode[m.kode] ?? 0;
                  return (
                    <td
                      key={m.kode}
                      className="text-center tabular-nums tracking-widest text-slate-800 dark:text-slate-200"
                    >
                      {maskScores
                        ? masked
                        : decimals === 0
                          ? Math.round(val)
                          : val.toFixed(decimals).replace(".", ",")}
                    </td>
                  );
                })}
                <td className="rekap-total-cell text-center tabular-nums tracking-widest text-slate-500 dark:text-slate-400">
                  {maskScores
                    ? masked
                    : decimals === 0
                      ? Math.round(r.jumlah)
                      : Number(r.jumlah).toFixed(decimals).replace(".", ",")}
                </td>
                <td className="rekap-total-cell text-center tabular-nums tracking-widest text-slate-500 dark:text-slate-400">
                  {maskScores ? masked : decimals === 0 ? Math.round(r.rataRataNumeric) : r.rataRataDisplay}
                </td>
                {showStatus ? (
                  <td className="text-center tracking-widest text-slate-500 dark:text-slate-400">
                    {maskScores ? masked : r.status}
                  </td>
                ) : null}
                {showPdum ? (
                  <td className="text-center tabular-nums tracking-widest text-slate-500 dark:text-slate-400">
                    {maskScores ? masked : r.rataRataAmPdum ?? ""}
                  </td>
                ) : null}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
