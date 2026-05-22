"use server";

import {
  getSchoolAccessSnapshot,
  touchAdminFreeTierUsage,
} from "@/server/subscription-access";
import { requireTenantAdmin } from "@/server/session";

export async function syncFreeTierUsageAction(): Promise<
  | {
      ok: true;
      remainingSeconds: number;
      mode: string;
      exhausted: boolean;
    }
  | { ok: false }
> {
  try {
    const { schoolId, role } = await requireTenantAdmin();
    if (role !== "ADMIN_SEKOLAH") return { ok: false };

    await touchAdminFreeTierUsage(schoolId);
    const snap = await getSchoolAccessSnapshot(schoolId);

    return {
      ok: true,
      remainingSeconds: snap.freeSecondsRemainingToday,
      mode: snap.mode,
      exhausted:
        snap.mode === "FREE_EXHAUSTED" ||
        snap.freeSecondsRemainingToday <= 0,
    };
  } catch {
    return { ok: false };
  }
}

export async function syncStudentQuotaAction(): Promise<
  | {
      ok: true;
      studentAddsUsed: number;
      studentAddsRemaining: number;
      studentQuotaAllowance: number;
      studentQuotaLimit: number | null;
      studentQuotaUnlimited: boolean;
      isSubscribed: boolean;
    }
  | { ok: false }
> {
  try {
    const { schoolId } = await requireTenantAdmin();
    const snap = await getSchoolAccessSnapshot(schoolId);
    return {
      ok: true,
      studentAddsUsed: snap.studentAddsUsed,
      studentAddsRemaining: snap.studentAddsRemaining,
      studentQuotaAllowance: snap.studentQuotaAllowance,
      studentQuotaLimit: snap.studentQuotaLimit,
      studentQuotaUnlimited: snap.studentQuotaUnlimited,
      isSubscribed: snap.isSubscribed,
    };
  } catch {
    return { ok: false };
  }
}
