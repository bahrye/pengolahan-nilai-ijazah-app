"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, Circle, Loader2 } from "lucide-react";

import type { ExamSubmitStatusRow } from "@/server/actions/grades";

/** Tanggal (id-ID), koma, jam 24 jam + AM/PM — zona waktu perangkat (setelah mount, hidrasi aman). */
function LockTimeCell({ iso }: { iso: string | null }) {
  const [label, setLabel] = useState(() => (iso ? "…" : "—"));

  useEffect(() => {
    if (!iso) {
      setLabel("—");
      return;
    }
    try {
      const d = new Date(iso);
      const dateStr = d.toLocaleDateString("id-ID", {
        day: "2-digit",
        month: "long",
        year: "numeric",
      });
      const h24 = d.getHours();
      const mm = String(d.getMinutes()).padStart(2, "0");
      const hh = String(h24).padStart(2, "0");
      const suffix = h24 < 12 ? "AM" : "PM";
      setLabel(`${dateStr}, ${hh}:${mm} ${suffix}`);
    } catch {
      setLabel("—");
    }
  }, [iso]);

  return (
    <span className="tabular-nums text-slate-700 dark:text-slate-200" title={iso ?? undefined}>
      {label}
    </span>
  );
}

function StatusIcon({ status }: { status: ExamSubmitStatusRow["status"] }) {
  if (status === "done") {
    return (
      <span className="inline-flex items-center justify-center" title="Selesai — nilai ujian mapel sudah dikirim">
        <CheckCircle2 className="size-5 text-emerald-600 dark:text-emerald-400" aria-hidden />
      </span>
    );
  }
  if (status === "progress") {
    return (
      <span
        className="inline-flex items-center justify-center"
        title="Proses pengisian — ada nilai tersimpan, mapel belum dikirim"
      >
        <Loader2
          className="size-5 animate-spin text-amber-500 dark:text-amber-400"
          aria-hidden
        />
      </span>
    );
  }
  return (
    <span className="inline-flex items-center justify-center" title="Belum mengisi — belum ada nilai ujian tersimpan">
      <Circle className="size-5 text-slate-400 dark:text-slate-500" aria-hidden />
    </span>
  );
}

function ProgressBar({ row }: { row: ExamSubmitStatusRow }) {
  const pct = row.progressPercent;
  const barClass =
    row.status === "done"
      ? "bg-emerald-500 dark:bg-emerald-400"
      : row.status === "progress"
        ? "bg-amber-500 dark:bg-amber-400"
        : "bg-slate-300 dark:bg-slate-600";

  return (
    <div className="flex min-w-[8rem] flex-col gap-1">
      <div className="h-2 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
        <div className={`h-full rounded-full transition-[width] duration-300 ${barClass}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-[11px] font-semibold tabular-nums text-slate-600 dark:text-slate-400">
        {row.totalCells <= 0 ? "—" : `${pct}% (${row.filledCells}/${row.totalCells})`}
      </span>
    </div>
  );
}

export function StatusKirimNilaiBoard({ rows }: { rows: ExamSubmitStatusRow[] }) {
  if (rows.length === 0) {
    return (
      <p className="ui-muted rounded-xl border border-dashed border-slate-200 px-4 py-8 text-center text-sm dark:border-slate-700">
        Belum ada penugasan guru ke mapel dan kelas. Atur penugasan di menu Data Guru.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-x-6 gap-y-2 rounded-xl border border-slate-200/90 bg-white/60 px-4 py-3 text-xs font-medium text-slate-600 dark:border-slate-700/80 dark:bg-slate-900/40 dark:text-slate-300">
        <span className="inline-flex items-center gap-2">
          <Circle className="size-4 text-slate-400" aria-hidden />
          Belum mengisi
        </span>
        <span className="inline-flex items-center gap-2">
          <Loader2 className="size-4 animate-spin text-amber-500" aria-hidden />
          Proses pengisian
        </span>
        <span className="inline-flex items-center gap-2">
          <CheckCircle2 className="size-4 text-emerald-600" aria-hidden />
          Selesai kirim
        </span>
      </div>

      <div className="overflow-x-auto rounded-xl border border-slate-200/90 bg-white/80 shadow-sm dark:border-slate-700/80 dark:bg-slate-900/50">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead className="border-b border-slate-200 bg-slate-50/90 text-[11px] font-bold uppercase tracking-wide text-slate-600 dark:border-slate-700 dark:bg-slate-800/80 dark:text-slate-300">
            <tr>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Guru</th>
              <th className="px-4 py-3">Mapel</th>
              <th className="px-4 py-3">Kelas</th>
              <th className="px-4 py-3">Progres pengisian</th>
              <th className="px-4 py-3">Tanggal kirim</th>
              <th className="px-4 py-3">Pengirim</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {rows.map((row) => (
              <tr key={row.assignmentId} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40">
                <td className="px-4 py-3 align-middle">
                  <StatusIcon status={row.status} />
                </td>
                <td className="px-4 py-3 font-semibold text-slate-900 dark:text-slate-100">{row.teacherName}</td>
                <td className="px-4 py-3">
                  <span className="font-mono text-xs font-semibold text-indigo-700 dark:text-indigo-300">
                    {row.subjectCode}
                  </span>
                  <span className="ui-muted block text-xs">{row.subjectName}</span>
                </td>
                <td className="px-4 py-3">{row.className}</td>
                <td className="px-4 py-3 align-middle">
                  <ProgressBar row={row} />
                </td>
                <td className="px-4 py-3">
                  <LockTimeCell iso={row.lockedAt} />
                </td>
                <td className="px-4 py-3 text-slate-700 dark:text-slate-200">
                  {row.submitterLabel ?? "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
