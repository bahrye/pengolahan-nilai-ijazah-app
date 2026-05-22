"use client";

import { useCallback, useEffect, useState } from "react";

import type { RekapStudentRow } from "@/domain/rekapitulasi";

import { RekapTable } from "@/components/rekap/RekapTables";
import { studentRekapAction } from "@/server/actions/rekap";

export function StudentRekapClient(props: {
  mapel: { kode: string; nama?: string }[];
}) {
  const [row, setRow] = useState<RekapStudentRow | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [maskScores, setMaskScores] = useState(true);

  const loadRekap = useCallback(async () => {
    const r = await studentRekapAction();
    if (!r.ok) {
      setMsg(r.message);
      return;
    }
    setMsg(null);
    setRow(r.row);
    setMaskScores(r.maskScores);
  }, []);

  useEffect(() => {
    void loadRekap();
  }, [loadRekap]);

  useEffect(() => {
    const id = setInterval(() => void loadRekap(), 300000); // 5 menit
    const onVis = () => {
      if (document.visibilityState === "visible") void loadRekap();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [loadRekap]);
  const rowIjazah = row ? [row] : [];

  return (
    <div className="space-y-8">
      <div className="max-w-2xl space-y-1">
        <h1 className="ui-page-title">Rekap nilai Anda</h1>
        <p className="ui-muted text-pretty">
          Menampilkan komposisi nilai ijazah berdasarkan akun yang sedang masuk.{" "}
          {maskScores
            ? "Nilai angka dan status sementara ditampilkan sebagai **** sesuai jadwal pengumuman dan pengaturan sekolah."
            : "Nilai dan status ditampilkan lengkap sesuai perhitungan ijazah."}
        </p>
      </div>

      {msg ? <p className="ui-alert ui-alert-error font-medium">{msg}</p> : null}

      {!msg && rowIjazah.length ? (
        <RekapTable
          title="Rekap Nilai Ijazah"
          mapel={props.mapel}
          rows={rowIjazah}
          showStatus
          maskScores={maskScores}
        />
      ) : null}

      {!msg && !rowIjazah.length ? (
        <div className="ui-card ui-card-tight max-w-lg">
          <p className="ui-muted">Memuat data atau belum ada entri penilaian.</p>
        </div>
      ) : null}
    </div>
  );
}
