"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";

import { adminPathAllowedForAccess } from "@/lib/subscription/access-rules";
import type { SchoolAccessSnapshot } from "@/lib/subscription/types";

import { useSubscriptionUsage } from "./SubscriptionUsageProvider";

import type { UserRole } from "@prisma/client";

export function AdminSubscriptionGuard({
  role,
  access: accessProp,
  impersonatingSchoolId = null,
  children,
}: {
  role: UserRole;
  access: SchoolAccessSnapshot | null;
  impersonatingSchoolId?: string | null;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const usage = useSubscriptionUsage();
  const access = usage?.effectiveAccess ?? accessProp;
  const enforceSchoolAdminRules =
    role === "ADMIN_SEKOLAH" ||
    (role === "SUPERADMIN" && !!impersonatingSchoolId);

  const pathAllowed =
    !enforceSchoolAdminRules || !access
      ? true
      : adminPathAllowedForAccess(pathname, access);

  useEffect(() => {
    if (!enforceSchoolAdminRules || !access) return;
    if (pathAllowed) return;
    router.replace("/dashboard/langganan");
  }, [enforceSchoolAdminRules, access, pathAllowed, router]);

  if (!pathAllowed) {
    return null;
  }

  return children;
}
