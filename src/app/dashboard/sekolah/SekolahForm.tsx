"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import type { SchoolLevel } from "@prisma/client";

import { SCHOOL_LEVEL_LABEL } from "@/domain/school-levels";
import { upsertSchoolDataForm } from "@/server/actions/school";

export function SekolahForm(props: {
  defaults: {
    jenjang: SchoolLevel;
    namaSekolah: string;
    npsn: string;
    nsm: string;
    alamat: string;
    provinsi: string;
    tipeKabupaten: "Kabupaten" | "Kota";
    kabupaten: string;
    kecamatan: string;
    tipeKelurahan: "Kelurahan" | "Desa";
    kelurahan: string;
    kodePos: string;
    telepon: string;
    email: string;
    website: string;
    namaKepsek: string;
    nipKepsek: string;
    raporSemesterCount: number;
  };
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const d = props.defaults;
  const jenjangSD = ["MI", "SD", "SDLB"];
  const jenjangSMPSMA = ["MTS", "SMP", "SMPLB", "MA", "SMA", "SMALB", "SMK", "SLB", "PKBM"];
  
  const isSD = jenjangSD.includes(d.jenjang);
  const isSMPSMA = jenjangSMPSMA.includes(d.jenjang);
  const canChooseRaporCount = isSD || isSMPSMA;

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setBusy(true);
    setStatus(null);
    const res = await upsertSchoolDataForm({
      jenjang: d.jenjang,
      namaSekolah: String(fd.get("namaSekolah") || ""),
      npsn: d.npsn || null,
      nsm: String(fd.get("nsm") || "") || null,
      alamat: String(fd.get("alamat") || "") || null,
      provinsi: String(fd.get("provinsi") || ""),
      tipeKabupaten: fd.get("tipeKabupaten") as "Kabupaten" | "Kota",
      kabupaten: String(fd.get("kabupaten") || ""),
      kecamatan: String(fd.get("kecamatan") || ""),
      tipeKelurahan: fd.get("tipeKelurahan") as "Kelurahan" | "Desa",
      kelurahan: String(fd.get("kelurahan") || ""),
      kodePos: String(fd.get("kodePos") || "") || null,
      telepon: String(fd.get("telepon") || "") || null,
      email: String(fd.get("email") || "") || null,
      website: String(fd.get("website") || "") || null,
      namaKepsek: String(fd.get("namaKepsek") || ""),
      nipKepsek: String(fd.get("nipKepsek") || "") || null,
      raporSemesterCount: Number(fd.get("raporSemesterCount") || d.raporSemesterCount),
    });
    setBusy(false);
    if (!res.ok) setStatus(res.message);
    else {
      setStatus("Tersimpan.");
      router.refresh();
    }
  }

  return (
    <>
      <div className="mb-6 max-w-3xl space-y-1">
        <h1 className="ui-page-title">Data sekolah</h1>
        <p className="ui-muted text-pretty">
          Identitas resmi satuan pendidikan dan kontak digunakan pada dokumen serta alur penilaian ijazah.
        </p>
      </div>
      <section className="ui-card max-w-[56rem]">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
          <h2 className="ui-section-title">Formulir data</h2>
          <span className="rounded-full bg-indigo-50 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-indigo-800 ring-1 ring-indigo-200/80 dark:bg-indigo-500/15 dark:text-indigo-100 dark:ring-indigo-400/30">
            Wajib isi bertanda *
          </span>
        </div>
        {status ? (
          <p className="ui-alert ui-alert-info mb-4 font-medium">{status}</p>
        ) : null}
        <form onSubmit={onSubmit} className="grid gap-4 sm:gap-5">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="ui-label">
              Jenjang (terkunci)
              <input
                value={SCHOOL_LEVEL_LABEL[d.jenjang] ?? d.jenjang}
                className="ui-input mt-1.5 opacity-80"
                readOnly
                disabled
              />
            </label>
            <label className="ui-label">
              Jumlah semester rapor {isSD ? "(pilih 3, 4, 5 atau 6)" : isSMPSMA ? "(pilih 5 atau 6)" : "(terkunci 5)"}
              {canChooseRaporCount ? (
                <select
                  name="raporSemesterCount"
                  defaultValue={String(d.raporSemesterCount)}
                  className="ui-select mt-1.5"
                >
                  {isSD && <option value="3">3 semester</option>}
                  {isSD && <option value="4">4 semester</option>}
                  <option value="5">5 semester</option>
                  <option value="6">6 semester</option>
                </select>
              ) : (
                <>
                  <input value="5 semester" className="ui-input mt-1.5 opacity-80" readOnly disabled />
                  <input type="hidden" name="raporSemesterCount" value="5" />
                </>
              )}
            </label>
          </div>
          <label className="ui-label">
            Nama Sekolah *
            <input name="namaSekolah" required defaultValue={d.namaSekolah} className="ui-input mt-1.5" />
          </label>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="ui-label">
              NPSN (terkunci)
              <input value={d.npsn} className="ui-input mt-1.5 opacity-80" readOnly disabled />
            </label>
            <label className="ui-label">
              NSM
              <input name="nsm" defaultValue={d.nsm} className="ui-input mt-1.5" />
            </label>
          </div>
          <label className="ui-label">
            Alamat
            <input name="alamat" defaultValue={d.alamat} className="ui-input mt-1.5" />
          </label>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="ui-label">
              Provinsi *
              <input name="provinsi" required defaultValue={d.provinsi} className="ui-input mt-1.5" />
            </label>
            <label className="ui-label">
              Tipe Kab/Kota
              <select name="tipeKabupaten" defaultValue={d.tipeKabupaten} className="ui-select mt-1.5">
                <option value="Kabupaten">Kabupaten</option>
                <option value="Kota">Kota</option>
              </select>
            </label>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="ui-label">
              Kabupaten/Kota *
              <input name="kabupaten" required defaultValue={d.kabupaten} className="ui-input mt-1.5" />
            </label>
            <label className="ui-label">
              Kecamatan *
              <input name="kecamatan" required defaultValue={d.kecamatan} className="ui-input mt-1.5" />
            </label>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="ui-label">
              Tipe Kel/Desa
              <select name="tipeKelurahan" defaultValue={d.tipeKelurahan} className="ui-select mt-1.5">
                <option value="Kelurahan">Kelurahan</option>
                <option value="Desa">Desa</option>
              </select>
            </label>
            <label className="ui-label">
              Kelurahan/Desa *
              <input name="kelurahan" required defaultValue={d.kelurahan} className="ui-input mt-1.5" />
            </label>
            <label className="ui-label">
              Kode pos
              <input name="kodePos" defaultValue={d.kodePos} className="ui-input mt-1.5" />
            </label>
            <label className="ui-label">
              Telepon
              <input name="telepon" defaultValue={d.telepon} className="ui-input mt-1.5" />
            </label>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="ui-label">
              Email
              <input name="email" type="email" defaultValue={d.email} className="ui-input mt-1.5" />
            </label>
            <label className="ui-label">
              Website
              <input name="website" defaultValue={d.website} className="ui-input mt-1.5" />
            </label>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="ui-label">
              Nama Kepala Sekolah *
              <input name="namaKepsek" required defaultValue={d.namaKepsek} className="ui-input mt-1.5" />
            </label>
            <label className="ui-label">
              NIP Kepsek
              <input name="nipKepsek" defaultValue={d.nipKepsek} className="ui-input mt-1.5" />
            </label>
          </div>
          <div className="flex flex-wrap gap-3 pt-1">
            <button type="submit" disabled={busy} className="ui-btn ui-btn-primary px-8">
              Simpan data
            </button>
          </div>
        </form>
      </section>
    </>
  );
}
