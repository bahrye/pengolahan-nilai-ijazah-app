"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { useToast } from "@/components/ToastProvider";
import {
  removePrintLetterheadAction,
  savePrintSettingsAction,
  uploadPrintLetterheadAction,
} from "@/server/actions/print-settings";

import type { PrintDateMode } from "@prisma/client";

function dateToInputValue(d: Date | null): string {
  if (!d || Number.isNaN(d.getTime())) return "";
  const x = new Date(d);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${x.getFullYear()}-${pad(x.getMonth() + 1)}-${pad(x.getDate())}`;
}

export function PengaturanCetakNilaiForm(props: {
  cloudinaryReady: boolean;
  defaults: {
    printLetterheadUrl: string | null;
    printSignaturePlace: string;
    printDateMode: PrintDateMode;
    printManualDate: Date | null;
  };
}) {
  const router = useRouter();
  const { toast } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);

  const [letterheadUrl, setLetterheadUrl] = useState<string | null>(props.defaults.printLetterheadUrl);
  const [place, setPlace] = useState(props.defaults.printSignaturePlace);
  const [dateMode, setDateMode] = useState<PrintDateMode>(props.defaults.printDateMode);
  const [manualDate, setManualDate] = useState(() => dateToInputValue(props.defaults.printManualDate));

  const [busySave, setBusySave] = useState(false);
  const [busyUpload, setBusyUpload] = useState(false);
  const [busyRemove, setBusyRemove] = useState(false);

  useEffect(() => {
    setLetterheadUrl(props.defaults.printLetterheadUrl);
    setPlace(props.defaults.printSignaturePlace);
    setDateMode(props.defaults.printDateMode);
    setManualDate(dateToInputValue(props.defaults.printManualDate));
  }, [
    props.defaults.printLetterheadUrl,
    props.defaults.printSignaturePlace,
    props.defaults.printDateMode,
    props.defaults.printManualDate,
  ]);

  async function onSaveSettings(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusySave(true);
    const res = await savePrintSettingsAction({
      printSignaturePlace: place.trim() === "" ? null : place.trim(),
      printDateMode: dateMode,
      printManualDateIso: dateMode === "MANUAL" && manualDate.trim() !== "" ? manualDate : null,
    });
    setBusySave(false);
    if (!res.ok) toast(res.message, "error");
    else {
      toast("Pengaturan cetak nilai disimpan.", "success");
      router.refresh();
    }
  }

  async function onPickFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!props.cloudinaryReady) {
      toast("Cloudinary belum dikonfigurasi di server.", "error");
      return;
    }
    setBusyUpload(true);
    const fd = new FormData();
    fd.set("file", file);
    const res = await uploadPrintLetterheadAction(fd);
    setBusyUpload(false);
    if (!res.ok) toast(res.message, "error");
    else {
      setLetterheadUrl(res.url);
      toast("Kop surat berhasil diunggah.", "success");
      router.refresh();
    }
  }

  async function onRemoveLetterhead() {
    setBusyRemove(true);
    const res = await removePrintLetterheadAction();
    setBusyRemove(false);
    if (!res.ok) toast(res.message, "error");
    else {
      setLetterheadUrl(null);
      toast("Kop surat dihapus.", "success");
      router.refresh();
    }
  }

  return (
    <div className="space-y-10">
      <div className="max-w-2xl space-y-1">
        <h1 className="ui-page-title">Pengaturan cetak nilai</h1>
        <p className="ui-muted text-pretty">
          Atur kop surat sekolah (Cloudinary), tempat pengetanggalan, dan mode tanggal pada dokumen cetak. Pengaturan
          tanggal manual berlaku seragam untuk semua guru saat mencetak.
        </p>
      </div>

      <section className="max-w-xl space-y-4">
        <h2 className="text-base font-semibold tracking-tight">Kop surat sekolah</h2>
        {!props.cloudinaryReady ? (
          <div className="ui-card ui-card-tight border-amber-200 bg-amber-50/80 text-amber-950 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-100">
            <p className="text-sm text-pretty">
              Variabel lingkungan Cloudinary belum lengkap. Tambahkan{" "}
              <code className="rounded bg-black/10 px-1 py-0.5 text-[12px] dark:bg-white/10">
                CLOUDINARY_CLOUD_NAME
              </code>
              ,{" "}
              <code className="rounded bg-black/10 px-1 py-0.5 text-[12px] dark:bg-white/10">
                CLOUDINARY_API_KEY
              </code>
              , dan{" "}
              <code className="rounded bg-black/10 px-1 py-0.5 text-[12px] dark:bg-white/10">
                CLOUDINARY_API_SECRET
              </code>{" "}
              pada server lalu mulai ulang aplikasi.
            </p>
          </div>
        ) : null}

        <div className="ui-card ui-card-tight space-y-4">
          <div
            className={`relative flex min-h-[160px] flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed px-4 py-8 text-center transition ${
              props.cloudinaryReady
                ? "border-slate-300 bg-slate-50/50 dark:border-slate-600 dark:bg-slate-900/40"
                : "cursor-not-allowed border-slate-200 opacity-60 dark:border-slate-700"
            }`}
          >
            <input
              ref={fileRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="sr-only"
              disabled={!props.cloudinaryReady || busyUpload}
              onChange={(ev) => void onPickFile(ev)}
            />
            {letterheadUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={letterheadUrl}
                alt="Pratinjau kop surat"
                className="max-h-40 w-auto max-w-full rounded-lg border border-slate-200 object-contain shadow-sm dark:border-slate-600"
              />
            ) : (
              <p className="ui-muted text-sm">Belum ada gambar kop surat.</p>
            )}
            <div className="flex flex-wrap items-center justify-center gap-2">
              <button
                type="button"
                disabled={!props.cloudinaryReady || busyUpload}
                onClick={() => fileRef.current?.click()}
                className="ui-btn ui-btn-primary"
              >
                {busyUpload ? "Mengunggah…" : "Pilih & unggah gambar"}
              </button>
              {letterheadUrl ? (
                <button
                  type="button"
                  disabled={busyRemove || busyUpload}
                  onClick={() => void onRemoveLetterhead()}
                  className="ui-btn ui-btn-ghost text-red-700 hover:bg-red-50 dark:text-red-300 dark:hover:bg-red-950/40"
                >
                  {busyRemove ? "Menghapus…" : "Hapus kop surat"}
                </button>
              ) : null}
            </div>
            <p className="ui-muted max-w-md text-[12px] text-pretty">
              JPEG, PNG, atau WebP — maks. 3 MB. Gambar dipakai sebagai kop pada cetakan nilai (integrasi tata letak PDF
              dapat ditambahkan pada langkah berikutnya).
            </p>
          </div>
        </div>
      </section>

      <form onSubmit={onSaveSettings} className="max-w-xl space-y-8">
        <div className="ui-card ui-card-tight space-y-4">
          <h2 className="text-base font-semibold tracking-tight">Tempat pengetanggalan</h2>
          <label className="block space-y-1.5">
            <span className="text-sm font-medium">Tempat (mis. kota)</span>
            <input
              type="text"
              value={place}
              onChange={(e) => setPlace(e.target.value)}
              maxLength={160}
              placeholder="Contoh: Surabaya"
              className="ui-input w-full"
            />
            <span className="ui-muted block text-[12px]">
              Dipakai pada teks seperti &quot;..., di [tempat], tanggal ...&quot; pada dokumen cetak.
            </span>
          </label>
        </div>

        <div className="ui-card ui-card-tight space-y-4">
          <h2 className="text-base font-semibold tracking-tight">Mode tanggal cetak</h2>
          <fieldset className="space-y-3">
            <label className="flex cursor-pointer gap-3 rounded-lg border border-white/10 bg-white/[0.03] p-3">
              <input
                type="radio"
                name="print-date-mode"
                className="mt-1"
                checked={dateMode === "AUTO_ON_SUBMIT"}
                onChange={() => setDateMode("AUTO_ON_SUBMIT")}
              />
              <span>
                <span className="font-medium">Otomatis — mengikuti tanggal kirim</span>
                <span className="ui-muted mt-0.5 block text-sm">
                  Tanggal pada cetakan mengikuti saat nilai ujian mapel dikirim (dikunci) per mapel.
                </span>
              </span>
            </label>
            <label className="flex cursor-pointer gap-3 rounded-lg border border-white/10 bg-white/[0.03] p-3">
              <input
                type="radio"
                name="print-date-mode"
                className="mt-1"
                checked={dateMode === "MANUAL"}
                onChange={() => setDateMode("MANUAL")}
              />
              <span>
                <span className="font-medium">Manual — tanggal seragam</span>
                <span className="ui-muted mt-0.5 block text-sm">
                  Anda memilih satu tanggal; tanggal yang sama dipakai di semua cetakan guru untuk sekolah ini.
                </span>
              </span>
            </label>
          </fieldset>

          {dateMode === "MANUAL" ? (
            <label className="block space-y-1.5">
              <span className="text-sm font-medium">Tanggal cetak seragam</span>
              <input
                type="date"
                required={dateMode === "MANUAL"}
                value={manualDate}
                onChange={(e) => setManualDate(e.target.value)}
                className="ui-input w-full max-w-xs"
              />
            </label>
          ) : null}
        </div>

        <button type="submit" disabled={busySave} className="ui-btn ui-btn-success">
          {busySave ? "Menyimpan…" : "Simpan pengaturan"}
        </button>
      </form>
    </div>
  );
}
