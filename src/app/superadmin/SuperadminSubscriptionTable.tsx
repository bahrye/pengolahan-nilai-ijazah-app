"use client";

import { useCallback, useEffect, useState } from "react";
import { Eye, Trash2, X } from "lucide-react";

import { SUBSCRIPTION_PACKAGES } from "@/lib/subscription/constants";
import {
  deleteSubscriptionPaymentAction,
  listSubscriptionPaymentsTableAction,
} from "@/server/actions/superadmin-subscription";

type Row = Awaited<ReturnType<typeof listSubscriptionPaymentsTableAction>>[number];

function packageLabel(pkg: string) {
  return SUBSCRIPTION_PACKAGES.find((p) => p.package === pkg)?.label ?? pkg;
}

function statusBadge(status: string) {
  if (status === "APPROVED") {
    return "bg-emerald-100 text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-300";
  }
  if (status === "REJECTED") {
    return "bg-red-100 text-red-800 dark:bg-red-500/20 dark:text-red-300";
  }
  return "bg-amber-100 text-amber-800 dark:bg-amber-500/20 dark:text-amber-300";
}

export function SuperadminSubscriptionTable() {
  const [rows, setRows] = useState<Row[]>([]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Row | null>(null);

  const reload = useCallback(async () => {
    const list = await listSubscriptionPaymentsTableAction();
    setRows(list);
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  async function confirmDelete() {
    if (!deleteTarget) return;
    setBusy(true);
    setMsg(null);
    const r = await deleteSubscriptionPaymentAction(deleteTarget.id);
    setBusy(false);
    setDeleteTarget(null);
    if (!r.ok) {
      setMsg(r.message);
      return;
    }
    setMsg("Data langganan dan berkas bukti dihapus.");
    await reload();
  }

  return (
    <div className="space-y-4">
      {msg ? <p className="ui-alert ui-alert-info text-sm">{msg}</p> : null}

      <div className="ui-table-shell min-w-0 overflow-x-auto subtle-scrollbar">
        <table className="rekap-table w-full min-w-[56rem] text-sm">
          <thead>
            <tr>
              <th className="text-left">Sekolah</th>
              <th className="text-left">Paket</th>
              <th className="text-left">Status</th>
              <th className="text-left">Kuota / Langganan</th>
              <th className="text-left">Tanggal</th>
              <th className="text-left">Aksi</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-slate-500">
                  Belum ada data langganan.
                </td>
              </tr>
            ) : (
              rows.map((r) => (
                <tr key={r.id}>
                  <td className="align-top">
                    <div className="font-semibold text-slate-800 dark:text-slate-100">
                      {r.schoolName}
                    </div>
                    <div className="text-xs text-slate-500">NPSN: {r.npsn ?? "—"}</div>
                    {r.rejectNote ? (
                      <div className="mt-1 text-xs text-red-600 dark:text-red-400">
                        Alasan tolak: {r.rejectNote}
                      </div>
                    ) : null}
                  </td>
                  <td className="align-top">
                    <div>{packageLabel(r.package)}</div>
                    <div className="text-xs text-slate-500">
                      Rp {r.amountRp.toLocaleString("id-ID")} · {r.transferVia}
                    </div>
                  </td>
                  <td className="align-top">
                    <span
                      className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold ${statusBadge(r.status)}`}
                    >
                      {r.status}
                    </span>
                  </td>
                  <td className="align-top text-xs text-slate-600 dark:text-slate-400">
                    <div>Kuota: {r.studentQuotaAllowance}</div>
                    <div>Terpakai: {r.studentAddsUsed}</div>
                    <div>
                      Aktif s/d:{" "}
                      {r.subscriptionEndsAt
                        ? new Date(r.subscriptionEndsAt).toLocaleDateString("id-ID")
                        : "—"}
                    </div>
                  </td>
                  <td className="align-top text-xs text-slate-600 dark:text-slate-400">
                    <div>
                      Ajuan:{" "}
                      {new Date(r.createdAt).toLocaleString("id-ID", {
                        dateStyle: "short",
                        timeStyle: "short",
                      })}
                    </div>
                    {r.reviewedAt ? (
                      <div>
                        Review:{" "}
                        {new Date(r.reviewedAt).toLocaleString("id-ID", {
                          dateStyle: "short",
                          timeStyle: "short",
                        })}
                      </div>
                    ) : null}
                  </td>
                  <td className="align-top">
                    <div className="flex flex-wrap gap-1.5">
                      <button
                        type="button"
                        className="ui-btn ui-btn-ghost ui-btn-sm inline-flex items-center gap-1"
                        onClick={() => setPreviewUrl(r.proofUrl)}
                      >
                        <Eye className="size-3.5" aria-hidden />
                        Preview
                      </button>
                      <button
                        type="button"
                        disabled={busy}
                        className="ui-btn ui-btn-sm inline-flex items-center gap-1 bg-red-600 text-white hover:bg-red-700"
                        onClick={() => setDeleteTarget(r)}
                      >
                        <Trash2 className="size-3.5" aria-hidden />
                        Hapus
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {previewUrl ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/70 p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Preview bukti pembayaran"
        >
          <div className="ui-card relative max-h-[90vh] w-full max-w-2xl overflow-hidden p-0">
            <button
              type="button"
              className="absolute right-3 top-3 z-10 rounded-full bg-slate-900/60 p-1.5 text-white hover:bg-slate-900"
              onClick={() => setPreviewUrl(null)}
              aria-label="Tutup"
            >
              <X className="size-5" />
            </button>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={previewUrl}
              alt="Bukti pembayaran"
              className="max-h-[85vh] w-full object-contain"
            />
          </div>
        </div>
      ) : null}

      {deleteTarget ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="ui-card w-full max-w-md space-y-4">
            <h3 className="ui-section-title text-red-700 dark:text-red-400">
              Hapus data langganan?
            </h3>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              Data pembayaran <strong>{packageLabel(deleteTarget.package)}</strong> untuk{" "}
              <strong>{deleteTarget.schoolName}</strong> akan dihapus permanen, termasuk
              foto bukti di Cloudinary
              {deleteTarget.status === "APPROVED"
                ? ", dan segmen langganan terkait (jika ada) akan dibatalkan."
                : "."}
            </p>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                disabled={busy}
                className="ui-btn ui-btn-ghost"
                onClick={() => setDeleteTarget(null)}
              >
                Batal
              </button>
              <button
                type="button"
                disabled={busy}
                className="ui-btn bg-red-600 text-white hover:bg-red-700"
                onClick={() => void confirmDelete()}
              >
                {busy ? "Menghapus…" : "Ya, hapus"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
