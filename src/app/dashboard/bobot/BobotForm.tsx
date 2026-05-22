"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import { useToast } from "@/components/ToastProvider";
import { updateGradingConfigAction } from "@/server/actions/bobot";

function computePredikat(kkm: number) {
  const range = 100 - kkm;
  const step = Math.round(range / 3);

  const bMin = kkm + step;
  const aMin = kkm + step * 2 + 1;

  return [
    { huruf: "A", rentang: `${aMin}–100`, status: "Sangat Baik" },
    { huruf: "B", rentang: `${bMin}–${aMin - 1}`, status: "Baik" },
    { huruf: "C", rentang: `${kkm}–${bMin - 1}`, status: "Cukup" },
    { huruf: "D", rentang: `< ${kkm}`, status: "Kurang" },
  ];
}

export function BobotForm(props: {
  defaults: {
    bobotUjian: number;
    bobotRapor: number;
    kkm: number;
    raporAspectMode: "PENGETAHUAN_ONLY" | "KETERAMPILAN_ONLY" | "BOTH";
  };
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);
  const [bobotUjianStr, setBobotUjianStr] = useState(String(props.defaults.bobotUjian));
  const [bobotRaporStr, setBobotRaporStr] = useState(String(props.defaults.bobotRapor));
  const [kkmStr, setKkmStr] = useState(String(props.defaults.kkm));

  const bobotUjian = Number(bobotUjianStr) || 0;
  const kkmLive = Number(kkmStr) || 0;

  const predikat = useMemo(() => computePredikat(Math.max(1, Math.min(100, kkmLive))), [kkmLive]);

  function handleBobotUjianChange(raw: string) {
    setBobotUjianStr(raw);
    const val = Number(raw) || 0;
    setBobotRaporStr(String(Math.min(100, Math.max(0, 100 - val))));
  }

  function handleBobotRaporChange(raw: string) {
    setBobotRaporStr(raw);
    const val = Number(raw) || 0;
    setBobotUjianStr(String(Math.min(100, Math.max(0, 100 - val))));
  }

  function blurBobot() {
    const u = Math.min(100, Math.max(0, bobotUjian));
    setBobotUjianStr(String(u));
    setBobotRaporStr(String(100 - u));
  }

  function blurKkm() {
    const v = Math.min(100, Math.max(1, kkmLive || 1));
    setKkmStr(String(v));
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const finalUjian = Math.min(100, Math.max(0, bobotUjian));
    const finalRapor = 100 - finalUjian;
    const finalKkm = Math.min(100, Math.max(1, kkmLive || 1));
    setBobotUjianStr(String(finalUjian));
    setBobotRaporStr(String(finalRapor));
    setKkmStr(String(finalKkm));
    setBusy(true);
    const res = await updateGradingConfigAction({
      bobotUjian: finalUjian,
      bobotRapor: finalRapor,
      kkm: finalKkm,
      raporAspectMode: "BOTH",
    });
    setBusy(false);
    if (!res.ok) {
      toast(res.message, "error");
    } else {
      toast("Konfigurasi nilai berhasil diperbarui.", "success");
      router.refresh();
    }
  }

  return (
    <div className="space-y-8">
      <div className="max-w-2xl space-y-1">
        <h1 className="ui-page-title">Bobot nilai ijazah</h1>
        <p className="ui-muted text-pretty">
          Samakan proporsi ujian vs rapor sebelum rekap final agar hasil ijazah konsisten.
        </p>
      </div>

      <section className="ui-card max-w-xl">
        <h2 className="ui-section-title mb-4">Parameter penilaian</h2>
        <form onSubmit={onSubmit} className="grid gap-4">
          <label className="ui-label">
            Bobot ujian (%)
            <input
              name="bobotUjian"
              type="number"
              min={0}
              max={100}
              step="0.01"
              value={bobotUjianStr}
              onChange={(e) => handleBobotUjianChange(e.target.value)}
              onBlur={blurBobot}
              className="ui-input mt-1.5"
            />
          </label>
          <label className="ui-label">
            Bobot rapor (%)
            <input
              name="bobotRapor"
              type="number"
              min={0}
              max={100}
              step="0.01"
              value={bobotRaporStr}
              onChange={(e) => handleBobotRaporChange(e.target.value)}
              onBlur={blurBobot}
              className="ui-input mt-1.5"
            />
          </label>
          <p className="text-xs text-slate-500 dark:text-slate-400 -mt-2">
            Total bobot ujian + rapor selalu = <strong>100%</strong>
          </p>
          <label className="ui-label">
            KKM
            <input
              name="kkm"
              type="number"
              min={1}
              max={100}
              step={1}
              value={kkmStr}
              onChange={(e) => setKkmStr(e.target.value)}
              onBlur={blurKkm}
              className="ui-input mt-1.5"
            />
          </label>
          <button type="submit" disabled={busy} className="ui-btn ui-btn-primary w-fit">
            Simpan konfigurasi
          </button>
        </form>
      </section>

      <section className="ui-card max-w-xl">
        <h2 className="ui-section-title mb-1">Predikat berdasarkan KKM ({kkmLive})</h2>
        <p className="ui-muted mb-4 text-sm">
          Predikat otomatis dihitung berdasarkan nilai KKM yang ditentukan.
        </p>
        <div className="overflow-hidden rounded-lg border border-slate-200 dark:border-slate-700">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-100 dark:bg-slate-800">
                <th className="px-4 py-2.5 text-left font-semibold">Predikat</th>
                <th className="px-4 py-2.5 text-left font-semibold">Rentang Nilai</th>
                <th className="px-4 py-2.5 text-left font-semibold">Status</th>
              </tr>
            </thead>
            <tbody>
              {predikat.map((p) => (
                <tr key={p.huruf} className="border-t border-slate-200 dark:border-slate-700">
                  <td className="px-4 py-2.5 font-bold text-indigo-600 dark:text-indigo-400">{p.huruf}</td>
                  <td className="px-4 py-2.5 tabular-nums">{p.rentang}</td>
                  <td className="px-4 py-2.5">{p.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
