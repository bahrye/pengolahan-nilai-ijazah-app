import type { SubscriptionPlanPackage } from "@prisma/client";

import { FREE_STUDENT_ADD_QUOTA } from "./constants";
import { SUBSCRIPTION_STUDENT_QUOTA_BONUS } from "./student-quota";

export type SubscriptionPeriodLike = {
  id: string;
  package: SubscriptionPlanPackage;
  startsAt: Date;
  endsAt: Date;
};

export function packageMonths(pkg: SubscriptionPlanPackage): number {
  if (pkg === "MONTHS_3") return 3;
  if (pkg === "MONTHS_6") return 6;
  return 9;
}

export function addMonths(date: Date, months: number): Date {
  const out = new Date(date);
  out.setMonth(out.getMonth() + months);
  return out;
}

export function packageQuotaCap(pkg: SubscriptionPlanPackage): number {
  const bonus = SUBSCRIPTION_STUDENT_QUOTA_BONUS[pkg];
  if (bonus === null) return Number.MAX_SAFE_INTEGER;
  return FREE_STUDENT_ADD_QUOTA + bonus;
}

/** Kenaikan batas kuota kumulatif saat paket 3/6 bulan disetujui. */
export function quotaAllowanceIncrement(
  currentAllowance: number,
  pkg: SubscriptionPlanPackage,
): number {
  if (pkg === "MONTHS_9") return 0;
  const cap = packageQuotaCap(pkg);
  if (currentAllowance <= FREE_STUDENT_ADD_QUOTA) {
    return cap - currentAllowance;
  }
  return cap;
}

/** Kebalikan dari increment saat pembayaran dihapus. */
export function quotaAllowanceDecrement(
  currentAllowance: number,
  pkg: SubscriptionPlanPackage,
): number {
  if (pkg === "MONTHS_9") return currentAllowance;
  const cap = packageQuotaCap(pkg);
  if (currentAllowance <= cap) {
    return FREE_STUDENT_ADD_QUOTA;
  }
  return currentAllowance - cap;
}

export function findActivePeriod(
  periods: SubscriptionPeriodLike[],
  now: Date,
): SubscriptionPeriodLike | null {
  const active = periods.filter((p) => p.startsAt <= now && now < p.endsAt);
  const unlimited = active.find((p) => p.package === "MONTHS_9");
  if (unlimited) return unlimited;
  return active[0] ?? null;
}

export function findActiveUnlimitedPeriod(
  periods: SubscriptionPeriodLike[],
  now: Date,
): SubscriptionPeriodLike | null {
  return (
    periods.find(
      (p) =>
        p.package === "MONTHS_9" && p.startsAt <= now && now < p.endsAt,
    ) ?? null
  );
}

export function timelineTailEnd(
  periods: SubscriptionPeriodLike[],
  now: Date = new Date(),
): Date {
  let tail = now;
  for (const p of periods) {
    if (p.endsAt > tail) tail = p.endsAt;
  }
  return tail;
}

export type PeriodShift = {
  periodId: string;
  startsAt: Date;
  endsAt: Date;
};

export type ApplyPaymentPlan =
  | {
      kind: "extend";
      periodId: string;
      newEndsAt: Date;
      allowanceDelta: number;
    }
  | {
      kind: "create";
      package: SubscriptionPlanPackage;
      startsAt: Date;
      endsAt: Date;
      allowanceDelta: number;
    }
  | {
      kind: "create_nine_priority";
      startsAt: Date;
      endsAt: Date;
      shifts: PeriodShift[];
      allowanceDelta: number;
    };

/**
 * Rencanakan penambahan periode saat pembayaran disetujui.
 * - Paket 3/6: antri setelah segmen 9 bulan (aktif atau terjadwal).
 * - Paket 9 bulan: jika masih ada segmen 3/6 aktif/terjadwal, 9 bulan diutamakan dulu lalu 3/6 digeser.
 * - Paket 9 bulan hanya memperpanjang segmen 9 bulan lain (bukan digabung dengan 3/6).
 */
export function planSubscriptionPayment(
  periods: SubscriptionPeriodLike[],
  pkg: SubscriptionPlanPackage,
  now: Date = new Date(),
  currentAllowance: number = FREE_STUDENT_ADD_QUOTA,
): ApplyPaymentPlan {
  const months = packageMonths(pkg);
  const sorted = [...periods].sort(
    (a, b) => a.startsAt.getTime() - b.startsAt.getTime(),
  );

  if (pkg === "MONTHS_9") {
    const activeNine = findActiveUnlimitedPeriod(sorted, now);
    if (activeNine) {
      return {
        kind: "extend",
        periodId: activeNine.id,
        newEndsAt: addMonths(activeNine.endsAt, months),
        allowanceDelta: 0,
      };
    }

    const futureOrPastNine = [...sorted]
      .filter((p) => p.package === "MONTHS_9")
      .sort((a, b) => b.endsAt.getTime() - a.endsAt.getTime())[0];

    if (futureOrPastNine && futureOrPastNine.endsAt > now) {
      return {
        kind: "extend",
        periodId: futureOrPastNine.id,
        newEndsAt: addMonths(futureOrPastNine.endsAt, months),
        allowanceDelta: 0,
      };
    }

    const limitedToShift = sorted
      .filter((p) => p.package !== "MONTHS_9" && p.endsAt > now)
      .sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime());

    const nineStart = now;
    const nineEnd = addMonths(nineStart, months);

    if (limitedToShift.length > 0) {
      let cursor = nineEnd;
      const shifts: PeriodShift[] = limitedToShift.map((p) => {
        const durationMs = p.endsAt.getTime() - p.startsAt.getTime();
        const startsAt = new Date(cursor);
        const endsAt = new Date(startsAt.getTime() + durationMs);
        cursor = endsAt;
        return { periodId: p.id, startsAt, endsAt };
      });
      return {
        kind: "create_nine_priority",
        startsAt: nineStart,
        endsAt: nineEnd,
        shifts,
        allowanceDelta: 0,
      };
    }

    const tail = timelineTailEnd(sorted, now);
    const base = tail > now ? tail : now;
    return {
      kind: "create",
      package: pkg,
      startsAt: base,
      endsAt: addMonths(base, months),
      allowanceDelta: 0,
    };
  }

  const activeNine = findActiveUnlimitedPeriod(sorted, now);
  const startsAt = activeNine
    ? activeNine.endsAt
    : timelineTailEnd(sorted, now) > now
      ? timelineTailEnd(sorted, now)
      : now;

  return {
    kind: "create",
    package: pkg,
    startsAt,
    endsAt: addMonths(startsAt, months),
    allowanceDelta: quotaAllowanceIncrement(currentAllowance, pkg),
  };
}

export function subscriptionEndsAtFromPeriods(
  periods: SubscriptionPeriodLike[],
): Date | null {
  if (periods.length === 0) return null;
  return periods.reduce(
    (max, p) => (p.endsAt > max ? p.endsAt : max),
    periods[0]!.endsAt,
  );
}

export function isSubscribedFromPeriods(
  periods: SubscriptionPeriodLike[],
  now: Date = new Date(),
): boolean {
  return periods.some((p) => p.endsAt > now);
}
