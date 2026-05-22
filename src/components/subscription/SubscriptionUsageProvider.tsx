"use client";

import { usePathname, useRouter } from "next/navigation";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import {
  FREE_DAILY_LIMIT_SECONDS,
  FREE_STUDENT_ADD_QUOTA,
} from "@/lib/subscription/constants";
import type { SchoolAccessSnapshot } from "@/lib/subscription/types";
import { syncFreeTierUsageAction } from "@/server/actions/subscription-usage";

import type { UserRole } from "@prisma/client";

type SubscriptionUsageContextValue = {
  effectiveAccess: SchoolAccessSnapshot | null;
  remainingSeconds: number;
  isTimeBlocked: boolean;
  isSubscribed: boolean;
  studentQuotaUnlimited: boolean;
  studentQuotaLimit: number | null;
  studentAddsUsed: number;
  studentAddsRemaining: number;
  applyStudentAdds: (count: number) => void;
  setStudentQuotaFromServer: (used: number, remaining: number) => void;
};

const SubscriptionUsageContext = createContext<SubscriptionUsageContextValue | null>(
  null,
);

export function useSubscriptionUsage() {
  return useContext(SubscriptionUsageContext);
}

function toExhaustedSnapshot(base: SchoolAccessSnapshot): SchoolAccessSnapshot {
  return {
    ...base,
    mode: "FREE_EXHAUSTED",
    freeSecondsRemainingToday: 0,
    freeSecondsUsedToday: FREE_DAILY_LIMIT_SECONDS,
    canAccessDashboard: false,
  };
}

