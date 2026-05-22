import { FREE_STUDENT_ADD_QUOTA } from "@/lib/subscription/constants";
import {
  findActivePeriod,
  planSubscriptionPayment,
  subscriptionEndsAtFromPeriods,
  type SubscriptionPeriodLike,
} from "@/lib/subscription/periods";
import { prisma } from "@/lib/prisma";

import type { SubscriptionPlanPackage } from "@prisma/client";

export async function loadSchoolSubscriptionPeriods(
  schoolId: string,
): Promise<SubscriptionPeriodLike[]> {
  const rows = await prisma.schoolSubscriptionPeriod.findMany({
    where: { schoolId },
    orderBy: { startsAt: "asc" },
    select: { id: true, package: true, startsAt: true, endsAt: true },
  });
  return rows;
}

export async function applyApprovedSubscriptionPayment(
  schoolId: string,
  paymentId: string,
  pkg: SubscriptionPlanPackage,
): Promise<void> {
  const sub = await prisma.schoolSubscription.upsert({
    where: { schoolId },
    create: { schoolId },
    update: {},
  });

  const periods = await loadSchoolSubscriptionPeriods(schoolId);
  const now = new Date();
  const plan = planSubscriptionPayment(
    periods,
    pkg,
    now,
    sub.studentQuotaAllowance,
  );

  const allowance =
    sub.studentQuotaAllowance + plan.allowanceDelta;

  if (plan.kind === "extend") {
    await prisma.$transaction([
      prisma.schoolSubscriptionPeriod.update({
        where: { id: plan.periodId },
        data: { endsAt: plan.newEndsAt },
      }),
      prisma.schoolSubscription.update({
        where: { schoolId },
        data: {
          activePackage: "MONTHS_9",
          studentQuotaAllowance: allowance,
        },
      }),
    ]);
    await syncSubscriptionEndsAt(schoolId);
    return;
  }

  if (plan.kind === "create_nine_priority") {
    const shiftedPeriods: SubscriptionPeriodLike[] = plan.shifts.map((s) => {
      const orig = periods.find((p) => p.id === s.periodId)!;
      return {
        id: s.periodId,
        package: orig.package,
        startsAt: s.startsAt,
        endsAt: s.endsAt,
      };
    });
    const allEnds = subscriptionEndsAtFromPeriods([
      ...periods.filter((p) => !plan.shifts.some((s) => s.periodId === p.id)),
      ...shiftedPeriods,
      {
        id: "new-nine",
        package: "MONTHS_9",
        startsAt: plan.startsAt,
        endsAt: plan.endsAt,
      },
    ]);

    await prisma.$transaction([
      ...plan.shifts.map((s) =>
        prisma.schoolSubscriptionPeriod.update({
          where: { id: s.periodId },
          data: { startsAt: s.startsAt, endsAt: s.endsAt },
        }),
      ),
      prisma.schoolSubscriptionPeriod.create({
        data: {
          schoolId,
          package: "MONTHS_9",
          startsAt: plan.startsAt,
          endsAt: plan.endsAt,
          paymentId,
        },
      }),
      prisma.schoolSubscription.update({
        where: { schoolId },
        data: {
          subscriptionEndsAt: allEnds,
          activePackage: "MONTHS_9",
          studentQuotaAllowance: allowance,
        },
      }),
    ]);
    await syncSubscriptionEndsAt(schoolId);
    return;
  }

  const allEnds = subscriptionEndsAtFromPeriods([
    ...periods,
    {
      id: "new",
      package: plan.package,
      startsAt: plan.startsAt,
      endsAt: plan.endsAt,
    },
  ]);

  await prisma.$transaction([
    prisma.schoolSubscriptionPeriod.create({
      data: {
        schoolId,
        package: plan.package,
        startsAt: plan.startsAt,
        endsAt: plan.endsAt,
        paymentId,
      },
    }),
    prisma.schoolSubscription.update({
      where: { schoolId },
      data: {
        subscriptionEndsAt: allEnds,
        activePackage: plan.package,
        studentQuotaAllowance: allowance,
      },
    }),
  ]);
}

export async function syncSubscriptionEndsAt(schoolId: string): Promise<void> {
  const periods = await loadSchoolSubscriptionPeriods(schoolId);
  const ends = subscriptionEndsAtFromPeriods(periods);
  const now = new Date();
  const active = findActivePeriod(periods, now);

  await prisma.schoolSubscription.update({
    where: { schoolId },
    data: {
      subscriptionEndsAt: ends,
      activePackage: active?.package ?? null,
    },
  });
}

export function computeQuotaFromSubscription(
  studentAddsUsed: number,
  studentQuotaAllowance: number,
  isSubscribed: boolean,
  activePeriod: SubscriptionPeriodLike | null,
): {
  studentQuotaLimit: number | null;
  studentQuotaUnlimited: boolean;
  studentAddsRemaining: number;
  activeSubscriptionPackage: SubscriptionPlanPackage | null;
} {
  const unlimited =
    isSubscribed && activePeriod?.package === "MONTHS_9";

  if (unlimited) {
    return {
      activeSubscriptionPackage: "MONTHS_9",
      studentQuotaLimit: null,
      studentQuotaUnlimited: true,
      studentAddsRemaining: Number.MAX_SAFE_INTEGER,
    };
  }

  /** Setelah langganan habis: batas penambahan kembali ke paket gratis; kuota berbayar tetap tersimpan di DB untuk langganan berikutnya. */
  const limit = isSubscribed
    ? studentQuotaAllowance
    : FREE_STUDENT_ADD_QUOTA;

  const effectiveRemaining = Math.max(0, limit - studentAddsUsed);

  return {
    activeSubscriptionPackage: isSubscribed
      ? (activePeriod?.package ?? null)
      : null,
    studentQuotaLimit: limit,
    studentQuotaUnlimited: false,
    studentAddsRemaining: effectiveRemaining,
  };
}
