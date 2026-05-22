import type { SubscriptionPlanPackage } from "@prisma/client";

/** Mode akses admin sekolah (tanpa langganan / trial / berlangganan). */
export type SchoolAccessMode =
  | "SUBSCRIBED"
  | "FREE_TRIAL"
  | "FREE_LIMITED"
  | "FREE_EXHAUSTED";

/**
 * Snapshot langganan yang aman dikirim ke Client Components (tanpa fungsi / Date).
 */
export type SchoolAccessSnapshot = {
  mode: SchoolAccessMode;
  isSubscribed: boolean;
  /** Trial premium 3 hari (sekali per sekolah, tanpa langganan berbayar). */
  isPremiumTrialActive: boolean;
  premiumTrialEndsAt: string | null;
  canStartPremiumTrial: boolean;
  trialEndsAt: string;
  trialDaysLeft: number;
  subscriptionEndsAt: string | null;
  activeSubscriptionPackage: SubscriptionPlanPackage | null;
  studentQuotaAllowance: number;
  studentQuotaLimit: number | null;
  studentQuotaUnlimited: boolean;
  studentAddsUsed: number;
  studentAddsRemaining: number;
  freeSecondsUsedToday: number;
  freeSecondsRemainingToday: number;
  canAccessDashboard: boolean;
  canGenerateStudentLoginCards: boolean;
  canAddAcademicYear: boolean;
};
