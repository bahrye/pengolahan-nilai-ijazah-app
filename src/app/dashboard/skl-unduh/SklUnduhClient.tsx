"use client";

import { Download, FileSearch, Loader2 } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { useToast } from "@/components/ToastProvider";
import { checkSklAvailabilityForStudentAction } from "@/server/actions/skl-unduh-siswa";

type Phase = "idle" | "checking" | "locked" | "available" | "unavailable";

export function SklUnduhClient(props: {
  name: string;
  nisn: string;
  classLabel: string;
  schoolName: string;
}) {
  const { progressToast } = useToast();
  const [phase, setPhase] = useState<Phase>("idle");
  const [error, setError] = useState<string | null>(null);
  const [lockedMessage, setLockedMessage] = useState("");
  const [busyDownload, setBusyDownload] = useState(false);

  async function handleCheck() {
    setError(null);
    setPhase("checking");
    try {
      const res = await checkSklAvailabilityForStudentAction();
      if (!res.ok) {
        setError(res.message);
        setPhase("idle");
        return;
      }
      if (res.kind === "locked") {
        setLockedMessage(res.message);
        setPhase("locked");
        return;
      }
      setPhase(res.available ? "available" : "unavailable");
    } catch {
      setError("Terjadi kesalahan saat memeriksa ketersediaan SKL. Silakan coba lagi.");
      setPhase("idle");
    }
  }

  function handleReset() {
    setError(null);
    setLockedMessage("");
    setPhase("idle");
  }

  async function handleDownload() {
    if (busyDownload) return;
    setBusyDownload(true);
    const pt = progressToast({ total: 1, title: "Mengunduh SKL…" });
    try {
      pt.update(0, "Menghubungi server…");
      const res = await fetch("/api/siswa/skl-download", { credentials: "include" });
      if (!res.ok) {
        let msg = "Gagal mengunduh SKL.";
        try {
          const j = (await res.json()) as { error?: string };
          if (typeof j.error === "string" && j.error.trim()) msg = j.error.trim();
        } catch {
          if (res.status === 401) msg = "Sesi habis. Silakan masuk kembali.";
          else if (res.status === 403) msg = "Unduhan SKL belum diizinkan. Periksa pengumuman atau jadwal sekolah.";
        }
        pt.error(msg);
        return;
      }

      pt.update(1, "Memproses berkas PDF…");
      const blob = await res.blob();
      const cd = res.headers.get("content-disposition");
      let filename = `${props.nisn.replace(/\D/g, "").slice(0, 10)}.pdf`;
      const quoted = /filename="([^"]+)"/i.exec(cd ?? "");
      if (quoted?.[1]) filename = quoted[1].trim();
      else {
        const plain = /filename=([^;\s]+)/i.exec(cd ?? "");
        if (plain?.[1]) filename = plain[1].replace(/"/g, "").trim();
      }

      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      a.rel = "noopener";
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);

      pt.success("SKL berhasil diunduh. Periksa folder unduhan perangkat Anda.");
    } catch {
      pt.error("Terjadi kesalahan jaringan. Periksa koneksi lalu coba lagi.");
    } finally {
      setBusyDownload(false);
    }
  }

  return (
    <section className="ui-card ui-card-tight space-y-4">
      <h2 className="ui-section-title text-base">Data Anda</h2>
      <dl className="grid gap-3 text-sm sm:grid-cols-[7rem_1fr] sm:gap-x-4 sm:gap-y-2">
        <dt className="font-semibold text-slate-600 dark:text-slate-400">Nama</dt>
        <dd className="text-slate-900 dark:text-slate-100">{props.name}</dd>
        <dt className="font-semibold text-slate-600 dark:text-slate-400">NISN</dt>
        <dd className="font-mono tabular-nums text-slate-900 dark:text-slate-100">{props.nisn}</dd>
        <dt className="font-semibold text-slate-600 dark:text-slate-400">Kelas</dt>
        <dd className="text-slate-900 dark:text-slate-100">{props.classLabel}</dd>
        <dt className="font-semibold text-slate-600 dark:text-slate-400">Sekolah</dt>
        <dd className="text-pretty text-slate-900 dark:text-slate-100">{props.schoolName}</dd>
      </dl>

      <div className="border-t border-slate-200 pt-4 dark:border-slate-700">
        {phase === "idle" && (
          <div className="space-y-3">
            <p className="text-sm text-slate-600 dark:text-slate-400">
              Tekan tombol di bawah untuk memeriksa apakah SKL Anda sudah tersedia. Pemeriksaan membutuhkan waktu
              beberapa detik.
            </p>
            {error ? (
              <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-800/50 dark:bg-red-950/40 dark:text-red-200">
                {error}
              </p>
            ) : null}
            <button
              type="button"
              className="ui-btn ui-btn-primary inline-flex items-center gap-2"
              onClick={() => void handleCheck()}
            >
              <FileSearch className="size-4 shrink-0" />
              Cek ketersediaan SKL
            </button>
          </div>
        )}

        {phase === "checking" && (
          <div className="flex items-center gap-3 text-sm text-slate-600 dark:text-slate-400">
            <Loader2 className="size-5 shrink-0 animate-spin text-indigo-600 dark:text-indigo-400" aria-hidden />
            <span>Memeriksa ketersediaan SKL…</span>
          </div>
        )}

        {phase === "locked" && (
          <div className="space-y-4">
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-4 text-sm leading-relaxed text-amber-950 dark:border-amber-700/50 dark:bg-amber-950/30 dark:text-amber-100">
              <p className="font-semibold">Unduhan SKL belum dibuka</p>
              <p className="mt-2 text-pretty">{lockedMessage}</p>
            </div>
            <button type="button" className="ui-btn ui-btn-ghost" onClick={handleReset}>
              Cek lagi
            </button>
          </div>
        )}

        {phase === "available" && (
          <div className="space-y-3">
            <p className="text-sm text-slate-600 dark:text-slate-400">
              SKL Anda sudah tersedia. Tekan tombol di bawah untuk mengunduh berkas PDF.
            </p>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className="ui-btn ui-btn-primary inline-flex items-center gap-2"
                disabled={busyDownload}
                onClick={() => void handleDownload()}
              >
                {busyDownload ? (
                  <Loader2 className="size-4 shrink-0 animate-spin" aria-hidden />
                ) : (
                  <Download className="size-4 shrink-0" aria-hidden />
                )}
                {busyDownload ? "Mengunduh…" : "Unduh SKL (PDF)"}
              </button>
              <button type="button" className="ui-btn ui-btn-ghost" onClick={handleReset} disabled={busyDownload}>
                Cek lagi
              </button>
            </div>
          </div>
        )}

        {phase === "unavailable" && (
          <div className="space-y-4">
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm leading-relaxed text-slate-700 dark:border-slate-700 dark:bg-slate-900/40 dark:text-slate-300">
              <p className="font-semibold text-slate-800 dark:text-slate-200">SKL belum tersedia saat ini</p>
              <p className="mt-2">
                SKL Anda belum tersedia. Silakan periksa lagi setelah pengumuman resmi dari sekolah atau pastikan data
                Anda lengkap jika sekolah memakai model SKL sistem.
              </p>
              <p className="mt-2">
                Jika menurut Anda SKL seharusnya sudah ada, silakan hubungi bagian administrasi atau wali kelas di
                sekolah Anda untuk memastikan berkas sudah diunggah dengan benar.
              </p>
              <p className="mt-3">
                <Link href="/dashboard/pengumuman" className="font-medium text-indigo-600 underline dark:text-indigo-400">
                  Kembali ke Pengumuman
                </Link>
              </p>
            </div>
            <button type="button" className="ui-btn ui-btn-ghost" onClick={handleReset}>
              Cek lagi
            </button>
          </div>
        )}
      </div>
    </section>
  );
}
