"use client";

import { KeyRound, Trash2, X } from "lucide-react";

import { PasswordInput } from "@/components/ui/PasswordInput";
import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";

import {
  deleteSchoolAdminAccountAction,
  listSchoolAdminAccountsAction,
  setSchoolAdminActiveAction,
  superadminSetSchoolAdminPasswordAction,
  type SchoolAdminAccountRow,
} from "@/server/actions/superadmin-school-admins";

type Props = {
  schoolId: string;
  schoolName: string;
  onClose: () => void;
};

export function SchoolAdminAccountsModal({ schoolId, schoolName, onClose }: Props) {
  const [rows, setRows] = useState<SchoolAdminAccountRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<SchoolAdminAccountRow | null>(null);
  const [passwordTarget, setPasswordTarget] = useState<SchoolAdminAccountRow | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const list = await listSchoolAdminAccountsAction(schoolId);
      setRows(list);
    } catch (e) {
      setMsg((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [schoolId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  /** Kunci scroll latar + lebar dokumen: konten lebar (tabel) di belakang sering memperlebar layout → tampilan “zoom out”. */
  useEffect(() => {
    const html = document.documentElement;
    const scrollY = window.scrollY;
    const prevHtmlOverflow = html.style.overflow;
    const prevBodyPosition = document.body.style.position;
    const prevBodyTop = document.body.style.top;
    const prevBodyLeft = document.body.style.left;
    const prevBodyRight = document.body.style.right;
    const prevBodyWidth = document.body.style.width;
    const prevBodyOverflow = document.body.style.overflow;

    html.style.overflow = "hidden";
    document.body.style.position = "fixed";
    document.body.style.top = `-${scrollY}px`;
    document.body.style.left = "0";
    document.body.style.right = "0";
    document.body.style.width = "100%";
    document.body.style.overflow = "hidden";

    return () => {
      html.style.overflow = prevHtmlOverflow;
      document.body.style.position = prevBodyPosition;
      document.body.style.top = prevBodyTop;
      document.body.style.left = prevBodyLeft;
      document.body.style.right = prevBodyRight;
      document.body.style.width = prevBodyWidth;
      document.body.style.overflow = prevBodyOverflow;
      window.scrollTo(0, scrollY);
    };
  }, []);

  async function toggleActive(row: SchoolAdminAccountRow) {
    setBusy(true);
    setMsg(null);
    const r = await setSchoolAdminActiveAction({
      userId: row.id,
      schoolId,
      isActive: !row.isActive,
    });
    setBusy(false);
    if (!r.ok) {
      setMsg(r.message);
      return;
    }
    setMsg(
      row.isActive
        ? "Akun dinonaktifkan."
        : "Akun diaktifkan. Administrator lain pada sekolah ini otomatis dinonaktifkan.",
    );
    await reload();
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    setBusy(true);
    setMsg(null);
    const r = await deleteSchoolAdminAccountAction({
      userId: deleteTarget.id,
      schoolId,
    });
    setBusy(false);
    if (!r.ok) {
      setMsg(r.message);
      return;
    }
    setDeleteTarget(null);
    setMsg("Akun administrator dihapus.");
    await reload();
  }

  function openPassword(row: SchoolAdminAccountRow) {
    setPasswordTarget(row);
    setNewPassword("");
    setConfirmPassword("");
  }

  async function confirmPasswordChange() {
    if (!passwordTarget) return;
    setBusy(true);
    setMsg(null);
    const r = await superadminSetSchoolAdminPasswordAction({
      userId: passwordTarget.id,
      schoolId,
      newPassword,
      confirmPassword,
    });
    setBusy(false);
    if (!r.ok) {
      setMsg(r.message);
      return;
    }
    setPasswordTarget(null);
    setNewPassword("");
    setConfirmPassword("");
    setMsg("Sandi administrator berhasil diperbarui.");
    await reload();
  }

  /** Portal ke body + kunci scroll: hindari fixed terjebak ancestor & dokumen lebar di belakang modal */
  return createPortal(
    <>
      <div
        className="fixed inset-0 z-50 overflow-x-hidden overflow-y-auto overscroll-contain bg-slate-900/60 px-3 pt-[max(1rem,env(safe-area-inset-top))] pb-4 pl-[max(0.75rem,env(safe-area-inset-left))] pr-[max(0.75rem,env(safe-area-inset-right))] sm:px-4 sm:pb-8 sm:pt-8"
        role="dialog"
        aria-modal="true"
        aria-labelledby="school-admins-title"
      >
        <div className="flex min-h-full w-full min-w-0 max-w-full flex-col items-stretch justify-start sm:items-center sm:justify-center">
          <div className="w-full max-w-full min-w-0 sm:max-w-2xl">
          <div
            className="ui-card relative z-10 box-border flex min-h-0 w-full max-w-full min-w-0 flex-col overflow-hidden !p-0 shadow-xl"
            style={{
              maxHeight: "min(90vh, 720px)",
            }}
          >
            <div className="flex shrink-0 items-start justify-between gap-3 border-b border-slate-200/80 px-4 py-4 sm:px-5 dark:border-slate-700">
              <div className="min-w-0 flex-1 pr-2">
              <h2 id="school-admins-title" className="ui-section-title">
                Akun administrator
              </h2>
              <p className="mt-1 break-words text-sm text-slate-600 dark:text-slate-400">{schoolName}</p>
              <p className="mt-1 text-[12px] leading-relaxed text-slate-500 dark:text-slate-400">
                Hanya satu administrator aktif per sekolah. Mengaktifkan akun menonaktifkan admin lain di
                sekolah ini.
              </p>
              </div>
              <button
              type="button"
              className="shrink-0 rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
              onClick={onClose}
              aria-label="Tutup"
            >
              <X className="size-5" />
              </button>
            </div>

            <div className="min-h-0 min-w-0 flex-1 overflow-x-hidden overflow-y-auto overscroll-contain px-4 py-4 sm:px-5">
            {msg ? (
              <p role="status" className="ui-alert ui-alert-info mb-4 min-w-0 break-words text-sm">
                {msg}
              </p>
            ) : null}

            {loading ? (
              <p className="ui-muted text-center text-sm py-8">Memuat daftar akun…</p>
            ) : rows.length === 0 ? (
              <p className="ui-muted text-center text-sm py-8">
                Belum ada akun administrator untuk sekolah ini.
              </p>
            ) : (
              <ul className="divide-y divide-slate-200/90 dark:divide-slate-700/80">
                {rows.map((row) => (
                  <li key={row.id} className="flex flex-col gap-3 py-4 first:pt-0 last:pb-0 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0 space-y-1">
                      <p className="break-words font-semibold text-slate-900 dark:text-white">
                        {row.name?.trim() || "—"}
                      </p>
                      <p className="break-all text-sm text-slate-600 dark:text-slate-400">{row.email}</p>
                      <div className="flex flex-wrap gap-2 pt-1">
                        <span
                          className={`inline-block rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${
                            row.isActive
                              ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-300"
                              : "bg-slate-200 text-slate-700 dark:bg-slate-600/40 dark:text-slate-300"
                          }`}
                        >
                          {row.isActive ? "Aktif" : "Nonaktif"}
                        </span>
                        <span className="inline-block rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-400">
                          {row.hasPassword ? "Login sandi" : "OAuth / tanpa sandi"}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500">
                        Terdaftar:{" "}
                        {new Date(row.createdAt).toLocaleString("id-ID", {
                          dateStyle: "medium",
                          timeStyle: "short",
                        })}
                      </p>
                    </div>
                    <div className="flex w-full min-w-0 max-w-full flex-col gap-2 sm:w-auto sm:shrink-0 sm:flex-row sm:flex-wrap">
                      <button
                        type="button"
                        disabled={busy}
                        className="ui-btn ui-btn-ghost ui-btn-sm flex w-full min-w-0 max-w-full shrink items-center justify-center sm:inline-flex sm:w-auto"
                        onClick={() => void toggleActive(row)}
                      >
                        {row.isActive ? "Nonaktifkan" : "Aktifkan"}
                      </button>
                      <button
                        type="button"
                        disabled={busy}
                        className="ui-btn ui-btn-ghost ui-btn-sm flex w-full min-w-0 max-w-full shrink items-center justify-center gap-1 sm:inline-flex sm:w-auto"
                        onClick={() => openPassword(row)}
                      >
                        <KeyRound className="size-3.5 shrink-0" aria-hidden />
                        Ubah sandi
                      </button>
                      <button
                        type="button"
                        disabled={busy}
                        className="ui-btn ui-btn-sm flex w-full min-w-0 max-w-full shrink items-center justify-center gap-1 bg-red-600 text-white hover:bg-red-700 sm:inline-flex sm:w-auto"
                        onClick={() => setDeleteTarget(row)}
                      >
                        <Trash2 className="size-3.5 shrink-0" aria-hidden />
                        Hapus
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
            </div>

            <div className="shrink-0 border-t border-slate-200/80 px-4 py-3 sm:px-5 dark:border-slate-700">
              <button
                type="button"
                className="ui-btn ui-btn-ghost flex w-full min-w-0 max-w-full justify-center sm:inline-flex sm:w-auto"
                onClick={onClose}
              >
                Tutup
              </button>
            </div>
          </div>
          </div>
        </div>
      </div>

      {deleteTarget ? (
        <div
          className="fixed inset-0 z-[60] flex min-h-full items-center justify-center overflow-x-hidden overflow-y-auto overscroll-contain bg-slate-900/60 px-3 py-4 pl-[max(0.75rem,env(safe-area-inset-left))] pr-[max(0.75rem,env(safe-area-inset-right))] sm:px-4 sm:py-8"
          role="dialog"
          aria-modal="true"
        >
          <div className="ui-card relative z-[61] my-auto w-full max-w-full min-w-0 space-y-4 shadow-xl sm:max-w-md">
            <h3 className="ui-section-title text-red-700 dark:text-red-400">Hapus akun administrator?</h3>
            <p className="break-words text-sm text-slate-600 dark:text-slate-400">
              Akun <strong className="break-all font-semibold">{deleteTarget.email}</strong> akan dihapus
              permanen beserta sesi login. Tindakan ini tidak dapat dibatalkan.
            </p>
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button
                type="button"
                disabled={busy}
                className="ui-btn ui-btn-ghost flex w-full min-w-0 justify-center sm:inline-flex sm:w-auto"
                onClick={() => setDeleteTarget(null)}
              >
                Batal
              </button>
              <button
                type="button"
                disabled={busy}
                className="ui-btn flex w-full min-w-0 justify-center bg-red-600 text-white hover:bg-red-700 sm:inline-flex sm:w-auto"
                onClick={() => void confirmDelete()}
              >
                {busy ? "Menghapus…" : "Ya, hapus"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {passwordTarget ? (
        <div
          className="fixed inset-0 z-[60] flex min-h-full items-center justify-center overflow-x-hidden overflow-y-auto overscroll-contain bg-slate-900/60 px-3 py-4 pl-[max(0.75rem,env(safe-area-inset-left))] pr-[max(0.75rem,env(safe-area-inset-right))] sm:px-4 sm:py-8"
          role="dialog"
          aria-modal="true"
        >
          <div className="ui-card relative z-[61] my-auto w-full max-w-full min-w-0 space-y-4 shadow-xl sm:max-w-md">
            <h3 className="ui-section-title">Ubah sandi administrator</h3>
            <p className="break-words text-sm text-slate-600 dark:text-slate-400">
              {passwordTarget.name || passwordTarget.email} — sandi lama tidak diperlukan.
            </p>
            <label className="ui-label block">
              Sandi baru
              <PasswordInput
                className="relative mt-1.5"
                inputClassName="ui-input w-full pr-11"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                autoComplete="new-password"
                minLength={8}
              />
            </label>
            <label className="ui-label block">
              Konfirmasi sandi
              <PasswordInput
                className="relative mt-1.5"
                inputClassName="ui-input w-full pr-11"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                autoComplete="new-password"
              />
            </label>
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button
                type="button"
                disabled={busy}
                className="ui-btn ui-btn-ghost flex w-full min-w-0 justify-center sm:inline-flex sm:w-auto"
                onClick={() => setPasswordTarget(null)}
              >
                Batal
              </button>
              <button
                type="button"
                disabled={busy}
                className="ui-btn ui-btn-primary flex w-full min-w-0 justify-center sm:inline-flex sm:w-auto"
                onClick={() => void confirmPasswordChange()}
              >
                {busy ? "Menyimpan…" : "Simpan sandi"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>,
    document.body,
  );
}
