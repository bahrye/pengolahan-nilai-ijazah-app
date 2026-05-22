import type { SchoolAccessSnapshot } from "./types";

/** Akses menu premium (berbayar atau trial 3 hari). */
export function hasPremiumMenuAccess(
  snap: Pick<SchoolAccessSnapshot, "isSubscribed" | "isPremiumTrialActive">,
): boolean {
  return snap.isSubscribed || snap.isPremiumTrialActive;
}
