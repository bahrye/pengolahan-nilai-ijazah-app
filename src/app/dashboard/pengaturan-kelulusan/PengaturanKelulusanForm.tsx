"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { useToast } from "@/components/ToastProvider";
import {
  datetimeLocalToIsoUtcBrowser,
  getBrowserTimeZone,
  indonesiaTzAbbrevForTimeZone,
  isoUtcToDatetimeLocalBrowser,
} from "@/lib/indonesia-timezone";
import { saveGraduationSettingsAction } from "@/server/actions/graduation-settings";

export function PengaturanKelulusanForm(props: {
  defaults: {
    graduationAnnouncementAtIso: string | null;
    ijazahRekapVisibility: "AT_ANNOUNCEMENT_TIME" | "AFTER_CHECK_ANNOUNCEMENT";
  };
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);
  const [announcementLocal, setAnnouncementLocal] = useState(() =>
    isoUtcToDatetimeLocalBrowser(props.defaults.graduationAnnouncementAtIso),
  );
  const [visibility, setVisibility] = useState(props.defaults.ijazahRekapVisibility);
  const localTzAbbrev = indonesiaTzAbbrevForTimeZone(getBrowserTimeZone());

  useEffect(() => {
    setAnnouncementLocal(
      isoUtcToDatetimeLocalBrowser(props.defaults.graduationAnnouncementAtIso),
    );
    setVisibility(props.defaults.ijazahRekapVisibility);
  }, [props.defaults.graduationAnnouncementAtIso, props.defaults.ijazahRekapVisibility]);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    const graduationAnnouncementAtIso = datetimeLocalToIsoUtcBrowser(announcementLocal);
    const res = await saveGraduationSettingsAction({
      graduationAnnouncementAtIso,
      ijazahRekapVisibility: visibility,
    });
    setBusy(false);
    if (!res.ok) {
      toast(res.message, "error");
    } else {
      toast("Pengaturan kelulusan disimpan.", "success");
      router.refresh();
    }
  }

  return (
    <div className="space-y-8">
      <div className="max-w-2xl space-y-1">
        <h1 className="ui-page-title">Pengaturan kelulusan</h1>
        <p className="ui-muted text-pretty">
          Atur waktu pengumuman kelulusan, kapan siswa boleh melihat nilai ijazah asli di menu Rekap Nilai Ijazah, dan
          kapan siswa boleh mengunduh SKL di menu Unduh SKL.
        </p>
      </div>

      <form onSubmit={onSubmit} className="max-w-xl space-y-8">
        <div className="ui-card ui-card-tight space-y-3">
          <h2 className="text-base font-semibold tracking-tight">Tanggal &amp; waktu pengumuman</h2>
          <p className="ui-muted text-sm text-pretty">
            Sebelum waktu ini, rekap ijazah siswa tetap menyembunyikan nilai dan status sebagai ****. Kosongkan untuk
            menonaktifkan jadwal (nilai tetap disembunyikan). Waktu mengikuti zona perangkat Anda (
            <strong>{localTzAbbrev}</strong> — mis. Jakarta {">"} WIB, Sulawesi {">"} WITA, Papua {">"} WIT).
          </p>
          <input
            type="datetime-local"
            className="ui-input w-full max-w-sm"
            value={announcementLocal}
            onChange={(e) => setAnnouncementLocal(e.target.value)}
          />
        </div>

        <div className="ui-card ui-card-tight space-y-4">
          <h2 className="text-base font-semibold tracking-tight">Tampilan rekap ijazah &amp; akses unduh SKL (siswa)</h2>
          <p className="ui-muted text-sm text-pretty">
            Berlaku setelah waktu pengumuman tercapai untuk menu <strong>Rekap Nilai Ijazah</strong> dan{" "}
            <strong>Unduh SKL</strong>. Mode &quot;Setelah cek Pengumuman&quot; mengharuskan siswa menandai sudah
            membaca pengumuman di menu Pengumuman terlebih dahulu.
          </p>
          <fieldset className="space-y-3">
            <label className="flex cursor-pointer gap-3 rounded-lg border border-white/10 bg-white/[0.03] p-3">
              <input
                type="radio"
                name="ijazah-vis"
                className="mt-1"
                checked={visibility === "AFTER_CHECK_ANNOUNCEMENT"}
                onChange={() => setVisibility("AFTER_CHECK_ANNOUNCEMENT")}
              />
              <span>
                <span className="font-medium">Setelah cek Pengumuman</span>
                <span className="ui-muted mt-0.5 block text-sm">
                  Nilai asli muncul setelah siswa menandai sudah melihat pengumuman di menu Pengumuman.
                </span>
              </span>
            </label>
            <label className="flex cursor-pointer gap-3 rounded-lg border border-white/10 bg-white/[0.03] p-3">
              <input
                type="radio"
                name="ijazah-vis"
                className="mt-1"
                checked={visibility === "AT_ANNOUNCEMENT_TIME"}
                onChange={() => setVisibility("AT_ANNOUNCEMENT_TIME")}
              />
              <span>
                <span className="font-medium">Saat waktu pengumuman</span>
                <span className="ui-muted mt-0.5 block text-sm">
                  Nilai asli otomatis tampil begitu waktu pengumuman tercapai, tanpa perlu membuka menu Pengumuman.
                </span>
              </span>
            </label>
          </fieldset>
        </div>

        <button type="submit" className="ui-btn ui-btn-primary" disabled={busy}>
          {busy ? "Menyimpan…" : "Simpan pengaturan"}
        </button>
      </form>
    </div>
  );
}
