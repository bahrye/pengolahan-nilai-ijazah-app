import { redirect } from "next/navigation";

import { requireTenantAdmin } from "@/server/session";
import { getLanggananPageDataAction } from "@/server/actions/subscription";

import { LanggananClient } from "./LanggananClient";

export default async function LanggananPage() {
  await requireTenantAdmin();
  const res = await getLanggananPageDataAction();
  if (!res.ok) {
    redirect("/dashboard/sekolah");
  }
  return <LanggananClient initial={res.data} />;
}
