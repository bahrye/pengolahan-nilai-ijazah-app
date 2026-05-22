import { NextResponse } from "next/server";

import {
  formatMaintenanceEndsAtWib,
  getPlatformMaintenance,
  isPlatformMaintenanceBlocking,
} from "@/lib/platform-maintenance";

export const dynamic = "force-dynamic";

export async function GET() {
  const state = await getPlatformMaintenance();
  const active = isPlatformMaintenanceBlocking(state);
  return NextResponse.json({
    active,
    endsAtIso: state.endsAt?.toISOString() ?? null,
    endsAtLabelWib: state.endsAt ? formatMaintenanceEndsAtWib(state.endsAt) : null,
  });
}
