import type { SubscriptionPlanPackage } from "@prisma/client";

import { FREE_STUDENT_ADD_QUOTA } from "./constants";

/** Bonus kuota siswa di atas 150 dasar (paket gratis). `null` = tidak dibatasi. */
export const SUBSCRIPTION_STUDENT_QUOTA_BONUS: Record<
  SubscriptionPlanPackage,
  number | null
> = {
  MONTHS_3: 150,
  MONTHS_6: 400,
  MONTHS_9: null,
};

export function packageQuotaTierRank(pkg: SubscriptionPlanPackage): number {
  if (pkg === "MONTHS_9") return 3;
  if (pkg === "MONTHS_6") return 2;
  return 1;
}

export function higherSubscriptionPackage(
  current: SubscriptionPlanPackage | null,
  incoming: SubscriptionPlanPackage,
): SubscriptionPlanPackage {
  if (!current) return incoming;
  return packageQuotaTierRank(incoming) > packageQuotaTierRank(current)
    ? incoming
    : current;
}

/** Batas kumulatif penambahan siswa; `null` = tanpa batas. */
export function totalStudentQuotaLimit(
  isSubscribed: boolean,
  activePackage: SubscriptionPlanPackage | null,
): number | null {
  if (isSubscribed && activePackage) {
    const bonus = SUBSCRIPTION_STUDENT_QUOTA_BONUS[activePackage];
    if (bonus === null) return null;
    return FREE_STUDENT_ADD_QUOTA + bonus;
  }
  return FREE_STUDENT_ADD_QUOTA;
}

export function studentQuotaLabelForLimit(limit: number | null): string {
  if (limit === null) return "Tidak dibatasi";
  return `${limit} siswa`;
}

export function studentQuotaLabelForPackage(pkg: SubscriptionPlanPackage): string {
  const limit = totalStudentQuotaLimit(true, pkg);
  return studentQuotaLabelForLimit(limit);
}

/** Teks kuota paket: "150 dasar + 150 = 300" (bukan "+300"). */
export function studentQuotaBreakdownText(pkg: SubscriptionPlanPackage): string {
  const bonus = SUBSCRIPTION_STUDENT_QUOTA_BONUS[pkg];
  if (bonus === null) {
    return "Kuota tidak dibatasi selama segmen paket ini aktif. Perpanjangan hanya dengan paket 9 bulan lagi.";
  }
  const total = FREE_STUDENT_ADD_QUOTA + bonus;
  const months = pkg === "MONTHS_6" ? 6 : 3;
  return `${FREE_STUDENT_ADD_QUOTA} dasar + ${bonus} = ${total} (kumulatif per pembelian). Masa aktif +${months} bulan.`;
}

export function studentQuotaShortDescription(pkg: SubscriptionPlanPackage): string {
  return studentQuotaBreakdownText(pkg);
}
