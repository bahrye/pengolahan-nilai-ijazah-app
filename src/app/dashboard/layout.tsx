import { redirect } from "next/navigation";

import { auth, signOut } from "@/auth";
import { AdminActiveSessionGuard } from "@/components/auth/AdminActiveSessionGuard";
import { MaintenanceSessionGuard } from "@/components/auth/MaintenanceSessionGuard";
import { DashboardShell } from "@/components/layout/DashboardShell";
import { AdminSubscriptionGuard } from "@/components/subscription/AdminSubscriptionGuard";
import { SubscriptionUsageProvider } from "@/components/subscription/SubscriptionUsageProvider";
import { LOGIN_QUERY_ACCOUNT_DEACTIVATED } from "@/lib/admin-account-status";
import { LOGIN_QUERY_SCHOOL_DEACTIVATED } from "@/lib/school-active";
import { MAINTENANCE_SIGN_OUT_PATH } from "@/lib/auth-sign-out-path";
import {
  getPlatformMaintenance,
  isPlatformMaintenanceBlocking,
} from "@/lib/platform-maintenance";
import { prisma } from "@/lib/prisma";
import { getSidebarContext } from "@/server/layout-data";

export const dynamic = "force-dynamic";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const maintenance = await getPlatformMaintenance();
  if (isPlatformMaintenanceBlocking(maintenance)) {
    await signOut({ redirectTo: MAINTENANCE_SIGN_OUT_PATH });
  }

  if (session.user.role === "ADMIN_SEKOLAH") {
    const dbUser = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { isActive: true },
    });
    if (!dbUser?.isActive) {
      await signOut({
        redirectTo: `/login?error=${LOGIN_QUERY_ACCOUNT_DEACTIVATED}`,
      });
    }
  }

  const effectiveSchoolId = session.user.schoolId;
  if (effectiveSchoolId) {
    const school = await prisma.school.findUnique({
      where: { id: effectiveSchoolId },
      select: { isActive: true },
    });
    if (!school?.isActive) {
      if (session.user.role === "SUPERADMIN") {
        await prisma.user.update({
          where: { id: session.user.id },
          data: { activeSchoolId: null },
        });
        redirect("/superadmin");
      }
      await signOut({
        redirectTo: `/login?error=${LOGIN_QUERY_SCHOOL_DEACTIVATED}`,
      });
    }
  }

  const ctx = await getSidebarContext();
  if (!ctx) redirect("/login");

  return (
    <SubscriptionUsageProvider
      initialAccess={ctx.subscriptionAccess}
      role={ctx.role}
      impersonatingSchoolId={ctx.impersonatingSchoolId}
    >
      <div className="legacy-shell gradient-bg flex w-full max-w-full min-h-[100dvh] min-h-0 flex-1 overflow-x-hidden">
        <DashboardShell
          ctx={{
            email: ctx.email,
            name: ctx.name,
            role: ctx.role,
            image: ctx.image,
            isHomeroom: ctx.isHomeroom,
            activeSchoolId: ctx.activeSchoolId,
            effectiveSchoolId: ctx.effectiveSchoolId,
            guruSchoolContexts: ctx.guruSchoolContexts,
            headerPrimaryLabel: ctx.headerPrimaryLabel,
            subscriptionAccess: ctx.subscriptionAccess,
            impersonatingSchoolId: ctx.impersonatingSchoolId,
          }}
        >
          <AdminSubscriptionGuard
            role={ctx.role}
            access={ctx.subscriptionAccess}
            impersonatingSchoolId={ctx.impersonatingSchoolId}
          >
            <MaintenanceSessionGuard />
            {ctx.role === "ADMIN_SEKOLAH" ? <AdminActiveSessionGuard /> : null}
            {children}
          </AdminSubscriptionGuard>
        </DashboardShell>
      </div>
    </SubscriptionUsageProvider>
  );
}

