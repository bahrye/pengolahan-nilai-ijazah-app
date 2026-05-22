import type { Prisma } from "@prisma/client";

/**
 * Setelah baris `Teacher` pengajar tambahan di `hostSchoolId` dihapus (atau setara), tutup permohonan
 * `GuruTugasTambahanRequest` terkait (PENDING/APPROVED) agar sekolah induk tidak perlu membatalkan dua kali.
 */
export async function cancelTugasTambahanRequestsForPengajarOnHost(
  tx: Prisma.TransactionClient,
  opts: {
    hostSchoolId: string;
    pengajarUserId: string;
    homeSchoolId: string | null;
    decidedByUserId: string;
    decidedBySchoolId: string;
    rejectReason: string;
  },
): Promise<void> {
  if (!opts.homeSchoolId) return;

  const homeTeacher = await tx.teacher.findFirst({
    where: { userId: opts.pengajarUserId, schoolId: opts.homeSchoolId },
    select: { id: true },
  });
  if (!homeTeacher) return;

  await tx.guruTugasTambahanRequest.updateMany({
    where: {
      homeTeacherId: homeTeacher.id,
      hostSchoolId: opts.hostSchoolId,
      status: { in: ["PENDING", "APPROVED"] },
    },
    data: {
      status: "CANCELLED",
      decidedAt: new Date(),
      decidedByUserId: opts.decidedByUserId,
      decidedBySchoolId: opts.decidedBySchoolId,
      rejectReason: opts.rejectReason,
    },
  });
}
