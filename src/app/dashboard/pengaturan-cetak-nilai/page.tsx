import { prisma } from "@/lib/prisma";
import { isCloudinaryConfigured } from "@/lib/cloudinary-server";
import { requireTenantAdmin } from "@/server/session";

import { PengaturanCetakNilaiForm } from "./PengaturanCetakNilaiForm";

export default async function PengaturanCetakNilaiPage() {
  const { schoolId } = await requireTenantAdmin();
  const school = await prisma.school.findUnique({
    where: { id: schoolId },
    select: {
      printLetterheadUrl: true,
      printSignaturePlace: true,
      printDateMode: true,
      printManualDate: true,
    },
  });

  return (
    <PengaturanCetakNilaiForm
      cloudinaryReady={isCloudinaryConfigured()}
      defaults={{
        printLetterheadUrl: school?.printLetterheadUrl ?? null,
        printSignaturePlace: school?.printSignaturePlace ?? "",
        printDateMode: school?.printDateMode ?? "AUTO_ON_SUBMIT",
        printManualDate: school?.printManualDate ?? null,
      }}
    />
  );
}
