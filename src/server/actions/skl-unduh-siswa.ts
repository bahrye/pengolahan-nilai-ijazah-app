"use server";

import { auth } from "@/auth";
import { findSklPdfFileIdForNisn, isGoogleDriveSklConfigured } from "@/lib/google-drive-skl";
import { isSklSystemDataReady } from "@/lib/skl/skl-document-data";
import { getStudentSklDownloadBlockReason } from "@/lib/student-ijazah-visibility";
import { prisma } from "@/lib/prisma";

/** Cek apakah siswa boleh mengunduh SKL, lalu apakah berkas tersedia (sistem atau Drive). */
export async function checkSklAvailabilityForStudentAction(): Promise<
  | { ok: true; kind: "locked"; message: string }
  | { ok: true; kind: "ready"; available: boolean; model: "SYSTEM" | "GOOGLE_DRIVE" }
  | { ok: false; message: string }
> {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== "SISWA") {
    return { ok: false, message: "Anda belum masuk atau bukan akun siswa." };
  }

  const student = await prisma.student.findFirst({
    where: { userId: session.user.id, isActive: true },
    select: {
      nisn: true,
      name: true,
      nis: true,
      sklLetterNumber: true,
      parentGuardianName: true,
      graduationAnnouncementAckAt: true,
      school: {
        select: {
          sklActive: true,
          sklModelSource: true,
          namaSekolah: true,
          sklDriveFolderId: true,
          graduationAnnouncementAt: true,
          ijazahRekapVisibility: true,
        },
      },
    },
  });

  if (!student) {
    return { ok: false, message: "Data siswa tidak ditemukan." };
  }

  const school = student.school;
  const model = school?.sklModelSource ?? "GOOGLE_DRIVE";

  const block = getStudentSklDownloadBlockReason({
    sklActive: school?.sklActive ?? false,
    graduationAnnouncementAt: school?.graduationAnnouncementAt ?? null,
    ijazahRekapVisibility: school?.ijazahRekapVisibility ?? "AFTER_CHECK_ANNOUNCEMENT",
    graduationAnnouncementAckAt: student.graduationAnnouncementAckAt,
    now: new Date(),
  });
  if (block) {
    return { ok: true, kind: "locked", message: block };
  }

  if (model === "SYSTEM") {
    const ready = isSklSystemDataReady(
      { namaSekolah: school?.namaSekolah ?? "" },
      {
        name: student.name,
        nisn: student.nisn,
        sklLetterNumber: student.sklLetterNumber,
        parentGuardianName: student.parentGuardianName,
        nis: student.nis,
      },
    );
    return { ok: true, kind: "ready", available: ready, model: "SYSTEM" };
  }

  const folderId = school?.sklDriveFolderId ?? null;
  if (!folderId || !isGoogleDriveSklConfigured()) {
    return { ok: true, kind: "ready", available: false, model: "GOOGLE_DRIVE" };
  }

  const fileId = await findSklPdfFileIdForNisn(folderId, student.nisn);
  return {
    ok: true,
    kind: "ready",
    available: Boolean(fileId),
    model: "GOOGLE_DRIVE",
  };
}
