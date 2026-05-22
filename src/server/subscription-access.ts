import { cache } from "react";

import { canAddStudentsWithSnapshot } from "@/lib/subscription/access-rules";
import {
  FREE_DAILY_LIMIT_SECONDS,
  FREE_STUDENT_ADD_QUOTA,
  FREE_TRIAL_DAYS,
  PREMIUM_TRIAL_DAYS,
  SCHOOL_LOGIN_SUBSCRIPTION_BLOCKED_MESSAGE,
} from "@/lib/subscription/constants";
import { hasPremiumMenuAccess } from "@/lib/subscription/premium-access";
import type { SchoolAccessMode, SchoolAccessSnapshot } from "@/lib/subscription/types";
import { findActivePeriod, isSubscribedFromPeriods } from "@/lib/subscription/periods";
import { prisma } from "@/lib/prisma";
import { isSchoolActiveForAccess, SCHOOL_DEACTIVATED_MESSAGE } from "@/lib/school-active";
import {
  computeQuotaFromSubscription,
  loadSchoolSubscriptionPeriods,
} from "@/server/subscription-periods";

export {
  studentQuotaLabelForPackage,
  studentQuotaShortDescription,
} from "@/lib/subscription/student-quota";
export { packageMonths } from "@/lib/subscription/periods";

export type { SchoolAccessMode, SchoolAccessSnapshot } from "@/lib/subscription/types";
export { adminPathAllowedForAccess } from "@/lib/subscription/access-rules";

