"use client";

import { AlertTriangle, Power, PowerOff, Timer } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import {
  getPlatformMaintenanceAction,
  setPlatformMaintenanceAction,
  type PlatformMaintenanceDto,
} from "@/server/actions/platform-maintenance";

export function SuperadminMaintenancePanel() {
  const [data, setData] = useState<PlatformMaintenanceDto | null>(null);
  const [endsAtLocal, setEndsAtLocal] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const next = await getPlatformMaintenanceAction();
      setData(next);
      setEndsAtLocal(next.endsAtLocalWib ?? "");
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Gagal memuat status maintenance.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  useEffect(() => {
    if (!data?.isActive) return undefined;
    const id = window.setInterval(() => {
      void reload();
    }, 300_000); // 5 menit
    return () => window.clearInterval(id);
  }, [data?.isActive, reload]);

  async function applyActive(isActive: boolean) {
    setBusy(true);
    setMsg(null);
    const r = await setPlatformMaintenanceAction({
      isActive,
      endsAtLocal: isActive ? endsAtLocal : undefined,
    });
    setBusy(false);
    if (!r.ok) {
      setMsg(r.message);
      return;
    }
    setData(r.data);
    setEndsAtLocal(r.data.endsAtLocalWib ?? "");
    setMsg(
      isActive
        ? "Maintenance diaktifkan. Halaman login tidak dapat diakses hingga waktu selesai atau dinonaktifkan manual."
        : "Maintenance dinonaktifkan. Halaman login kembali normal.",
    );
  }

  async function applyRegistrationOpen(isRegistrationOpen: boolean) {
    setBusy(true);
    setMsg(null);
    const r = await setPlatformMaintenanceAction({
      isActive: data?.isActive ?? false,
      isRegistrationOpen,
    });
    setBusy(false);
    if (!r.ok) {
      setMsg(r.message);
      return;
    }
    setData(r.data);
    setMsg(
      isRegistrationOpen
        ? "Registrasi akun berhasil dibuka."
        : "Registrasi akun berhasil ditutup.",
    );
  }

  const active = data?.isActive ?? false;
  const regOpen = data?.isRegistrationOpen ?? true;

  return (
    <section className="ui-card space-y-5 overflow-hidden border-violet-200/80 dark:border-violet-500/30">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="ui-section-title flex items-center gap-2">
            <Timer className="size-5 text-violet-600 dark:text-violet-400" aria-hidden />
            Maintenance
          </h2>
          <p className="ui-muted mt-1 max-w-2xl text-sm text-pretty">
            Saat aktif, seluruh halaman login ditutup dan pengguna melihat layar pembaruan
            sistem. Maintenance otomatis nonaktif setelah waktu selesai tercapai.
          </p>
        </div>
        <span
          className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wide ${
            active
              ? "bg-amber-100 text-amber-900 dark:bg-amber-500/20 dark:text-amber-200"
              : "bg-emerald-100 text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-300"
          }`}
        >
          {active ? "Aktif" : "Nonaktif"}
        </span>
      </div>

      {msg ? (
        <p role="status" className="ui-alert ui-alert-info text-sm">
          {msg}
        </p>
      ) : null}

      {loading ? (
        <p className="ui-muted text-sm">Memuat status…</p>
      ) : (
        <>
          <label className="ui-label block max-w-md">
            Waktu perkiraan selesai
            <input
              type="datetime-local"
              className="ui-input mt-1.5 w-full"
              value={endsAtLocal}
              onChange={(e) => setEndsAtLocal(e.target.value)}
              disabled={busy || active}
            />
            <span className="mt-1.5 block text-[12px] text-slate-500 dark:text-slate-400">
              Waktu Indonesia (WIB, UTC+7). Contoh: 09 Juni 2027 pukul 06.00 = ketik 06:00 di sini.
              Setelah lewat, maintenance mati otomatis.
            </span>
          </label>

          {active && data?.endsAtLabelWib ? (
            <div className="flex gap-2 rounded-xl border border-amber-200/90 bg-amber-50/90 px-4 py-3 text-sm text-amber-950 dark:border-amber-500/35 dark:bg-amber-950/40 dark:text-amber-100">
              <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
              <p>
                Login diblokir hingga sekitar{" "}
                <strong>{data.endsAtLabelWib}</strong> (atau sampai Anda menonaktifkan).
              </p>
            </div>
          ) : null}

          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              disabled={busy || active}
              onClick={() => void applyActive(true)}
              className="ui-btn ui-btn-primary inline-flex items-center gap-2"
            >
              <Power className="size-4" aria-hidden />
              {busy ? "Memproses…" : "Aktifkan maintenance"}
            </button>
            <button
              type="button"
              disabled={busy || !active}
              onClick={() => void applyActive(false)}
              className="ui-btn ui-btn-ghost inline-flex items-center gap-2 border border-slate-200 dark:border-slate-600"
            >
              <PowerOff className="size-4" aria-hidden />
              Nonaktifkan maintenance
            </button>
          </div>

          <div className="mt-8 border-t border-slate-200 pt-6 dark:border-slate-700">
            <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200">
              Pengaturan Registrasi
            </h3>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              Tutup registrasi untuk mencegah sekolah baru mendaftar ke sistem.
            </p>
            <div className="mt-4 flex flex-wrap gap-3">
              {regOpen ? (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void applyRegistrationOpen(false)}
                  className="ui-btn ui-btn-ghost border border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-400 dark:hover:bg-amber-500/20"
                >
                  Tutup Registrasi
                </button>
              ) : (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void applyRegistrationOpen(true)}
                  className="ui-btn bg-emerald-600 px-5 text-white hover:bg-emerald-700"
                >
                  Buka Registrasi
                </button>
              )}
              <span
                className={`ml-2 inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wide ${
                  regOpen
                    ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-300"
                    : "bg-red-100 text-red-800 dark:bg-red-500/20 dark:text-red-300"
                }`}
              >
                {regOpen ? "Terbuka" : "Tertutup"}
              </span>
            </div>
          </div>
        </>
      )}
    </section>
  );
}
