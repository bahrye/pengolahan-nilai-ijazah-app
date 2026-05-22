import { prisma } from "@/lib/prisma";
import { requireTenantAdmin } from "@/server/session";

import { PengaturanInputNilaiForm } from "./PengaturanInputNilaiForm";

export default async function PengaturanInputNilaiPage() {
  const { schoolId } = await requireTenantAdmin();
  const school = await prisma.school.findUnique({
    where: { id: schoolId },
    select: {
      examInputPolicy: true,
      examInputWindowStart: true,
      examInputWindowEnd: true,
    },
  });

  const defaults = {
    examInputPolicy: school?.examInputPolicy ?? "OPEN",
    examInputWindowStartIso: school?.examInputWindowStart?.toISOString() ?? null,
    examInputWindowEndIso: school?.examInputWindowEnd?.toISOString() ?? null,
  };

  return <PengaturanInputNilaiForm defaults={defaults} />;
}
