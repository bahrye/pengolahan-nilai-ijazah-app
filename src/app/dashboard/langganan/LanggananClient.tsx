"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Crown, Lock, Sparkles, X } from "lucide-react";

import { useToast } from "@/components/ToastProvider";
import { CopyPaymentNumberButton } from "@/components/subscription/CopyPaymentNumberButton";
import { SubscriptionBenefitsSection } from "@/components/subscription/SubscriptionBenefitsSection";
import {
  BANK_PROVIDERS,
  EWALLET_PROVIDERS,
  FREE_STUDENT_ADD_QUOTA,
  PAYMENT_DESTINATIONS,
  PREMIUM_TRIAL_DAYS,
} from "@/lib/subscription/constants";
import { PREMIUM_MENU_FEATURE_LABELS } from "@/lib/subscription/premium-benefits";
import { studentQuotaBreakdownText, studentQuotaLabelForLimit } from "@/lib/subscription/student-quota";
import {
  getLanggananPageDataAction,
  startPremiumTrialAction,
  submitSubscriptionPaymentAction,
  type LanggananPageData,
} from "@/server/actions/subscription";

import type { SubscriptionPlanPackage } from "@prisma/client";

function formatRp(n: number) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(n);
}

function formatDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export function LanggananClient({ initial }: { initial: LanggananPageData }) {
  const router = useRouter();
  const { toast } = useToast();
  const [data, setData] = useState(initial);
  const [selectedPackage, setSelectedPackage] =
    useState<SubscriptionPlanPackage | null>(null);
  const [payerCategory, setPayerCategory] = useState<"EWALLET" | "BANK">("EWALLET");
  const [payerProvider, setPayerProvider] = useState<string>(EWALLET_PROVIDERS[0]);
  const [transferVia, setTransferVia] = useState<"SHOPEEPAY" | "SEABANK">("SHOPEEPAY");
  const [proofFile, setProofFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [trialModalOpen, setTrialModalOpen] = useState(false);
  const [trialBusy, setTrialBusy] = useState(false);

  const providers = payerCategory === "EWALLET" ? EWALLET_PROVIDERS : BANK_PROVIDERS;

  async function refresh() {
    const res = await getLanggananPageDataAction();
    if (res.ok) setData(res.data);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedPackage) {
      toast("Pilih paket langganan terlebih dahulu.", "error");
      return;
    }
    if (!proofFile) {
      toast("Unggah bukti pembayaran.", "error");
      return;
    }
    setBusy(true);
    const fd = new FormData();
    fd.set("package", selectedPackage);
    fd.set("payerCategory", payerCategory);
    fd.set("payerProvider", payerProvider);
    fd.set("transferVia", transferVia);
    fd.set("proof", proofFile);
    const res = await submitSubscriptionPaymentAction(fd);
    setBusy(false);
    if (!res.ok) {
      toast(res.message, "error");
      return;
    }
    toast("Pengajuan pembayaran terkirim. Menunggu verifikasi.", "success");
    setSelectedPackage(null);
    setProofFile(null);
    await refresh();
    router.refresh();
  }

  async function handleStartPremiumTrial() {
    setTrialBusy(true);
    const res = await startPremiumTrialAction();
    setTrialBusy(false);
    if (!res.ok) {
      toast(res.message, "error");
      return;
    }
    toast("Trial premium 3 hari aktif. Semua menu premium terbuka.", "success");
    setTrialModalOpen(false);
    await refresh();
    router.refresh();
  }

  const { access } = data;

  return (
    <div className="space-y-8">
      <div className="max-w-3xl space-y-2">
        <h1 className="ui-page-title flex items-center gap-2">
          <Crown className="size-7 text-amber-500" aria-hidden />
          Langganan
        </h1>
        <p className="ui-muted text-pretty">
          Berlangganan untuk membuka semua menu, login guru &amp; siswa, kartu login siswa,
          dan menaikkan kuota penambahan siswa sesuai paket.
        </p>
      </div>

      <section className="ui-card space-y-3">
        <h2 className="ui-section-title">Status langganan</h2>
        {access.isSubscribed ? (
          <div className="space-y-1 text-sm text-emerald-700 dark:text-emerald-400">
            <p>
              Aktif sampai <strong>{formatDate(access.subscriptionEndsAt)}</strong>.
              Semua fitur premium terbuka.
            </p>
            <p>
              Kuota penambahan siswa:{" "}
              {access.studentQuotaUnlimited ? (
                <strong>tidak dibatasi (paket 9 bulan aktif)</strong>
              ) : (
                <>
                  sisa <strong>{access.studentAddsRemaining}</strong> dari batas kumulatif{" "}
                  <strong>{access.studentQuotaAllowance}</strong> siswa (
                  {access.studentAddsUsed} terpakai)
                </>
              )}
              .
            </p>
            <p className="text-xs text-emerald-800/90 dark:text-emerald-300/90">
              Anda dapat berlangganan lagi: kuota paket 3/6 bulan ditambahkan dan masa aktif diperpanjang.
              Paket 9 bulan diutamakan (unlimited dulu); paket 3/6 mengantri setelah segmen 9 bulan.
              Membeli 9 bulan saat masih ada paket 3/6 aktif akan menjalankan unlimited terlebih dahulu,
              lalu sisa masa paket 3/6 dilanjutkan setelahnya.
            </p>
          </div>
        ) : access.isPremiumTrialActive ? (
          <p className="text-sm text-violet-800 dark:text-violet-200">
            Trial premium aktif sampai{" "}
            <strong>{formatDate(access.premiumTrialEndsAt)}</strong>. Semua menu premium
            terbuka (sekali per sekolah).
          </p>
        ) : access.mode === "FREE_TRIAL" ? (
          <p className="text-sm text-slate-700 dark:text-slate-300">
            Masa akses gratis penuh: <strong>{access.trialDaysLeft} hari</strong> tersisa
            (berakhir {formatDate(access.trialEndsAt)}). Menu terbatas; login guru/siswa
            memerlukan langganan aktif.
          </p>
        ) : access.mode === "FREE_EXHAUSTED" ? (
          <p className="text-sm text-amber-800 dark:text-amber-300">
            Batas harian 3 jam untuk hari ini sudah habis. Kembali besok atau berlangganan untuk akses
            tanpa batas.
          </p>
        ) : (
          <div className="space-y-2 text-sm text-slate-700 dark:text-slate-300">
            <p>
              Langganan berbayar telah berakhir. Paket gratis: sisa waktu hari ini{" "}
              <strong>
                {Math.floor(access.freeSecondsRemainingToday / 60)} menit
              </strong>
              . Batas penambahan siswa kembali ke{" "}
              <strong>{FREE_STUDENT_ADD_QUOTA}</strong> (kumulatif terpakai:{" "}
              <strong>{access.studentAddsUsed}</strong>
              {access.studentAddsUsed > FREE_STUDENT_ADD_QUOTA
                ? " — melebihi kuota gratis, tidak bisa menambah siswa baru"
                : `, sisa ${access.studentAddsRemaining}`}
              ).
            </p>
            <p className="text-xs text-slate-600 dark:text-slate-400">
              Data siswa yang sudah ada (mis. 250 siswa) <strong>tidak dihapus</strong> dan tetap
              bisa dikelola. Kuota berbayar tersimpan (
              {access.studentQuotaAllowance} siswa) dan aktif lagi setelah langganan diperpanjang;
              penghitung kuota terpakai tidak direset.
            </p>
          </div>
        )}
        {!access.isSubscribed && access.canStartPremiumTrial ? (
          <button
            type="button"
            onClick={() => setTrialModalOpen(true)}
            className="ui-btn inline-flex items-center gap-2 border border-violet-300 bg-gradient-to-r from-violet-600 to-indigo-600 text-white shadow-md hover:brightness-105"
          >
            <Sparkles className="size-4" aria-hidden />
            Coba Premium {PREMIUM_TRIAL_DAYS} Hari
          </button>
        ) : null}
        {data.pendingPayment ? (
          <p className="ui-alert ui-alert-info text-sm">
            Pengajuan paket{" "}
            <strong>
              {data.packages.find((p) => p.package === data.pendingPayment?.package)?.label}
            </strong>{" "}
            menunggu verifikasi superadmin.
          </p>
        ) : null}
        {data.rejectedPayment ? (
          <div className="ui-alert border-red-200 bg-red-50 text-sm text-red-800 dark:border-red-500/30 dark:bg-red-950/40 dark:text-red-200">
            <p className="font-semibold">Pengajuan langganan terakhir ditolak</p>
            <p className="mt-1">
              Paket:{" "}
              <strong>
                {data.packages.find((p) => p.package === data.rejectedPayment?.package)?.label}
              </strong>
              {data.rejectedPayment.reviewedAt ? (
                <>
                  {" "}
                  ·{" "}
                  {new Date(data.rejectedPayment.reviewedAt).toLocaleString("id-ID", {
                    dateStyle: "medium",
                    timeStyle: "short",
                  })}
                </>
              ) : null}
            </p>
            {data.rejectedPayment.rejectNote ? (
              <p className="mt-2">
                <span className="font-medium">Alasan:</span> {data.rejectedPayment.rejectNote}
              </p>
            ) : (
              <p className="mt-2 text-red-700/90 dark:text-red-300/90">
                Tidak ada catatan alasan dari superadmin.
              </p>
            )}
          </div>
        ) : null}
      </section>

      <SubscriptionBenefitsSection schoolJenjang={initial.schoolJenjang} />

      {!data.pendingPayment ? (
        <>
          <section className="ui-card space-y-4">
            <h2 className="ui-section-title">
              {access.isSubscribed ? "Tambah / perpanjang langganan" : "Pilih paket"}
            </h2>
            <div className="grid gap-3 sm:grid-cols-3">
              {data.packages.map((pkg) => {
                const selected = selectedPackage === pkg.package;
                return (
                  <button
                    key={pkg.package}
                    type="button"
                    onClick={() => setSelectedPackage(pkg.package)}
                    className={`rounded-2xl border p-4 text-left transition ${
                      selected
                        ? "border-indigo-500 bg-indigo-50 ring-2 ring-indigo-400 dark:bg-indigo-950/40"
                        : "border-slate-200 bg-white hover:border-indigo-300 dark:border-slate-600 dark:bg-slate-900/50"
                    }`}
                  >
                    <div className="font-bold text-slate-900 dark:text-white">{pkg.label}</div>
                    <div className="mt-1 text-lg font-semibold text-indigo-600 dark:text-indigo-400">
                      {formatRp(pkg.priceRp)}
                    </div>
                    <p className="mt-2 text-xs leading-relaxed text-slate-600 dark:text-slate-400">
                      {studentQuotaBreakdownText(pkg.package)}
                    </p>
                  </button>
                );
              })}
            </div>
          </section>

          <section className="ui-card space-y-4">
            <h2 className="ui-section-title">Transfer ke</h2>
            <div className="grid gap-3 sm:grid-cols-2">
              <label
                className={`cursor-pointer rounded-xl border p-4 ${
                  transferVia === "SHOPEEPAY"
                    ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-950/30"
                    : "border-slate-200 dark:border-slate-600"
                }`}
              >
                <input
                  type="radio"
                  name="transferVia"
                  className="sr-only"
                  checked={transferVia === "SHOPEEPAY"}
                  onChange={() => setTransferVia("SHOPEEPAY")}
                />
                <div className="font-semibold">{PAYMENT_DESTINATIONS.shopeepay.label}</div>
                <div className="mt-1 flex flex-wrap items-center gap-2">
                  <p className="font-mono text-sm font-medium">{PAYMENT_DESTINATIONS.shopeepay.number}</p>
                  <CopyPaymentNumberButton value={PAYMENT_DESTINATIONS.shopeepay.number} />
                </div>
                <p className="text-xs text-slate-500">a.n. {PAYMENT_DESTINATIONS.shopeepay.holder}</p>
              </label>
              <label
                className={`cursor-pointer rounded-xl border p-4 ${
                  transferVia === "SEABANK"
                    ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-950/30"
                    : "border-slate-200 dark:border-slate-600"
                }`}
              >
                <input
                  type="radio"
                  name="transferVia"
                  className="sr-only"
                  checked={transferVia === "SEABANK"}
                  onChange={() => setTransferVia("SEABANK")}
                />
                <div className="font-semibold">{PAYMENT_DESTINATIONS.seabank.label}</div>
                <div className="mt-1 flex flex-wrap items-center gap-2">
                  <p className="font-mono text-sm font-medium">{PAYMENT_DESTINATIONS.seabank.number}</p>
                  <CopyPaymentNumberButton value={PAYMENT_DESTINATIONS.seabank.number} />
                </div>
                <p className="text-xs text-slate-500">a.n. {PAYMENT_DESTINATIONS.seabank.holder}</p>
              </label>
            </div>
          </section>

          {selectedPackage ? (
            <section className="ui-card space-y-4">
              <h2 className="ui-section-title flex items-center gap-2">
                <Lock className="size-4" aria-hidden />
                Konfirmasi pembayaran
              </h2>
              <form onSubmit={(e) => void handleSubmit(e)} className="grid max-w-xl gap-4">
                <label className="ui-label">
                  Nama sekolah
                  <input className="ui-input mt-1.5 bg-slate-100 dark:bg-slate-800" readOnly value={data.schoolName} />
                </label>
                <label className="ui-label">
                  NPSN
                  <input
                    className="ui-input mt-1.5 bg-slate-100 dark:bg-slate-800"
                    readOnly
                    value={data.npsn ?? "—"}
                  />
                </label>
                <fieldset className="space-y-2">
                  <legend className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                    Metode pembayaran Anda
                  </legend>
                  <div className="flex flex-wrap gap-3">
                    {(["EWALLET", "BANK"] as const).map((cat) => (
                      <label key={cat} className="flex cursor-pointer items-center gap-2 text-sm">
                        <input
                          type="radio"
                          name="payerCategory"
                          checked={payerCategory === cat}
                          onChange={() => {
                            setPayerCategory(cat);
                            setPayerProvider(
                              cat === "EWALLET" ? EWALLET_PROVIDERS[0] : BANK_PROVIDERS[0],
                            );
                          }}
                        />
                        {cat === "EWALLET" ? "E-wallet" : "Bank"}
                      </label>
                    ))}
                  </div>
                </fieldset>
                <label className="ui-label">
                  Provider
                  <select
                    className="ui-select mt-1.5"
                    value={payerProvider}
                    onChange={(e) => setPayerProvider(e.target.value)}
                  >
                    {providers.map((p) => (
                      <option key={p} value={p}>
                        {p}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="ui-label">
                  Bukti pembayaran (foto)
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    className="ui-input mt-1.5"
                    onChange={(e) => setProofFile(e.target.files?.[0] ?? null)}
                  />
                </label>
                <button type="submit" disabled={busy} className="ui-btn ui-btn-primary w-full sm:w-auto">
                  Kirim bukti pembayaran
                </button>
              </form>
            </section>
          ) : null}
        </>
      ) : null}

      {trialModalOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/55 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-labelledby="premium-trial-title"
        >
          <div className="relative max-h-[min(90dvh,640px)] w-full max-w-lg overflow-y-auto rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-slate-600 dark:bg-slate-900">
            <button
              type="button"
              onClick={() => setTrialModalOpen(false)}
              className="absolute right-3 top-3 rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
              aria-label="Tutup"
            >
              <X className="size-5" />
            </button>
            <div className="flex items-center gap-2 text-violet-700 dark:text-violet-300">
              <Sparkles className="size-6 text-amber-500" aria-hidden />
              <h2 id="premium-trial-title" className="text-lg font-bold text-slate-900 dark:text-white">
                Coba Premium {PREMIUM_TRIAL_DAYS} Hari — Gratis
              </h2>
            </div>
            <p className="mt-3 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
              Aktifkan trial sekali untuk sekolah Anda. Selama {PREMIUM_TRIAL_DAYS} hari, semua menu
              premium berikut terbuka tanpa biaya (setelah itu kembali ke paket gratis atau berlangganan).
            </p>
            <ul className="mt-4 max-h-48 space-y-1.5 overflow-y-auto rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700 dark:border-slate-600 dark:bg-slate-800/60 dark:text-slate-200">
              {PREMIUM_MENU_FEATURE_LABELS.map((label) => (
                <li key={label} className="flex gap-2">
                  <span className="text-emerald-600" aria-hidden>
                    ✓
                  </span>
                  {label}
                </li>
              ))}
            </ul>
            <p className="mt-4 text-xs text-slate-500 dark:text-slate-400">
              Trial hanya dapat diaktifkan satu kali per sekolah dan tidak menggantikan langganan
              berbayar jangka panjang.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <button
                type="button"
                disabled={trialBusy}
                onClick={() => void handleStartPremiumTrial()}
                className="ui-btn ui-btn-primary inline-flex items-center gap-2"
              >
                {trialBusy ? "Mengaktifkan…" : `Aktifkan ${PREMIUM_TRIAL_DAYS} hari gratis`}
              </button>
              <button
                type="button"
                onClick={() => setTrialModalOpen(false)}
                className="ui-btn ui-btn-secondary"
              >
                Batal
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
