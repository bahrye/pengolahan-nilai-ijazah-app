import { redirect } from "next/navigation";

import {
  formatMaintenanceEndsAtWib,
  getPlatformMaintenance,
  isPlatformMaintenanceBlocking,
} from "@/lib/platform-maintenance";

import { MaintenanceExperience } from "./MaintenanceExperience";

export const dynamic = "force-dynamic";

export default async function MaintenancePage() {
  const state = await getPlatformMaintenance();
  if (!isPlatformMaintenanceBlocking(state)) {
    redirect("/login");
  }

  const endsAtLabelWib = state.endsAt
    ? formatMaintenanceEndsAtWib(state.endsAt)
    : "Segera";

  return <MaintenanceExperience endsAtLabelWib={endsAtLabelWib} />;
}
