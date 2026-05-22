"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";

import {
  listSemestersForYearAction,
  seedSemestersForYearAction,
} from "@/server/actions/akademik";
import { useToast } from "@/components/ToastProvider";

export function SemesterClient(props: {
  years: { id: string; label: string }[];
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [yearId, setYearId] = useState(props.years[0]?.id ?? "");
  const [semesters, setSemesters] = useState<
    { id: string; label: string; internalKey: string }[]
  >([]);
  const [busy, setBusy] = useState(false);
  const [confirmModal, setConfirmModal] = useState<{
    message: string;
  } | null>(null);

  async function loadSem() {
    if (!yearId) return;
    const list = await listSemestersForYearAction(yearId);
    setSemesters(
      list.map((s) => ({ id: s.id, label: s.label, internalKey: s.internalKey })),
    );
  }

  async function doSeed(force?: boolean) {
    if (!yearId) return;
    setBusy(true);
    try {
      const res = await seedSemestersForYearAction(yearId, { force });
      if (!res.ok) {
        if ("needsConfirm" in res && res.needsConfirm) {
          setConfirmModal({ message: res.message });
          setBusy(false);
          return;
        }
        toast(res.message, "error");
        setBusy(false);
        return;
      }
      await loadSem();
      if (res.warning) {
        toast(res.warning, "warning");
      } else {
        toast("Semester dihasilkan dari pola jenjang sekolah.", "success");
      }
      router.refresh();
    } catch (e) {
      toast((e as Error).message, "error");
    }
    setBusy(false);
  }

  async function handleConfirmForce() {
    setConfirmModal(null);
    await doSeed(true);
  }

  React.useEffect(() => {
    if (yearId) void loadSem();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [yearId]);

  return (
    <div className="space-y-8">
      <div className="max-w-3xl space-y-1">
        <h1 className="ui-page-title">Data semester</h1>
        <p className="ui-muted text-pretty">
          Generate semester otomatis dari jenjang sekolah atau validasi struktur akademik Anda.
        </p>
      </div>

      <section className="ui-card ui-card-tight space-y-4">
        <div className="flex flex-wrap items-end gap-3">
          <label className="ui-label min-w-[min(100%,14rem)] grow sm:max-w-xs">
            Tahun ajaran
            <select
              value={yearId}
              onChange={(e) => setYearId(e.target.value)}
              className="ui-select mt-1.5"
            >
              {props.years.map((y) => (
                <option key={y.id} value={y.id}>
                  {y.label}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            onClick={() => void loadSem()}
            className="ui-btn ui-btn-ghost"
            disabled={busy}
          >
            Muat
          </button>
          <button
            type="button"
            onClick={() => void doSeed()}
            className="ui-btn ui-btn-amber"
            disabled={busy}
          >
            {busy ? "Memproses…" : "Seed dari jenjang"}
          </button>
        </div>
      </section>

      <section>
        <h2 className="ui-section-title mb-3">Urutan semester</h2>
        <div className="ui-table-shell divide-y divide-slate-200/90 dark:divide-slate-700/85">
          {semesters.map((s, i) => (
            <div
              key={s.id}
              className="flex flex-wrap items-baseline gap-4 px-4 py-3 text-[14px]"
            >
              <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-slate-100 text-[11px] font-bold text-slate-600 dark:bg-slate-700 dark:text-slate-300">
                {i + 1}
              </span>
              <span className="rounded-md bg-indigo-100 px-2 py-0.5 font-mono text-[11px] font-semibold uppercase tracking-wide text-indigo-800 dark:bg-indigo-400/15 dark:text-indigo-50">
                {s.internalKey}
              </span>
              <span className="font-semibold text-slate-900 dark:text-slate-100">
                {s.label}
              </span>
            </div>
          ))}
          {semesters.length === 0 && (
            <p className="ui-muted px-4 py-8 text-center">
              Belum ada data semester. Klik{" "}
              <strong>&quot;Seed dari jenjang&quot;</strong> untuk menghasilkan
              semester otomatis.
            </p>
          )}
        </div>
        <p className="ui-muted mt-4 max-w-2xl text-pretty">
          Pastikan jenjang sekolah sudah diset pada Data Sekolah. Jumlah semester
          yang ditampilkan mengikuti pengaturan &quot;Jumlah semester rapor&quot;
          di Data Sekolah. Jika diubah, lakukan seed ulang agar semester
          diperbarui.
        </p>
      </section>

      {/* ── Confirmation modal ── */}
      {confirmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div
            className="w-full max-w-md animate-[fadeScaleIn_0.2s_ease-out] rounded-2xl bg-white p-6 shadow-2xl dark:bg-slate-800"
          >
            <h3 className="mb-2 text-lg font-bold text-amber-700 dark:text-amber-400">
              ⚠ Perhatian
            </h3>
            <p className="mb-5 text-sm leading-relaxed text-slate-700 dark:text-slate-300">
              {confirmModal.message}
            </p>
            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setConfirmModal(null)}
                className="ui-btn ui-btn-ghost"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={() => void handleConfirmForce()}
                className="ui-btn ui-btn-amber"
              >
                Ya, Lanjutkan Seed
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
