"use client";

import { AlertTriangle, Clock, Crown } from "lucide-react";
import Link from "next/link";

import { formatCountdownHms } from "@/lib/subscription/format-time";
import type { SchoolAccessSnapshot } from "@/lib/subscription/types";

import { useSubscriptionUsage } from "./SubscriptionUsageProvider";

const LOW_TIME_WARNING_SECONDS = 30 * 60;
const URGENT_TIME_WARNING_SECONDS = 15 * 60;
const TRIAL_REMINDER_DAYS = 5;

export function SubscriptionAccessBanner({
  access: accessProp,
}: {
  access: SchoolAccessSnapshot;
}) {
  const usage = useSubscriptionUsage();
  const access = usage?.effectiveAccess ?? accessProp;
  const remaining =
    usage?.remainingSeconds ?? access.freeSecondsRemainingToday;

  if (access.isSubscribed) return null;

  if (access.isPremiumTrialActive && access.premiumTrialEndsAt) {
    const ends = new Date(access.premiumTrialEndsAt).toLocaleDateString("id-ID", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
    return (
      <div
        className="ui-alert flex flex-wrap items-start gap-3 border-violet-400/35 bg-violet-50/90 text-violet-950 dark:bg-violet-950/35 dark:text-violet-100"
        role="status"
      >
        <Crown className="mt-0.5 size-5 shrink-0 text-amber-500" aria-hidden />
        <div className="min-w-0 flex-1 space-y-1 text-sm">
          <p className="font-semibold">Trial premium 3 hari aktif</p>
          <p className="text-pretty leading-relaxed opacity-95">
            Semua menu premium terbuka sampai <strong>{ends}</strong>. Setelah itu berlangganan
            untuk melanjutkan.{" "}
            <Link href="/dashboard/langganan" className="font-semibold underline">
              Lihat paket
            </Link>
          </p>
        </div>
      </div>
    );
  }

  if (access.mode === "FREE_EXHAUSTED" || (usage?.isTimeBlocked ?? false)) {
    return (
      <div
        className="ui-alert flex flex-wrap items-start gap-3 border-amber-500/40 bg-amber-50 text-amber-950 dark:bg-amber-950/40 dark:text-amber-100"
        role="status"
        aria-live="polite"
      >
        <AlertTriangle className="mt-0.5 size-5 shrink-0 text-amber-600 dark:text-amber-400" aria-hidden />
        <div className="min-w-0 flex-1 space-y-1 text-sm">
          <p className="font-semibold">Batas waktu harian sudah habis</p>
          <p className="text-pretty leading-relaxed opacity-95">
            Kuota 3 jam untuk hari ini telah habis. Anda hanya dapat membuka halaman Langganan sampai
            kuota direset besok, atau{" "}
            <Link href="/dashboard/langganan" className="font-semibold underline">
              berlangganan
            </Link>{" "}
            untuk akses penuh.
          </p>
        </div>
      </div>
    );
  }

  if (access.mode === "FREE_TRIAL" && access.trialDaysLeft <= TRIAL_REMINDER_DAYS) {
    return (
      <div
        className="ui-alert flex flex-wrap items-start gap-3 border-indigo-400/35 bg-indigo-50/90 text-indigo-950 dark:bg-indigo-950/35 dark:text-indigo-100"
        role="status"
      >
        <Crown className="mt-0.5 size-5 shrink-0 text-amber-500" aria-hidden />
        <div className="min-w-0 flex-1 space-y-1 text-sm">
          <p className="font-semibold">
            Masa akses gratis penuh: {access.trialDaysLeft} hari lagi
          </p>
          <p className="text-pretty leading-relaxed opacity-95">
            Setelah trial, menu premium terkunci dan login guru/siswa memerlukan langganan.{" "}
            <Link href="/dashboard/langganan" className="font-semibold underline">
              Lihat paket langganan
            </Link>
          </p>
        </div>
      </div>
    );
  }

  if (access.mode === "FREE_LIMITED") {
    const countdown = formatCountdownHms(remaining);
    const urgent = remaining <= URGENT_TIME_WARNING_SECONDS;
    const low = remaining <= LOW_TIME_WARNING_SECONDS;

    return (
      <div
        className={`flex flex-wrap items-center gap-3 rounded-xl border px-4 py-3 text-sm ${
          urgent
            ? "border-amber-500/50 bg-amber-50 text-amber-950 dark:bg-amber-950/40 dark:text-amber-100"
            : low
              ? "border-orange-400/40 bg-orange-50/90 text-orange-950 dark:bg-orange-950/30 dark:text-orange-100"
              : "border-slate-200/90 bg-slate-50/90 text-slate-700 dark:border-slate-600 dark:bg-slate-800/50 dark:text-slate-200"
        }`}
        role="status"
        aria-live="polite"
      >
        <Clock
          className={`size-5 shrink-0 ${urgent ? "text-amber-600 dark:text-amber-400" : "text-indigo-500"}`}
          aria-hidden
        />
        <div className="min-w-0 flex-1">
          <p className="font-semibold">
            {urgent ? "Waktu akses hampir habis" : "Sisa waktu akses hari ini"}
          </p>
          <p className="mt-0.5 tabular-nums text-lg font-bold tracking-wide">{countdown}</p>
          <p className="mt-1 text-[12px] opacity-90">
            Setelah 00:00:00, akses dashboard ditutup otomatis hingga besok.{" "}
            <Link href="/dashboard/langganan" className="font-semibold underline">
              Berlangganan
            </Link>
          </p>
        </div>
      </div>
    );
  }

  return null;
}
