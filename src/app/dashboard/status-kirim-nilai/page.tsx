import { getExamSubmitStatusBoardAction } from "@/server/actions/grades";

import { StatusKirimNilaiBoard } from "./StatusKirimNilaiBoard";
import { StatusKirimNilaiRefresh } from "./StatusKirimNilaiRefresh";

export default async function StatusKirimNilaiPage() {
  const res = await getExamSubmitStatusBoardAction();

  if (!res.ok) {
    return (
      <div className="min-w-0 w-full space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="max-w-2xl space-y-1">
            <h1 className="ui-page-title">Status Kirim Nilai</h1>
            <p className="ui-muted text-pretty">Ringkasan pengisian dan pengiriman nilai ujian per guru dan mapel.</p>
          </div>
          <StatusKirimNilaiRefresh />
        </div>
        <div className="ui-card ui-card-tight border-red-200 bg-red-50/80 text-red-800 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-200">
          {res.message}
        </div>
      </div>
    );
  }

  return (
    <div className="min-w-0 w-full space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="max-w-3xl space-y-1">
          <h1 className="ui-page-title">Status Kirim Nilai</h1>
          <p className="ui-muted text-pretty">
            Status berdasarkan penugasan guru ke mapel dan kelas. Nilai ujian yang hanya disimpan (belum melalui aksi
            kirim di halaman input ujian) tercatat sebagai proses pengisian. Setelah mapel dikunci, status selesai dan
            tanggal kirim ditampilkan sesuai zona waktu perangkat Anda.
          </p>
        </div>
        <StatusKirimNilaiRefresh />
      </div>

      <section className="ui-card ui-card-tight">
        <StatusKirimNilaiBoard rows={res.rows} />
      </section>
    </div>
  );
}
