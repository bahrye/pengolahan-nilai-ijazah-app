import type { SchoolAccessSnapshot } from "@/lib/subscription/types";

const MS_PER_SECOND = 1000;
const SEC_PER_MINUTE = 60;
const SEC_PER_HOUR = 60 * SEC_PER_MINUTE;
const SEC_PER_DAY = 24 * SEC_PER_HOUR;

/** Satuan terbesar yang masih bermakna untuk hitung mundur menu Langganan. */
export function formatSisaRemaining(remainingMs: number): string | null {
  if (remainingMs <= 0) return null;

  const totalSec = Math.max(1, Math.ceil(remainingMs / MS_PER_SECOND));

  if (totalSec >= SEC_PER_DAY) {
    const days = Math.ceil(totalSec / SEC_PER_DAY);
    return `sisa: ${days} hari`;
  }
  if (totalSec >= SEC_PER_HOUR) {
    const hours = Math.ceil(totalSec / SEC_PER_HOUR);
    return `sisa: ${hours} jam`;
  }
  if (totalSec >= SEC_PER_MINUTE) {
    const minutes = Math.ceil(totalSec / SEC_PER_MINUTE);
    return `sisa: ${minutes} menit`;
  }
  return `sisa: ${totalSec} detik`;
}

export type LanggananSidebarLabelOptions = {
  /** Sisa detik kuota harian (mode FREE_LIMITED); dari SubscriptionUsageProvider. */
  remainingSecondsDaily?: number;
  nowMs?: number;
};

export function buildLanggananSidebarLabel(
  access: SchoolAccessSnapshot | null | undefined,
  opts?: LanggananSidebarLabelOptions,
): string {
  const base = "Langganan";
  if (!access) return base;

  const now = opts?.nowMs ?? Date.now();
  let remainingMs: number | null = null;

  if (access.isSubscribed && access.subscriptionEndsAt) {
    remainingMs = new Date(access.subscriptionEndsAt).getTime() - now;
  } else if (access.isPremiumTrialActive && access.premiumTrialEndsAt) {
    remainingMs = new Date(access.premiumTrialEndsAt).getTime() - now;
  } else if (access.mode === "FREE_TRIAL") {
    remainingMs = new Date(access.trialEndsAt).getTime() - now;
  } else if (access.mode === "FREE_LIMITED") {
    const sec =
      opts?.remainingSecondsDaily ?? access.freeSecondsRemainingToday;
    if (sec > 0) remainingMs = sec * MS_PER_SECOND;
  }

  const sisa =
    remainingMs != null ? formatSisaRemaining(remainingMs) : null;
  return sisa ? `${base} - ${sisa}` : base;
}
