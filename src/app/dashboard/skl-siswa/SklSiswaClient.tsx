"use client";

import { Check, Download, Eye, ExternalLink, FileSpreadsheet, RefreshCw, Save, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";

import { useToast } from "@/components/ToastProvider";
import { isSklStudentSklFieldsReady } from "@/lib/skl/skl-document-data";

import {
  refreshSklFromDriveAction,
  saveSklIssuedAtAction,
  saveSklModelSourceAction,
  saveSklActiveAction,
  updateSklDriveFolderAction,
} from "@/server/actions/skl-siswa";

export type SklSiswaRow = {
  id: string;
  nisn: string;
  name: string;
  classLabel: string | null;
  sklLetterNumber: string | null;
  parentGuardianName: string | null;
  nis: string | null;
};

export type SklModelSource = "SYSTEM" | "GOOGLE_DRIVE";

export function SklSiswaClient(props: {
  initialSklActive: boolean;
  initialRows: SklSiswaRow[];
  initialSklModelSource: SklModelSource;
  previewStudentId: string | null;
  previewUsesDummy: boolean;
  initialFolderUrl: string;
  initialNisnWithSkl: string[];
  driveConfigured: boolean;
  initialDriveError: string | null;
  driveServiceEmail: string;
  printLetterheadUrl: string | null;
  cloudinaryReady: boolean;
  schoolName: string;
  initialSklIssuedAt: string;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [sklActive, setSklActive] = useState(props.initialSklActive);
  const [sklModelSource, setSklModelSource] = useState<SklModelSource>(props.initialSklModelSource);
  const [folderUrl, setFolderUrl] = useState(props.initialFolderUrl);
  const [nisnWithSkl, setNisnWithSkl] = useState<string[]>(props.initialNisnWithSkl);
  const [driveError, setDriveError] = useState<string | null>(props.initialDriveError);
  const [busyActive, setBusyActive] = useState(false);
  const [busyModel, setBusyModel] = useState(false);
  const [busySave, setBusySave] = useState(false);
  const [busyRefresh, setBusyRefresh] = useState(false);

  const [previewLoading, setPreviewLoading] = useState(false);
  const [sklExporting, setSklExporting] = useState(false);
  const [sklIssuedAt, setSklIssuedAt] = useState(props.initialSklIssuedAt);
  const [busySklDate, setBusySklDate] = useState(false);


  useEffect(() => {
    setSklActive(props.initialSklActive);
    setSklModelSource(props.initialSklModelSource);
    setFolderUrl(props.initialFolderUrl);
    setNisnWithSkl(props.initialNisnWithSkl);
    setDriveError(props.initialDriveError);
  }, [
    props.initialSklActive,
    props.initialSklModelSource,
    props.initialFolderUrl,
    props.initialNisnWithSkl,
    props.initialDriveError,
    props.initialSklIssuedAt,
  ]);

  useEffect(() => {
    setSklIssuedAt(props.initialSklIssuedAt);
  }, [props.initialSklIssuedAt]);

  const sklSet = useMemo(() => new Set(nisnWithSkl), [nisnWithSkl]);
  const useDrive = sklModelSource === "GOOGLE_DRIVE";

  const previewUrl = props.previewStudentId
    ? `/api/admin/skl-preview?studentId=${encodeURIComponent(props.previewStudentId)}`
    : "/api/admin/skl-preview";

  async function handleToggleActive(checked: boolean) {
    setBusyActive(true);
    // Optimistic UI update
    setSklActive(checked);
    try {
      const res = await saveSklActiveAction({ sklActive: checked });
      if (!res.ok) {
        setSklActive(!checked); // Revert on failure
        toast(res.message, "error");
        return;
      }
      toast(`SKL berhasil ${checked ? "diaktifkan" : "dinonaktifkan"}.`, "success");
      router.refresh();
    } catch {
      setSklActive(!checked);
      toast("Terjadi kesalahan saat menyimpan pengaturan SKL.", "error");
    } finally {
      setBusyActive(false);
    }
  }

  async function handleSaveModel() {
    setBusyModel(true);
    try {
      const res = await saveSklModelSourceAction({ sklModelSource });
      if (!res.ok) {
        toast(res.message, "error");
        return;
      }
      toast("Model SKL disimpan.", "success");
      router.refresh();
    } finally {
      setBusyModel(false);
    }
  }

  async function handleSave() {
    setBusySave(true);
    try {
      const res = await updateSklDriveFolderAction(folderUrl);
      if (!res.ok) {
        toast(res.message, "error");
        return;
      }
      toast("Folder SKL berhasil disimpan.", "success");
      router.refresh();
    } finally {
      setBusySave(false);
    }
  }

  async function handleRefresh() {
    setBusyRefresh(true);
    setDriveError(null);
    try {
      const res = await refreshSklFromDriveAction();
      if (!res.ok) {
        setDriveError(res.message);
        toast(res.message, "error");
        return;
      }
      setNisnWithSkl(res.nisnWithSkl);
      if (!res.folderId) {
        toast("Belum ada folder yang disimpan.", "warning");
      } else {
        toast("Daftar SKL berhasil diperbarui dari Google Drive.", "success");
      }
    } finally {
      setBusyRefresh(false);
    }
  }

  async function handleExportSklData() {
    setSklExporting(true);
    try {
      const res = await fetch("/api/students/export", { credentials: "include" });
      if (!res.ok) {
        toast("Gagal mengekspor data SKL.", "error");
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "export_data_siswa.xlsx";
      a.click();
      URL.revokeObjectURL(url);
      toast("Data SKL diekspor.", "success");
    } catch {
      toast("Gagal mengekspor data.", "error");
    } finally {
      setSklExporting(false);
    }
  }



  async function handleSaveSklDate() {
    setBusySklDate(true);
    try {
      const res = await saveSklIssuedAtAction({
        sklIssuedAt: sklIssuedAt.trim() || null,
      });
      if (!res.ok) {
        toast(res.message, "error");
        return;
      }
      toast("Tanggal SKL disimpan.", "success");
      router.refresh();
    } finally {
      setBusySklDate(false);
    }
  }

  async function handlePreviewSkl() {
    setPreviewLoading(true);
    try {
      const res = await fetch(previewUrl, { credentials: "include" });
      if (!res.ok) {
        let msg = "Gagal memuat pratinjau SKL.";
        try {
          const j = (await res.json()) as { error?: string };
          if (j.error) msg = j.error;
        } catch {
          /* ignore */
        }
        toast(msg, "error");
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      window.open(url, "_blank", "noopener,noreferrer");
      window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch {
      toast("Gagal memuat pratinjau SKL.", "error");
    } finally {
      setPreviewLoading(false);
    }
  }

  return (
    <div className="min-w-0 space-y-8">
      <div className="max-w-3xl space-y-1">
        <h1 className="ui-page-title">SKL Siswa</h1>
        <p className="ui-muted text-pretty">
          Kelola Surat Keterangan Lulus (SKL) untuk siswa. Pilih model dari sistem (PDF otomatis sesuai format
          ketentuan) atau unggah berkas sendiri di Google Drive per siswa.
        </p>
      </div>

      <section className="ui-card ui-card-tight max-w-3xl space-y-4">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="ui-section-title">Aktifkan SKL</h2>
            <p className="ui-muted mt-1 text-sm text-pretty">
              Jika dinonaktifkan, seluruh fitur SKL dan bagian di bawah ini akan disembunyikan. Siswa tidak akan dapat mengakses maupun mengunduh SKL walaupun sudah masuk waktu pengumuman.
            </p>
          </div>
          <label className="relative inline-flex cursor-pointer items-center shrink-0">
            <input
              type="checkbox"
              className="peer sr-only"
              checked={sklActive}
              disabled={busyActive}
              onChange={(e) => void handleToggleActive(e.target.checked)}
            />
            <div className="peer h-6 w-11 rounded-full bg-slate-200 after:absolute after:left-[2px] after:top-[2px] after:h-5 after:w-5 after:rounded-full after:border after:border-slate-300 after:bg-white after:transition-all after:content-[''] peer-checked:bg-indigo-600 peer-checked:after:translate-x-full peer-checked:after:border-white peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-indigo-300 dark:border-slate-600 dark:bg-slate-700 dark:peer-focus:ring-indigo-800"></div>
          </label>
        </div>
      </section>

      {sklActive && (
        <>
          <section className="ui-card ui-card-tight max-w-3xl space-y-4">
        <h2 className="ui-section-title">Model SKL</h2>
        <p className="ui-muted text-sm text-pretty">
          Menentukan sumber berkas yang diunduh siswa di menu Unduh SKL. Kop surat dari Pengaturan cetak nilai ikut
          dipakai pada model sistem jika sudah diunggah.
        </p>
        <fieldset className="space-y-3">
          <label className="flex cursor-pointer gap-3 rounded-lg border border-slate-200 bg-white/[0.04] p-3 dark:border-slate-700">
            <input
              type="radio"
              name="skl-model"
              className="mt-1 accent-indigo-600"
              checked={sklModelSource === "SYSTEM"}
              onChange={() => setSklModelSource("SYSTEM")}
            />
            <span>
              <span className="font-medium">Gunakan model dari sistem</span>
              <span className="ui-muted mt-0.5 block text-sm">
                SKL dibuat otomatis (PDF) dari data sekolah dan siswa — format Surat Keterangan Lulus sesuai standar
                satuan pendidikan.
              </span>
            </span>
          </label>
          <label className="flex cursor-pointer gap-3 rounded-lg border border-slate-200 bg-white/[0.04] p-3 dark:border-slate-700">
            <input
              type="radio"
              name="skl-model"
              className="mt-1 accent-indigo-600"
              checked={sklModelSource === "GOOGLE_DRIVE"}
              onChange={() => setSklModelSource("GOOGLE_DRIVE")}
            />
            <span>
              <span className="font-medium">Gunakan model sendiri dari Google Drive</span>
              <span className="ui-muted mt-0.5 block text-sm">
                Satu berkas PDF per siswa di folder Drive, nama file{" "}
                <code className="rounded bg-slate-100 px-1 py-0.5 text-xs dark:bg-slate-800">NISN.pdf</code> (contoh:{" "}
                <code className="rounded bg-slate-100 px-1 py-0.5 text-xs dark:bg-slate-800">1234567890.pdf</code>).
              </span>
            </span>
          </label>
        </fieldset>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className="ui-btn ui-btn-primary"
            disabled={busyModel}
            onClick={() => void handleSaveModel()}
          >
            <Save className="size-4" />
            {busyModel ? "Menyimpan…" : "Simpan model SKL"}
          </button>
          {sklModelSource === "SYSTEM" ? (
            <button
              type="button"
              disabled={previewLoading || props.initialRows.length === 0}
              className="ui-btn ui-btn-ghost inline-flex items-center gap-2"
              onClick={() => void handlePreviewSkl()}
            >
              <Eye className="size-4" />
              {previewLoading ? "Menyiapkan pratinjau…" : "Pratinjau SKL sistem"}
            </button>
          ) : null}
        </div>
        {sklModelSource === "SYSTEM" && !props.schoolName ? (
          <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-700/50 dark:bg-amber-950/40 dark:text-amber-200">
            Lengkapi <strong>nama sekolah</strong> di menu Sekolah agar SKL sistem dapat dibuat.
          </p>
        ) : null}
        {sklModelSource === "SYSTEM" && props.initialRows.length === 0 ? (
          <p className="ui-muted text-sm">Belum ada siswa untuk pratinjau.</p>
        ) : null}
        {sklModelSource === "SYSTEM" && props.previewUsesDummy ? (
          <p className="ui-muted text-sm">
            Data siswa pertama belum lengkap — pratinjau memakai nilai contoh untuk field yang kosong.
          </p>
        ) : null}

        {sklModelSource === "SYSTEM" ? (
          <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50/80 p-4 dark:border-slate-700 dark:bg-slate-900/30">
            <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100">Tanggal SKL</h3>
            <p className="ui-muted mt-1 text-sm">
              Dipakai pada pengetangganan TTD di SKL (mis. Kabupaten Bulukumba, 10 Juni 2024).
            </p>
            <div className="mt-3 flex flex-wrap items-end gap-3">
              <label className="space-y-1">
                <span className="text-[12px] font-semibold text-slate-600 dark:text-slate-400">
                  Tanggal
                </span>
                <input
                  type="date"
                  className="ui-input"
                  value={sklIssuedAt}
                  onChange={(e) => setSklIssuedAt(e.target.value)}
                />
              </label>
              <button
                type="button"
                className="ui-btn ui-btn-primary"
                disabled={busySklDate}
                onClick={() => void handleSaveSklDate()}
              >
                <Save className="size-4" />
                {busySklDate ? "Menyimpan…" : "Simpan tanggal SKL"}
              </button>
            </div>
          </div>
        ) : null}
      </section>

      <section
        className={`ui-card ui-card-tight max-w-3xl space-y-4 ${!useDrive ? "opacity-60" : ""}`}
        aria-disabled={!useDrive}
      >
        <h2 className="ui-section-title">Folder Google Drive</h2>
        {!useDrive ? (
          <p className="ui-muted text-sm">
            Bagian ini tidak dipakai saat model <strong>Sistem</strong> aktif. Beralih ke Google Drive jika ingin
            memakai berkas unggahan sendiri.
          </p>
        ) : (
          <p className="ui-muted text-sm text-pretty">
            Lacak keberadaan berkas SKL per siswa. Berkas wajib PDF dengan nama tepat{" "}
            <code className="rounded bg-slate-100 px-1 py-0.5 text-xs dark:bg-slate-800">NISN.pdf</code>{" "}
            (ganti <code className="rounded bg-slate-100 px-1 py-0.5 text-xs dark:bg-slate-800">NISN</code> dengan
            NISN siswa — contoh:{" "}
            <code className="rounded bg-slate-100 px-1 py-0.5 text-xs dark:bg-slate-800">1234567890.pdf</code>).
          </p>
        )}
        {useDrive && !props.driveConfigured ? (
          <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-700/50 dark:bg-amber-950/40 dark:text-amber-200">
            Integrasi Drive belum diaktifkan di server (variabel lingkungan{" "}
            <code className="text-xs">GOOGLE_DRIVE_SKL_CLIENT_EMAIL</code> dan{" "}
            <code className="text-xs">GOOGLE_DRIVE_SKL_PRIVATE_KEY</code>). Hubungi pengelola aplikasi.
          </p>
        ) : null}
        {useDrive && props.driveConfigured && props.driveServiceEmail ? (
          <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-800 dark:border-slate-700 dark:bg-slate-900/40 dark:text-slate-200">
            <p className="font-semibold">Bagikan folder ke service account</p>
            <p className="mt-1 text-slate-600 dark:text-slate-400">
              Di Google Drive, buka folder SKL → <strong>Bagikan</strong> → tambahkan email berikut sebagai{" "}
              <strong>Pembaca</strong>:
            </p>
            <p className="mt-2 break-all font-mono text-xs text-indigo-700 dark:text-indigo-300">
              {props.driveServiceEmail}
            </p>
          </div>
        ) : null}
        <label className="ui-label">
          Tautan atau ID folder Google Drive
          <input
            className="ui-input mt-1.5 w-full"
            value={folderUrl}
            onChange={(e) => setFolderUrl(e.target.value)}
            placeholder="https://drive.google.com/drive/folders/…"
            autoComplete="off"
            disabled={!useDrive}
          />
        </label>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className="ui-btn ui-btn-primary"
            disabled={busySave || !useDrive}
            onClick={() => void handleSave()}
          >
            <Save className="size-4" />
            {busySave ? "Menyimpan…" : "Simpan folder"}
          </button>
          <button
            type="button"
            className="ui-btn ui-btn-ghost"
            disabled={busyRefresh || !useDrive || !props.driveConfigured}
            onClick={() => void handleRefresh()}
          >
            <RefreshCw className="size-4" />
            {busyRefresh ? "Memuat…" : "Segarkan dari Drive"}
          </button>
        </div>
        {useDrive && driveError ? (
          <p className="whitespace-pre-line rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-800/50 dark:bg-red-950/40 dark:text-red-200">
            {driveError}
          </p>
        ) : null}
      </section>

      <section className="ui-card ui-card-tight max-w-3xl space-y-4">
        <h2 className="ui-section-title">Kop surat sekolah</h2>
        <p className="ui-muted text-sm text-pretty">
          Gambar kop dipakai pada SKL model sistem dan dokumen cetak nilai. Unggah atau ganti kop di menu Pengaturan
          cetak nilai.
        </p>
        <p className="text-sm text-slate-600 dark:text-slate-400">
          Akses unduh SKL siswa mengikuti pengaturan yang sama dengan tampilan rekap ijazah di{" "}
          <Link
            href="/dashboard/pengaturan-kelulusan"
            className="font-semibold text-indigo-600 underline-offset-2 hover:underline dark:text-indigo-400"
          >
            Pengaturan kelulusan
          </Link>
          .
        </p>
        {!props.cloudinaryReady ? (
          <div className="rounded-lg border border-amber-200 bg-amber-50/80 px-3 py-2 text-sm text-amber-950 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-100">
            Cloudinary belum dikonfigurasi di server — kop surat belum dapat diunggah. Atur variabel{" "}
            <code className="rounded bg-black/10 px-1 py-0.5 text-[12px] dark:bg-white/10">
              CLOUDINARY_*
            </code>{" "}
            lalu mulai ulang aplikasi.
          </div>
        ) : null}
        <div
          className={`flex min-h-[160px] flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed px-4 py-8 text-center ${
            props.cloudinaryReady
              ? "border-slate-300 bg-slate-50/50 dark:border-slate-600 dark:bg-slate-900/40"
              : "border-slate-200 opacity-70 dark:border-slate-700"
          }`}
        >
          {props.printLetterheadUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={props.printLetterheadUrl}
              alt="Kop surat sekolah"
              className="max-h-40 w-auto max-w-full rounded-lg border border-slate-200 object-contain shadow-sm dark:border-slate-600"
            />
          ) : (
            <p className="ui-muted text-sm">Belum ada gambar kop surat.</p>
          )}
        </div>
        <Link
          href="/dashboard/pengaturan-cetak-nilai"
          className="ui-btn ui-btn-primary inline-flex items-center gap-2"
        >
          <ExternalLink className="size-4" aria-hidden />
          Ubah kop surat
        </Link>
      </section>

      <section className="min-w-0 space-y-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="ui-section-title">Data siswa ({props.initialRows.length})</h2>
            <p className="ui-muted mt-1 text-sm">
              {useDrive
                ? "Centang hijau = berkas NISN.pdf ditemukan di Drive."
                : "Centang hijau = nomor surat, ayah/wali laki-laki, dan NIS lokal sudah terisi."}
            </p>
          </div>
          {!useDrive && props.initialRows.length > 0 ? (
            <div className="flex max-w-xs flex-col items-end gap-2 sm:max-w-sm">
              <button
                type="button"
                className="ui-btn ui-btn-ghost inline-flex shrink-0 items-center gap-2"
                disabled={sklExporting}
                onClick={() => void handleExportSklData()}
              >
                <Download className="size-4" />
                {sklExporting ? "Mengekspor…" : "Ekspor data SKL"}
              </button>
              <p className="ui-muted text-right text-xs leading-relaxed text-pretty">
                Ingin memperbarui data secara massal? Ekspor dengan tombol ini untuk mendapatkan referensi data, 
                lengkapi di Excel sesuai template, lalu unggah file tersebut melalui menu{" "}
                <Link href="/dashboard/import-master-siswa" className="font-medium text-indigo-600 hover:underline dark:text-indigo-400">
                  Import Master Siswa
                </Link>.
              </p>
            </div>
          ) : null}
        </div>
        <div className="ui-table-shell min-w-0 w-full overflow-x-auto">
          <table className="rekap-table w-full min-w-[56rem] text-sm">
            <thead>
              <tr>
                <th className="text-left">#</th>
                <th className="text-left">NISN</th>
                <th className="text-left">Nama</th>
                <th className="text-left">Kelas</th>
                {!useDrive ? (
                  <>
                    <th className="text-left">Nomor surat</th>
                    <th className="text-left">Ayah/wali laki-laki</th>
                    <th className="text-left">NIS lokal</th>
                  </>
                ) : null}
                <th className="text-center w-24">SKL</th>
              </tr>
            </thead>
            <tbody>
              {props.initialRows.length === 0 ? (
                <tr>
                  <td colSpan={useDrive ? 5 : 8} className="py-6 text-center text-slate-500">
                    Belum ada siswa aktif.
                  </td>
                </tr>
              ) : (
                props.initialRows.map((s, i) => {
                  const nisnKey = s.nisn.replace(/\D/g, "").slice(0, 10);
                  const sklFieldsReady = isSklStudentSklFieldsReady({
                    sklLetterNumber: s.sklLetterNumber,
                    parentGuardianName: s.parentGuardianName,
                    nis: s.nis,
                  });
                  const has = useDrive
                    ? sklSet.has(nisnKey) || sklSet.has(s.nisn)
                    : sklFieldsReady;
                  return (
                    <tr key={s.id}>
                      <td className="text-left">{i + 1}</td>
                      <td className="text-left font-mono tabular-nums">{s.nisn}</td>
                      <td className="text-left">{s.name}</td>
                      <td className="text-left">{s.classLabel ?? "—"}</td>
                      {!useDrive ? (
                        <>
                          <td
                            className="max-w-[12rem] truncate text-left text-xs"
                            title={s.sklLetterNumber ?? undefined}
                          >
                            {s.sklLetterNumber?.trim() || "—"}
                          </td>
                          <td className="text-left">{s.parentGuardianName?.trim() || "—"}</td>
                          <td className="text-left font-mono tabular-nums text-xs">
                            {s.nis?.trim() || "—"}
                          </td>
                        </>
                      ) : null}
                      <td className="text-center">
                        {has ? (
                          <span className="inline-flex items-center justify-center rounded-full bg-emerald-100 p-1 text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-300">
                            <Check className="size-4" aria-label="SKL siap" />
                          </span>
                        ) : (
                          <span
                            className="inline-flex items-center justify-center rounded-full bg-red-100 p-1 text-red-700 dark:bg-red-500/20 dark:text-red-300"
                            title={
                              useDrive
                                ? "Berkas SKL belum ada di Drive"
                                : "Lengkapi nomor surat, ayah/wali laki-laki, dan NIS lokal"
                            }
                          >
                            <X className="size-4" aria-hidden />
                            <span className="sr-only">SKL belum siap</span>
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>
        </>
      )}
    </div>
  );
}