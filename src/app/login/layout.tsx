import { redirect } from "next/navigation";

import {
  getPlatformMaintenance,
  isPlatformMaintenanceBlocking,
} from "@/lib/platform-maintenance";

export const dynamic = "force-dynamic";

export default async function LoginLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const state = await getPlatformMaintenance();
  if (isPlatformMaintenanceBlocking(state)) {
    redirect("/maintenance");
  }

  return children;
}
