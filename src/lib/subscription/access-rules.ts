import { FREE_STUDENT_ADD_QUOTA, isFreeAdminPath, isPremiumAdminPath } from "./constants";
import { hasPremiumMenuAccess } from "./premium-access";

import type { SchoolAccessSnapshot } from "./types";

export function canAddStudentsWithSnapshot(
  snap: Pick<
    SchoolAccessSnapshot,
    "studentAddsUsed" | "studentQuotaUnlimited" | "studentQuotaLimit"
  >,
  count: number,
): boolean {
  if (count <= 0) return true;
  if (snap.studentQuotaUnlimited) return true;
  const limit = snap.studentQuotaLimit ?? FREE_STUDENT_ADD_QUOTA;
  return snap.studentAddsUsed + count <= limit;
}

export function adminPathAllowedForAccess(
  pathname: string,
  snap: SchoolAccessSnapshot,
): boolean {
  if (pathname.startsWith("/dashboard/langganan")) return true;
  if (!snap.canAccessDashboard) {
    return pathname.startsWith("/dashboard/langganan");
  }
  if (hasPremiumMenuAccess(snap)) return true;
  if (snap.mode === "FREE_EXHAUSTED") {
    return isFreeAdminPath(pathname) || pathname.startsWith("/dashboard/langganan");
  }
  if (isPremiumAdminPath(pathname)) return false;
  return isFreeAdminPath(pathname);
}
