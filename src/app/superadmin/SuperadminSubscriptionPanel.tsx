"use client";

import { useCallback, useEffect, useState } from "react";
import { X } from "lucide-react";

import { SUBSCRIPTION_PACKAGES } from "@/lib/subscription/constants";
import {
  approveSubscriptionPaymentAction,
  listPendingSubscriptionPaymentsAction,
  rejectSubscriptionPaymentAction,
} from "@/server/actions/superadmin-subscription";

type PendingRow = Awaited<
  ReturnType<typeof listPendingSubscriptionPaymentsAction>
>[number];

function packageLabel(pkg: string) {
  return SUBSCRIPTION_PACKAGES.find((p) => p.package === pkg)?.label ?? pkg;
}

export function SuperadminSubscriptionPanel() {
  const [rows, setRows] = useState<PendingRow[]>([]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [rejectTarget, setRejectTarget] = useState<PendingRow | null>(null);
  const [rejectNote, setRejectNote] = useState("");

  const reload = useCallback(async () => {
    const list = await listPendingSubscriptionPaymentsAction();
    setRows(list);
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  async function approve(id: string) {
    setBusy(true);
    setMsg(null);
    const r = await approveSubscriptionPaymentAction(id);
    setBusy(false);
    if (!r.ok) {
      setMsg(r.message);
      return;
    }
    setMsg("Pembayaran disetujui. Langganan sekolah diperpanjang.");
    await reload();
  }

  function openReject(row: PendingRow) {
    setRejectTarget(row);
    setRejectNote("");
  }

  async function confirmReject() {
    if (!rejectTarget) return;
    setBusy(true);
    setMsg(null);
    const r = await rejectSubscriptionPaymentAction({
      paymentId: rejectTarget.id,
      rejectNote: rejectNote.trim() || undefined,
    });
    setBusy(false);
    if (!r.ok) {
      setMsg(r.message);
      return;
    }
    setRejectTarget(null);
    setRejectNote("");
    setMsg("Pengajuan ditolak. Admin sekolah akan melihat alasan penolakan.");
    await reload();
  }

  if (rows.length === 0) {
    return (
      <p className="text-sm text-slate-600 dark:text-slate-400">
        Tidak ada pengajuan langganan yang menunggu verifikasi.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      {msg ? <p className="ui-alert ui-alert-info text-sm">{msg}</p> : null}
      <div className="space-y-3">
        {rows.map((r) => (
          <article
            key={r.id}
            className="rounded-xl border border-slate-200/90 bg-white/80 p-4 dark:border-slate-600 dark:bg-slate-900/50"
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0 space-y-1 text-sm">
                <p className="font-semibold text-slate-900 dark:text-white">
                  {r.school.namaSekolah ?? r.schoolNameSnapshot}
                </p>
                <p className="text-slate-600 dark:text-slate-400">
                  Paket: <strong>{packageLabel(r.package)}</strong> · Rp{" "}
                  {r.amountRp.toLocaleString("id-ID")} · {r.payerCategory} / {r.payerProvider}{" "}
                  · transfer {r.transferVia}
                </p>
                <p className="text-slate-500">NPSN: {r.npsnSnapshot ?? "—"}</p>
                <a
                  href={r.proofUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-indigo-600 underline dark:text-indigo-400"
                >
                  Lihat bukti pembayaran
                </a>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void approve(r.id)}
                  className="ui-btn bg-emerald-600 text-white hover:bg-emerald-700"
                >
                  Setujui
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => openReject(r)}
                  className="ui-btn bg-amber-500 text-white hover:bg-amber-600"
                >
                  Tolak
                </button>
              </div>
            </div>
          </article>
        ))}
      </div>

      {rejectTarget ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="reject-modal-title"
        >
          <div className="ui-card w-full max-w-md space-y-4 shadow-xl">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3
                  id="reject-modal-title"
                  className="ui-section-title text-amber-700 dark:text-amber-400"
                >
                  Tolak pengajuan langganan
                </h3>
                <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                  {rejectTarget.school.namaSekolah ?? rejectTarget.schoolNameSnapshot} ·{" "}
                  {packageLabel(rejectTarget.package)}
                </p>
              </div>
              <button
                type="button"
                className="rounded-lg p-1 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
                onClick={() => setRejectTarget(null)}
                aria-label="Tutup"
              >
                <X className="size-5" />
              </button>
            </div>
            <label className="ui-label block">
              Alasan penolakan (ditampilkan ke admin sekolah)
              <textarea
                className="ui-input mt-1.5 min-h-[100px] w-full resize-y"
                value={rejectNote}
                onChange={(e) => setRejectNote(e.target.value)}
                placeholder="Contoh: Bukti transfer tidak jelas / nominal tidak sesuai."
              />
            </label>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                disabled={busy}
                className="ui-btn ui-btn-ghost"
                onClick={() => setRejectTarget(null)}
              >
                Batal
              </button>
              <button
                type="button"
                disabled={busy}
                className="ui-btn bg-amber-500 text-white hover:bg-amber-600"
                onClick={() => void confirmReject()}
              >
                {busy ? "Memproses…" : "Tolak pengajuan"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
