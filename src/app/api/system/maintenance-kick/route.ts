import { redirect } from "next/navigation";

import { auth, signOut } from "@/auth";
import { MAINTENANCE_SIGN_OUT_PATH } from "@/lib/auth-sign-out-path";
import {
  getPlatformMaintenance,
  isPlatformMaintenanceBlocking,
} from "@/lib/platform-maintenance";

export const dynamic = "force-dynamic";

/** Putuskan sesi lalu arahkan ke halaman maintenance (dipanggil dari proxy / layout). */
export async function GET() {
  const state = await getPlatformMaintenance();
  if (!isPlatformMaintenanceBlocking(state)) {
    redirect("/login");
  }

  const session = await auth();
  if (session?.user) {
    await signOut({ redirectTo: MAINTENANCE_SIGN_OUT_PATH });
  }

  redirect(MAINTENANCE_SIGN_OUT_PATH);
}
