import { prisma } from "@/lib/prisma";
import { requireTenantAdmin } from "@/server/session";

import { BobotForm } from "./BobotForm";

export default async function BobotPage() {
  const { schoolId } = await requireTenantAdmin();
  const cfg = await prisma.schoolGradingConfig.findUnique({
    where: { schoolId },
  });

  const defaults = {
    bobotUjian: cfg ? Number(cfg.bobotUjian) : 40,
    bobotRapor: cfg ? Number(cfg.bobotRapor) : 60,
    kkm: cfg ? Number(cfg.kkm) : 75,
    raporAspectMode: cfg?.raporAspectMode ?? "BOTH",
  };

  return <BobotForm defaults={defaults} />;
}
