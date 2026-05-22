import type { ExamNilaiPrintPreview } from "@/server/actions/exam-nilai-print";

export function ExamNilaiPreview(props: { data: ExamNilaiPrintPreview }) {
  const d = props.data;
  const pageCss = `@media print { @page { size: ${d.paperSize === "LEGAL" ? "legal" : "a4"} portrait; margin: 8mm; } }`;

  return (
    <div
      className={`cetak-nilai-preview mx-auto w-full min-w-0 bg-white px-6 py-8 text-slate-900 shadow-xl ring-1 ring-slate-200/80 print:px-4 print:py-6 print:shadow-none print:ring-0 dark:bg-white dark:text-slate-900 ${
        d.paperSize === "LEGAL" ? "max-w-[216mm]" : "max-w-[210mm]"
      } ${d.compact ? "text-[12px] leading-snug" : "text-[15px] leading-snug md:text-[15px]"}`}
      data-paper={d.paperSize === "LEGAL" ? "legal" : "a4"}
    >
      <style dangerouslySetInnerHTML={{ __html: pageCss }} />

      {d.letterheadUrl ? (
        <div className="mb-0 flex justify-center border-b border-slate-200 pb-3 print:max-h-[26mm] print:overflow-hidden">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={d.letterheadUrl}
            alt="Kop surat sekolah"
            className="max-h-28 w-auto max-w-full object-contain print:max-h-[22mm]"
          />
        </div>
      ) : (
        <p className="mb-0 rounded-lg border border-dashed border-amber-300 bg-amber-50/80 px-3 py-2 text-center text-xs text-amber-900 print:border-slate-300 print:bg-transparent print:text-slate-600">
          Belum ada kop surat — unggah di menu Pengaturan Cetak Nilai.
        </p>
      )}

      <h2 className="mt-8 text-center text-base font-bold uppercase tracking-wide text-slate-900 md:text-lg print:mt-6 print:text-[14px]">
        {d.examDocHeading}
      </h2>

      <div className="mt-4 space-y-2 border-b border-slate-200 pb-4 text-sm print:mt-3 print:space-y-1.5 print:pb-3 print:text-[11px]">
        <div className="grid min-w-0 grid-cols-[11rem_1.1rem_1fr] items-start gap-x-2 print:grid-cols-[10rem_1rem_1fr]">
          <span className="font-semibold text-slate-700">Mata Pelajaran</span>
          <span className="text-center font-medium leading-snug text-slate-900">:</span>
          <span className="min-w-0 font-medium leading-snug text-slate-900">
            {d.subjectName} <span className="text-slate-500">({d.subjectCode})</span>
          </span>
        </div>
        <div className="grid min-w-0 grid-cols-[11rem_1.1rem_1fr] items-start gap-x-2 print:grid-cols-[10rem_1rem_1fr]">
          <span className="font-semibold text-slate-700">Guru Pemeriksa</span>
          <span className="text-center font-medium leading-snug text-slate-900">:</span>
          <span className="min-w-0 font-medium leading-snug text-slate-900">{d.guruPemeriksaLine}</span>
        </div>
        <div className="grid min-w-0 grid-cols-[11rem_1.1rem_1fr] items-start gap-x-2 print:grid-cols-[10rem_1rem_1fr]">
          <span className="font-semibold text-slate-700">Ruang Ujian</span>
          <span className="text-center font-medium leading-snug text-slate-900">:</span>
          <span className="min-w-0 font-medium leading-snug text-slate-900">{d.ruangUjianLabel}</span>
        </div>
        <div className="grid min-w-0 grid-cols-[11rem_1.1rem_1fr] items-start gap-x-2 print:grid-cols-[10rem_1rem_1fr]">
          <span className="font-semibold text-slate-700">Kelas</span>
          <span className="text-center font-medium leading-snug text-slate-900">:</span>
          <span className="min-w-0 font-medium leading-snug text-slate-900">{d.kelasLabel}</span>
        </div>
      </div>

      <div className="mt-3 -mx-2 overflow-x-auto overflow-y-visible overscroll-x-contain px-2 touch-pan-x print:mx-0 print:mt-2 print:overflow-visible print:px-0 sm:mx-0 sm:px-0">
        <table
          className={`w-full min-w-[720px] table-fixed border-collapse border border-slate-500 print:min-w-0 ${d.compact ? "text-[11px] print:text-[10px]" : "text-[14px] print:text-[12px]"}`}
        >
          <colgroup>
            <col style={{ width: "5%" }} />
            <col style={{ width: "24%" }} />
            <col style={{ width: "14%" }} />
            <col style={{ width: "30%" }} />
            <col style={{ width: "8%" }} />
            <col style={{ width: "19%" }} />
          </colgroup>
          <thead>
            <tr className="bg-slate-100 text-center text-slate-900">
              <th className="border border-slate-500 px-1 py-2 font-semibold print:px-1 print:py-1.5">No</th>
              <th className="border border-slate-500 px-1 py-2 font-semibold print:px-1 print:py-1.5">Nomor Ujian</th>
              <th className="border border-slate-500 px-1 py-2 font-semibold print:px-1 print:py-1.5">NISN</th>
              <th className="border border-slate-500 px-1 py-2 font-semibold print:px-1 print:py-1.5">Nama Peserta Ujian</th>
              <th className="border border-slate-500 px-1 py-2 font-semibold print:px-1 print:py-1.5">Nilai</th>
              <th className="border border-slate-500 px-1 py-2 font-semibold print:px-1 print:py-1.5">Keterangan</th>
            </tr>
          </thead>
          <tbody>
            {d.rows.length === 0 ? (
              <tr>
                <td colSpan={6} className="border border-slate-500 px-3 py-6 text-center text-slate-600">
                  Tidak ada siswa pada ruang ini untuk mapel yang dipilih.
                </td>
              </tr>
            ) : (
              d.rows.map((r) => (
                <tr key={r.no} className="odd:bg-white even:bg-slate-50/90">
                  <td className="border border-slate-500 px-1 py-1.5 text-center tabular-nums text-slate-900 print:py-1">
                    {r.no}
                  </td>
                  <td className="border border-slate-500 px-1 py-1.5 font-mono whitespace-nowrap text-black print:py-1">
                    {r.nomorUjian}
                  </td>
                  <td className="border border-slate-500 px-1 py-1.5 font-mono whitespace-nowrap text-center text-black print:py-1">
                    {r.nisn}
                  </td>
                  <td className="border border-slate-500 px-1.5 py-1.5 text-slate-900 print:py-1">{r.nama}</td>
                  <td className="border border-slate-500 px-1 py-1.5 text-center tabular-nums text-slate-900 print:py-1">
                    {r.nilai}
                  </td>
                  <td className="border border-slate-500 px-1.5 py-1.5 text-slate-900 print:py-1">{r.keterangan}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="mt-8 space-y-3 text-sm print:mt-6 print:text-[11px]">
        <div className="-mx-2 overflow-x-auto overflow-y-visible overscroll-x-contain px-2 touch-pan-x print:mx-0 print:overflow-visible print:px-0 sm:mx-0 sm:px-0">
          <div className="flex min-w-[520px] flex-row items-start justify-between gap-8 print:min-w-0 print:justify-between print:gap-x-4">
            <div className="max-w-[46%] shrink-0 space-y-1 text-left">
              <p className="font-medium text-slate-800">Mengetahui,</p>
              <p className="font-semibold text-slate-900">{d.headLabel}</p>
              <div className="h-12 print:h-10" aria-hidden />
              <p className="font-semibold text-slate-900 underline decoration-slate-900 decoration-2 underline-offset-[5px] print:decoration-2">
                {d.namaKepala ?? "…………………………"}
              </p>
              {d.nipKepala ? (
                <p className="text-slate-700">NIP. {d.nipKepala}</p>
              ) : (
                <p className="text-slate-500">NIP. —</p>
              )}
            </div>
            <div className="max-w-[46%] shrink-0 space-y-1 text-right print:text-left">
              <p className="font-medium text-slate-800">{d.tanggalCetakLine}</p>
              <p className="font-semibold text-slate-900">Guru Pemeriksa</p>
              <div className="h-12 print:h-10" aria-hidden />
              <p className="font-semibold text-slate-900 underline decoration-slate-900 decoration-2 underline-offset-[5px] print:decoration-2">
                {d.primaryGuru.nama}
              </p>
              {d.primaryGuru.nip ? (
                <p className="text-slate-700">NIP. {d.primaryGuru.nip}</p>
              ) : (
                <p className="text-slate-500">NIP. —</p>
              )}
            </div>
          </div>
        </div>
        {d.otherGuruCount > 0 ? (
          <p className="text-xs italic text-slate-500 print:pt-0">
            Bersama {d.otherGuruCount} guru pemeriksa lainnya atas mapel ini.
          </p>
        ) : null}
      </div>
    </div>
  );
}
