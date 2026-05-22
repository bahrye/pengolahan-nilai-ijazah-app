"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { useToast } from "@/components/ToastProvider";
import {
  createAcademicYearAction,
  toggleAcademicYearActiveAction,
} from "@/server/actions/akademik";

export function TahunClient(props: {
  years: {
    id: string;
    label: string;
    isActive: boolean;
  }[];
  canAddYear?: boolean;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);
  const isFirstYear = props.years.length === 0;

  const [confirmModal, setConfirmModal] = useState<{
    yearId: string;
    label: string;
  } | null>(null);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const fd = new FormData(form);
    setBusy(true);
    const r = await createAcademicYearAction({
      label: String(fd.get("label")),
      isActive: fd.get("isActive") === "on",
    });
    setBusy(false);
    if (r.ok) {
      toast("Tahun ajaran berhasil dibuat.", "success");
      form.reset();
      router.refresh();
    } else {
      toast(r.message, "error");
    }
  }

  async function handleToggle() {
    if (!confirmModal) return;
    const { yearId, label } = confirmModal;
    setBusy(true);
    const r = await toggleAcademicYearActiveAction({
      yearId,
      setActive: true,
    });
    setBusy(false);
    setConfirmModal(null);
    if (r.ok) {
      toast(`${label} diaktifkan.`, "success");
      router.refresh();
    } else {
      toast(r.message, "error");
    }
  }

  return (
    <div className="space-y-8">
      <div className="max-w-2xl space-y-1">
        <h1 className="ui-page-title">Tahun ajaran</h1>
        <p className="ui-muted text-pretty">
          Selalu ada tepat satu tahun ajaran yang aktif (setelah Anda punya minimal satu tahun di daftar).
          Mengganti yang aktif dilakukan dengan mengaktifkan tahun lain — tahun yang lama akan otomatis nonaktif.
        </p>
      </div>

      <section className="ui-card ui-card-tight space-y-4">
        <h2 className="ui-section-title">Tambahkan tahun baru</h2>
        {props.canAddYear === false ? (
          <p className="ui-alert ui-alert-info text-sm">
            Paket gratis hanya boleh 1 tahun ajaran. Berlangganan untuk menambah tahun ajaran baru.
          </p>
        ) : null}
        <form onSubmit={submit} className="grid max-w-lg gap-3">
          <input
            name="label"
            required
            disabled={props.canAddYear === false || busy}
            placeholder="Mis. 2026/2027"
            className="ui-input"
          />
          {isFirstYear ? (
            <>
              <input type="hidden" name="isActive" value="on" />
              <p className="text-xs text-slate-600 dark:text-slate-400">
                Tahun ajaran pertama otomatis menjadi yang aktif (wajib ada satu yang aktif).
              </p>
            </>
          ) : (
            <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-slate-200/90 bg-white/60 px-3 py-2 text-[13px] font-semibold text-slate-700 dark:border-slate-700 dark:bg-white/5 dark:text-slate-200">
              <input
                type="checkbox"
                name="isActive"
                className="accent-indigo-600"
              />{" "}
              Jadikan tahun ajaran aktif (menggantikan yang sedang aktif)
            </label>
          )}
          <button
            type="submit"
            disabled={busy || props.canAddYear === false}
            className="ui-btn ui-btn-success w-fit"
          >
            Simpan tahun ajaran
          </button>
        </form>
      </section>

      <section>
        <h2 className="ui-section-title mb-3">Ringkasan</h2>
        <div className="ui-table-shell divide-y divide-slate-200/90 dark:divide-slate-700/85">
          {props.years.map((y) => (
            <div
              key={y.id}
              className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 text-[14px]"
            >
              <span className="font-semibold text-slate-900 dark:text-slate-100">
                {y.label}
              </span>
              <div className="flex items-center gap-2">
                {y.isActive ? (
                  <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wide text-emerald-900 dark:bg-emerald-500/15 dark:text-emerald-50">
                    Aktif
                  </span>
                ) : (
                  <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wide text-slate-600 dark:bg-white/10 dark:text-slate-300">
                    Nonaktif
                  </span>
                )}
                <button
                  type="button"
                  disabled={busy || y.isActive}
                  onClick={() =>
                    setConfirmModal({
                      yearId: y.id,
                      label: y.label,
                    })
                  }
                  className="ui-btn ui-btn-ghost ui-btn-sm text-xs !text-emerald-600 dark:!text-emerald-400 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {y.isActive ? "Sedang aktif" : "Aktifkan"}
                </button>
              </div>
            </div>
          ))}
          {props.years.length === 0 ? (
            <p className="px-4 py-3 ui-muted">Belum ada tahun ajaran.</p>
          ) : null}
        </div>
      </section>

      {/* ═══ Modal Konfirmasi ═══ */}
      {confirmModal ? (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md animate-[fadeScaleIn_0.2s_ease-out] rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-slate-700 dark:bg-slate-900">
            <div className="mb-4 flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 dark:bg-emerald-900/40 dark:text-emerald-400">
                <svg
                  className="h-5 w-5"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={2}
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z"
                  />
                </svg>
              </div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">Aktifkan tahun ajaran</h3>
            </div>
            <p className="mb-6 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
              Yakin ingin mengaktifkan &quot;{confirmModal.label}&quot;? Tahun ajaran yang sedang aktif akan otomatis
              dinonaktifkan — selalu tepat satu yang aktif.
            </p>
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button
                type="button"
                className="ui-btn ui-btn-ghost"
                onClick={() => setConfirmModal(null)}
                disabled={busy}
              >
                Batal
              </button>
              <button
                type="button"
                disabled={busy}
                className="ui-btn bg-emerald-600 text-white hover:bg-emerald-700"
                onClick={handleToggle}
              >
                {busy ? "Memproses..." : "Aktifkan"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