export function SubscriptionUsageProvider({
  initialAccess,
  role,
  impersonatingSchoolId = null,
  children,
}: {
  initialAccess: SchoolAccessSnapshot | null;
  role: UserRole;
  impersonatingSchoolId?: string | null;
  children: React.ReactNode;
}) {
  const effectiveRole: UserRole =
    role === "SUPERADMIN" && impersonatingSchoolId ? "ADMIN_SEKOLAH" : role;

  const router = useRouter();
  const pathname = usePathname();
  const [remainingSeconds, setRemainingSeconds] = useState(
    () => initialAccess?.freeSecondsRemainingToday ?? 0,
  );
  const [forceExhausted, setForceExhausted] = useState(
    () =>
      initialAccess?.mode === "FREE_EXHAUSTED" ||
      (initialAccess?.mode === "FREE_LIMITED" &&
        initialAccess.freeSecondsRemainingToday <= 0),
  );
  const [studentAddsUsed, setStudentAddsUsed] = useState(
    () => initialAccess?.studentAddsUsed ?? 0,
  );
  const [studentAddsRemaining, setStudentAddsRemaining] = useState(
    () => initialAccess?.studentAddsRemaining ?? FREE_STUDENT_ADD_QUOTA,
  );
  const redirectingRef = useRef(false);

  const isSubscribed = initialAccess?.isSubscribed ?? false;
  const studentQuotaUnlimited = initialAccess?.studentQuotaUnlimited ?? false;
  const studentQuotaLimit =
    initialAccess?.studentQuotaLimit ??
    initialAccess?.studentQuotaAllowance ??
    FREE_STUDENT_ADD_QUOTA;

  const applyStudentAdds = useCallback(
    (count: number) => {
      if (studentQuotaUnlimited || count <= 0) return;
      const cap = studentQuotaLimit ?? FREE_STUDENT_ADD_QUOTA;
      setStudentAddsUsed((prev) => {
        const next = Math.min(cap, prev + count);
        setStudentAddsRemaining(Math.max(0, cap - next));
        return next;
      });
    },
    [studentQuotaUnlimited, studentQuotaLimit],
  );

  const setStudentQuotaFromServer = useCallback((used: number, remaining: number) => {
    setStudentAddsUsed(used);
    setStudentAddsRemaining(remaining);
  }, []);

  const isAdminFreeLimited =
    effectiveRole === "ADMIN_SEKOLAH" &&
    initialAccess?.mode === "FREE_LIMITED" &&
    !forceExhausted;

  const syncServer = useCallback(async () => {
    if (effectiveRole !== "ADMIN_SEKOLAH" || !initialAccess) return;
    if (initialAccess.mode !== "FREE_LIMITED" && !forceExhausted) return;

    const res = await syncFreeTierUsageAction();
    if (!res.ok) return;

    if (res.exhausted || res.remainingSeconds <= 0) {
      setRemainingSeconds(0);
      setForceExhausted(true);
      return;
    }

    setRemainingSeconds(res.remainingSeconds);
    if (res.mode === "FREE_EXHAUSTED") {
      setForceExhausted(true);
    }
  }, [effectiveRole, initialAccess, forceExhausted]);

  useEffect(() => {
    if (!isAdminFreeLimited) return;

    const tick = window.setInterval(() => {
      setRemainingSeconds((prev) => {
        if (prev <= 1) {
          setForceExhausted(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => window.clearInterval(tick);
  }, [isAdminFreeLimited]);

  useEffect(() => {
    if (effectiveRole !== "ADMIN_SEKOLAH" || !initialAccess) return;
    if (initialAccess.mode !== "FREE_LIMITED") return;

    void syncServer();
    const syncInterval = window.setInterval(() => {
      void syncServer();
    }, 120_000); // 2 menit

    return () => window.clearInterval(syncInterval);
  }, [effectiveRole, initialAccess, syncServer]);

  const isTimeBlocked = forceExhausted || (isAdminFreeLimited && remainingSeconds <= 0);

  const effectiveAccess = useMemo((): SchoolAccessSnapshot | null => {
    if (!initialAccess) return null;

    const withStudentQuota = (snap: SchoolAccessSnapshot): SchoolAccessSnapshot =>
      snap.studentQuotaUnlimited
        ? snap
        : {
            ...snap,
            studentAddsUsed,
            studentAddsRemaining,
          };

    if (
      initialAccess.isSubscribed ||
      initialAccess.isPremiumTrialActive ||
      initialAccess.mode === "FREE_TRIAL"
    ) {
      return withStudentQuota(initialAccess);
    }
    if (isTimeBlocked && initialAccess.mode === "FREE_LIMITED") {
      return withStudentQuota(toExhaustedSnapshot(initialAccess));
    }
    if (initialAccess.mode === "FREE_EXHAUSTED") {
      return withStudentQuota(initialAccess);
    }
    if (initialAccess.mode === "FREE_LIMITED") {
      return withStudentQuota({
        ...initialAccess,
        freeSecondsRemainingToday: remainingSeconds,
        freeSecondsUsedToday: FREE_DAILY_LIMIT_SECONDS - remainingSeconds,
      });
    }
    return withStudentQuota(initialAccess);
  }, [
    initialAccess,
    isTimeBlocked,
    remainingSeconds,
    studentAddsUsed,
    studentAddsRemaining,
  ]);

  useEffect(() => {
    if (effectiveRole !== "ADMIN_SEKOLAH" || !effectiveAccess) return;
    if (!isTimeBlocked) return;
    if (pathname.startsWith("/dashboard/langganan")) return;
    if (redirectingRef.current) return;

    redirectingRef.current = true;
    void syncServer().finally(() => {
      router.replace("/dashboard/langganan");
    });
  }, [effectiveRole, effectiveAccess, isTimeBlocked, pathname, router, syncServer]);

  const value = useMemo(
    (): SubscriptionUsageContextValue => ({
      effectiveAccess,
      remainingSeconds,
      isTimeBlocked,
      isSubscribed,
      studentQuotaUnlimited,
      studentQuotaLimit,
      studentAddsUsed,
      studentAddsRemaining,
      applyStudentAdds,
      setStudentQuotaFromServer,
    }),
    [
      effectiveAccess,
      remainingSeconds,
      isTimeBlocked,
      isSubscribed,
      studentQuotaUnlimited,
      studentQuotaLimit,
      studentAddsUsed,
      studentAddsRemaining,
      applyStudentAdds,
      setStudentQuotaFromServer,
    ],
  );

  return (
    <SubscriptionUsageContext.Provider value={value}>
      {children}
    </SubscriptionUsageContext.Provider>
  );
}
