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
import { saveExamInputSettingsAction } from "@/server/actions/exam-input-settings";

import type { ExamInputPolicy } from "@prisma/client";

export function PengaturanInputNilaiForm(props: {
  defaults: {
    examInputPolicy: ExamInputPolicy;
    examInputWindowStartIso: string | null;
    examInputWindowEndIso: string | null;
  };
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);
  const [policy, setPolicy] = useState<ExamInputPolicy>(props.defaults.examInputPolicy);
  const localTzAbbrev = indonesiaTzAbbrevForTimeZone(getBrowserTimeZone());
  const [windowStartLocal, setWindowStartLocal] = useState(() =>
    isoUtcToDatetimeLocalBrowser(props.defaults.examInputWindowStartIso),
  );
  const [windowEndLocal, setWindowEndLocal] = useState(() =>
    isoUtcToDatetimeLocalBrowser(props.defaults.examInputWindowEndIso),
  );

  useEffect(() => {
    setPolicy(props.defaults.examInputPolicy);
    setWindowStartLocal(
      isoUtcToDatetimeLocalBrowser(props.defaults.examInputWindowStartIso),
    );
    setWindowEndLocal(isoUtcToDatetimeLocalBrowser(props.defaults.examInputWindowEndIso));
  }, [
    props.defaults.examInputPolicy,
    props.defaults.examInputWindowStartIso,
    props.defaults.examInputWindowEndIso,
  ]);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    const res = await saveExamInputSettingsAction({
      examInputPolicy: policy,
      examInputWindowStartIso:
        policy === "LIMITED" ? datetimeLocalToIsoUtcBrowser(windowStartLocal) : null,
      examInputWindowEndIso:
        policy === "LIMITED" ? datetimeLocalToIsoUtcBrowser(windowEndLocal) : null,
    });
    setBusy(false);
    if (!res.ok) {
      toast(res.message, "error");
    } else {
      toast("Pengaturan input nilai ujian disimpan.", "success");
      router.refresh();
    }
  }

  return (
    <div className="space-y-8">
      <div className="max-w-2xl space-y-1">
        <h1 className="ui-page-title">Pengaturan input dan kirim nilai</h1>
        <p className="ui-muted text-pretty">
          Atur apakah guru boleh mengisi, menyimpan, dan mengirim nilai ujian tertulis &amp; praktik. Admin sekolah
          tidak dibatasi oleh pengaturan ini.
        </p>
      </div>

      <form onSubmit={onSubmit} className="max-w-xl space-y-8">
        <div className="ui-card ui-card-tight space-y-4">
          <h2 className="text-base font-semibold tracking-tight">Mode</h2>
          <fieldset className="space-y-3">
            <label className="flex cursor-pointer gap-3 rounded-lg border border-white/10 bg-white/[0.03] p-3">
              <input
                type="radio"
                name="exam-input-mode"
                className="mt-1"
                checked={policy === "LOCKED"}
                onChange={() => setPolicy("LOCKED")}
              />
              <span>
                <span className="font-medium">Dikunci</span>
                <span className="ui-muted mt-0.5 block text-sm">
                  Guru tidak dapat mengubah nilai; tombol simpan dan kirim dinonaktifkan. Mereka melihat pesan bahwa
                  input terkunci.
                </span>
              </span>
            </label>
            <label className="flex cursor-pointer gap-3 rounded-lg border border-white/10 bg-white/[0.03] p-3">
              <input
                type="radio"
                name="exam-input-mode"
                className="mt-1"
                checked={policy === "OPEN"}
                onChange={() => setPolicy("OPEN")}
              />
              <span>
                <span className="font-medium">Dibuka</span>
                <span className="ui-muted mt-0.5 block text-sm">
                  Guru bebas mengisi, menyimpan, dan mengirim nilai kapan saja.
                </span>
              </span>
            </label>
            <label className="flex cursor-pointer gap-3 rounded-lg border border-white/10 bg-white/[0.03] p-3">
              <input
                type="radio"
                name="exam-input-mode"
                className="mt-1"
                checked={policy === "LIMITED"}
                onChange={() => setPolicy("LIMITED")}
              />
              <span>
                <span className="font-medium">Terbatas</span>
                <span className="ui-muted mt-0.5 block text-sm">
                  Guru hanya dapat mengisi dalam rentang waktu mulai dan selesai yang Anda tentukan. Di luar jendela,
                  perilaku sama seperti Dikunci.
                </span>
              </span>
            </label>
          </fieldset>
        </div>

        {policy === "LIMITED" ? (
          <div className="ui-card ui-card-tight space-y-4">
            <h2 className="text-base font-semibold tracking-tight">Jendela waktu (guru)</h2>
            <p className="ui-muted text-sm text-pretty">
              Waktu mengikuti zona perangkat Anda (<strong>{localTzAbbrev}</strong> — mis. Jakarta WIB, Sulawesi
              WITA). Disimpan sebagai titik waktu absolut (UTC); guru melihat tanggal dalam zona lokal masing-masing.
            </p>
            <label className="ui-label">
              Mulai dibuka
              <input
                type="datetime-local"
                className="ui-input mt-1.5 w-full max-w-sm"
                value={windowStartLocal}
                onChange={(e) => setWindowStartLocal(e.target.value)}
              />
            </label>
            <label className="ui-label">
              Ditutup
              <input
                type="datetime-local"
                className="ui-input mt-1.5 w-full max-w-sm"
                value={windowEndLocal}
                onChange={(e) => setWindowEndLocal(e.target.value)}
              />
            </label>
          </div>
        ) : null}

        <button type="submit" className="ui-btn ui-btn-primary" disabled={busy}>
          {busy ? "Menyimpan…" : "Simpan pengaturan"}
        </button>
      </form>
    </div>
  );
}
