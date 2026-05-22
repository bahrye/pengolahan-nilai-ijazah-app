import { prisma } from "@/lib/prisma";
import { requireTenantAdmin } from "@/server/session";

import { PengaturanKelulusanForm } from "./PengaturanKelulusanForm";

export default async function PengaturanKelulusanPage() {
  const { schoolId } = await requireTenantAdmin();
  const school = await prisma.school.findUnique({
    where: { id: schoolId },
    select: {
      graduationAnnouncementAt: true,
      ijazahRekapVisibility: true,
    },
  });

  const defaults = {
    graduationAnnouncementAtIso: school?.graduationAnnouncementAt?.toISOString() ?? null,
    ijazahRekapVisibility: school?.ijazahRekapVisibility ?? "AFTER_CHECK_ANNOUNCEMENT",
  };

  return <PengaturanKelulusanForm defaults={defaults} />;
}