function startOfUtcDay(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

function utcDateKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function addMonths(date: Date, months: number): Date {
  const out = new Date(date);
  out.setMonth(out.getMonth() + months);
  return out;
}

function isMissingSubscriptionTableError(e: unknown): boolean {
  if (!e || typeof e !== "object") return false;
  const code = "code" in e ? String((e as { code: string }).code) : "";
  return code === "P2021" || code === "P2022";
}

export async function ensureSchoolSubscription(schoolId: string) {
  try {
    return await prisma.schoolSubscription.upsert({
      where: { schoolId },
      create: { schoolId },
      update: {},
    });
  } catch (e) {
    if (!isMissingSubscriptionTableError(e)) throw e;
    return {
      id: `fallback_${schoolId}`,
      schoolId,
      subscriptionEndsAt: null,
      activePackage: null,
      studentQuotaAllowance: FREE_STUDENT_ADD_QUOTA,
      studentAddsUsed: 0,
      freeUsageDate: null,
      freeUsageSeconds: 0,
      lastAccessAt: null,
      premiumTrialUsedAt: null,
      premiumTrialEndsAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  }
}

/** Snapshot trial-only jika tabel langganan belum ada di DB (mis. migrasi belum dijalankan). */
async function buildTrialOnlyAccessSnapshot(
  schoolId: string,
): Promise<SchoolAccessSnapshot> {
  const school = await prisma.school.findUnique({
    where: { id: schoolId },
    select: { createdAt: true, _count: { select: { academicYears: true } } },
  });
  if (!school) throw new Error("Sekolah tidak ditemukan.");

  const now = new Date();
  const trialEndsAt = new Date(school.createdAt);
  trialEndsAt.setUTCDate(trialEndsAt.getUTCDate() + FREE_TRIAL_DAYS);
  const trialMsLeft = trialEndsAt.getTime() - now.getTime();
  const trialDaysLeft = Math.max(0, Math.ceil(trialMsLeft / (24 * 60 * 60 * 1000)));
  const inTrial = now < trialEndsAt;

  const quotaFields = computeQuotaFromSubscription(
    0,
    FREE_STUDENT_ADD_QUOTA,
    false,
    null,
  );
  return {
    mode: inTrial ? "FREE_TRIAL" : "FREE_LIMITED",
    isSubscribed: false,
    isPremiumTrialActive: false,
    premiumTrialEndsAt: null,
    canStartPremiumTrial: false,
    trialEndsAt: trialEndsAt.toISOString(),
    trialDaysLeft,
    subscriptionEndsAt: null,
    studentAddsUsed: 0,
    studentQuotaAllowance: FREE_STUDENT_ADD_QUOTA,
    ...quotaFields,
    freeSecondsUsedToday: 0,
    freeSecondsRemainingToday: FREE_DAILY_LIMIT_SECONDS,
    canAccessDashboard: true,
    canGenerateStudentLoginCards: false,
    canAddAcademicYear: school._count.academicYears < 1,
  };
}

function premiumTrialFields(
  sub: {
    premiumTrialUsedAt?: Date | null;
    premiumTrialEndsAt?: Date | null;
  },
  isSubscribed: boolean,
  now: Date,
) {
  const usedAt = sub.premiumTrialUsedAt ?? null;
  const endsAt = sub.premiumTrialEndsAt ?? null;
  const isPremiumTrialActive =
    !isSubscribed && Boolean(endsAt && endsAt > now);
  const canStartPremiumTrial = !isSubscribed && usedAt == null;
  return {
    isPremiumTrialActive,
    premiumTrialEndsAt: endsAt?.toISOString() ?? null,
    canStartPremiumTrial,
  };
}

/**
 * Muat snapshot langganan; jika tabel belum ada, fallback trial agar dashboard tidak 500.
 */
export async function getSchoolAccessSnapshotSafe(
  schoolId: string,
  loader: () => Promise<SchoolAccessSnapshot>,
): Promise<SchoolAccessSnapshot> {
  try {
    return await loader();
  } catch (e) {
    if (!isMissingSubscriptionTableError(e)) throw e;
    return buildTrialOnlyAccessSnapshot(schoolId);
  }
}

export const getSchoolAccessSnapshot = cache(
  async (schoolId: string): Promise<SchoolAccessSnapshot> => {
    let school: {
      createdAt: Date;
      subscription: Awaited<ReturnType<typeof ensureSchoolSubscription>> | null;
      _count: { academicYears: number };
    } | null;

    try {
      school = await prisma.school.findUnique({
        where: { id: schoolId },
        select: {
          createdAt: true,
          subscription: true,
          _count: { select: { academicYears: true } },
        },
      });
    } catch (e) {
      if (!isMissingSubscriptionTableError(e)) throw e;
      return buildTrialOnlyAccessSnapshot(schoolId);
    }
    if (!school) {
      throw new Error("Sekolah tidak ditemukan.");
    }

    const sub =
      school.subscription ?? (await ensureSchoolSubscription(schoolId));

    const now = new Date();
    const trialEndsAt = new Date(school.createdAt);
    trialEndsAt.setUTCDate(trialEndsAt.getUTCDate() + FREE_TRIAL_DAYS);

    const periods = await loadSchoolSubscriptionPeriods(schoolId);
    const isSubscribed =
      isSubscribedFromPeriods(periods, now) ||
      Boolean(sub.subscriptionEndsAt && sub.subscriptionEndsAt > now);
    const activePeriod = findActivePeriod(periods, now);

    let mode: SchoolAccessMode;
    if (isSubscribed) {
      mode = "SUBSCRIBED";
    } else if (now < trialEndsAt) {
      mode = "FREE_TRIAL";
    } else {
      const todayKey = utcDateKey(now);
      const usedToday =
        sub.freeUsageDate === todayKey ? sub.freeUsageSeconds : 0;
      mode =
        usedToday >= FREE_DAILY_LIMIT_SECONDS ? "FREE_EXHAUSTED" : "FREE_LIMITED";
    }

    const todayKey = utcDateKey(now);
    const freeSecondsUsedToday =
      sub.freeUsageDate === todayKey ? sub.freeUsageSeconds : 0;
    const freeSecondsRemainingToday = Math.max(
      0,
      FREE_DAILY_LIMIT_SECONDS - freeSecondsUsedToday,
    );

    const trialMsLeft = trialEndsAt.getTime() - now.getTime();
    const trialDaysLeft = Math.max(0, Math.ceil(trialMsLeft / (24 * 60 * 60 * 1000)));

    const quotaFields = computeQuotaFromSubscription(
      sub.studentAddsUsed,
      sub.studentQuotaAllowance,
      isSubscribed,
      activePeriod,
    );

    const canAccessDashboard =
      mode === "SUBSCRIBED" ||
      mode === "FREE_TRIAL" ||
      mode === "FREE_LIMITED";

    const canAddAcademicYear =
      isSubscribed || school._count.academicYears < 1;

    const trialPremium = premiumTrialFields(sub, isSubscribed, now);
    const premiumAccess = isSubscribed || trialPremium.isPremiumTrialActive;

    return {
      mode,
      isSubscribed,
      ...trialPremium,
      trialEndsAt: trialEndsAt.toISOString(),
      trialDaysLeft,
      subscriptionEndsAt: sub.subscriptionEndsAt?.toISOString() ?? null,
      studentAddsUsed: sub.studentAddsUsed,
      studentQuotaAllowance: sub.studentQuotaAllowance,
      ...quotaFields,
      freeSecondsUsedToday,
      freeSecondsRemainingToday,
      canAccessDashboard,
      canGenerateStudentLoginCards: premiumAccess,
      canAddAcademicYear,
    };
  },
);

/** Catat penggunaan waktu harian admin (paket gratis setelah trial). */
export async function touchAdminFreeTierUsage(schoolId: string): Promise<void> {
  const snap = await getSchoolAccessSnapshot(schoolId);
  if (snap.mode !== "FREE_LIMITED" && snap.mode !== "FREE_EXHAUSTED") return;

  const sub = await ensureSchoolSubscription(schoolId);
  const now = new Date();
  const todayKey = utcDateKey(now);

  let seconds = sub.freeUsageSeconds;
  if (sub.freeUsageDate !== todayKey) {
    seconds = 0;
  }

  if (sub.lastAccessAt && sub.freeUsageDate === todayKey) {
    const deltaSec = Math.floor(
      (now.getTime() - sub.lastAccessAt.getTime()) / 1000,
    );
    if (deltaSec > 0 && deltaSec < 600) {
      seconds = Math.min(FREE_DAILY_LIMIT_SECONDS, seconds + deltaSec);
    }
  }

  try {
    await prisma.schoolSubscription.update({
      where: { schoolId },
      data: {
        freeUsageDate: todayKey,
        freeUsageSeconds: seconds,
        lastAccessAt: now,
      },
    });
  } catch (e) {
    if (!isMissingSubscriptionTableError(e)) throw e;
  }
}

export async function isSchoolLoginAllowed(schoolId: string | null): Promise<boolean> {
  if (!schoolId) return false;
  if (!(await isSchoolActiveForAccess(schoolId))) return false;
  const snap = await getSchoolAccessSnapshot(schoolId);
  return hasPremiumMenuAccess(snap);
}

export function schoolLoginBlockedMessage(): string {
  return SCHOOL_LOGIN_SUBSCRIPTION_BLOCKED_MESSAGE;
}

export async function assertSchoolLoginAllowed(
  schoolId: string | null,
): Promise<{ ok: true } | { ok: false; message: string }> {
  if (!schoolId) {
    return { ok: false, message: "Sekolah belum ditetapkan pada akun ini." };
  }
  if (!(await isSchoolActiveForAccess(schoolId))) {
    return { ok: false, message: SCHOOL_DEACTIVATED_MESSAGE };
  }
  if (await isSchoolLoginAllowed(schoolId)) return { ok: true };
  return { ok: false, message: schoolLoginBlockedMessage() };
}

export async function assertCanAddStudents(
  schoolId: string,
  count: number,
): Promise<{ ok: true } | { ok: false; message: string }> {
  if (count <= 0) return { ok: true };
  const snap = await getSchoolAccessSnapshot(schoolId);
  if (canAddStudentsWithSnapshot(snap, count)) return { ok: true };
  const limitLabel =
    snap.studentQuotaLimit != null
      ? `${snap.studentQuotaLimit}`
      : "tanpa batas";
  return {
    ok: false,
    message: `Kuota penambahan siswa habis (${snap.studentAddsUsed}/${limitLabel} terpakai, kumulatif). Anda hanya boleh menambah ${snap.studentAddsRemaining} siswa lagi, meskipun daftar dikosongkan. Tingkatkan paket langganan untuk kuota lebih besar.`,
  };
}

export async function recordStudentAdds(schoolId: string, count: number): Promise<void> {
  if (count <= 0) return;
  const snap = await getSchoolAccessSnapshot(schoolId);
  if (snap.studentQuotaUnlimited) return;
  try {
    await prisma.schoolSubscription.update({
      where: { schoolId },
      data: { studentAddsUsed: { increment: count } },
    });
  } catch (e) {
    if (!isMissingSubscriptionTableError(e)) throw e;
  }
}

export function extendSubscriptionEnd(
  currentEnd: Date | null,
  months: number,
  from: Date = new Date(),
): Date {
  const base =
    currentEnd && currentEnd > from ? currentEnd : from;
  return addMonths(base, months);
}
