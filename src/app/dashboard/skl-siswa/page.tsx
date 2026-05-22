import { isCloudinaryConfigured } from "@/lib/cloudinary-server";
import { googleDriveFolderUrl } from "@/lib/extract-google-drive-folder-id";
import {
  getConfiguredSklServiceEmail,
  isGoogleDriveSklConfigured,
  listSklNisnFromDriveFolder,
} from "@/lib/google-drive-skl";
import { isSklSystemDataReady } from "@/lib/skl/skl-document-data";
import { prisma } from "@/lib/prisma";
import { requireTenantAdmin } from "@/server/session";
import { studentWhereParticipatingActiveYear } from "@/server/active-academic-year-scope";

import { SklSiswaClient } from "./SklSiswaClient";

import type { SklModelSource } from "@prisma/client";

export const dynamic = "force-dynamic";

export default async function SklSiswaPage() {
  const { schoolId } = await requireTenantAdmin();
  const studentWhere = await studentWhereParticipatingActiveYear(schoolId);
  const [school, students] = await Promise.all([
    prisma.school.findUnique({
      where: { id: schoolId },
      select: {
        sklActive: true,
        sklModelSource: true,
        sklDriveFolderId: true,
        printLetterheadUrl: true,
        namaSekolah: true,
        sklIssuedAt: true,
      },
    }),
    prisma.student.findMany({
      where: studentWhere,
      orderBy: [{ className: "asc" }, { name: "asc" }],
      select: {
        id: true,
        nisn: true,
        nis: true,
        name: true,
        className: true,
        sklLetterNumber: true,
        parentGuardianName: true,
        classRoom: { select: { name: true } },
      },
    }),
  ]);

  const modelSource: SklModelSource = school?.sklModelSource ?? "GOOGLE_DRIVE";
  const folderId = school?.sklDriveFolderId ?? null;
  const driveConfigured = isGoogleDriveSklConfigured();
  let nisnWithSkl: string[] = [];
  let driveError: string | null = null;

  if (modelSource === "GOOGLE_DRIVE" && folderId && driveConfigured) {
    const r = await listSklNisnFromDriveFolder(folderId);
    if (r.ok) {
      nisnWithSkl = Array.from(r.nisnSet);
    } else {
      driveError = r.message;
    }
  } else if (modelSource === "SYSTEM") {
    const schoolName = school?.namaSekolah ?? "";
    nisnWithSkl = students
      .filter((s) =>
        isSklSystemDataReady(
          { namaSekolah: schoolName },
          {
            name: s.name,
            nisn: s.nisn,
            sklLetterNumber: s.sklLetterNumber,
            parentGuardianName: s.parentGuardianName,
            nis: s.nis,
          },
        ),
      )
      .map((s) => s.nisn.replace(/\D/g, "").slice(0, 10));
  }

  const initialRows = students.map((s) => ({
    id: s.id,
    nisn: s.nisn,
    name: s.name,
    classLabel: s.className ?? s.classRoom?.name ?? null,
    sklLetterNumber: s.sklLetterNumber,
    parentGuardianName: s.parentGuardianName,
    nis: s.nis,
  }));

  const driveServiceEmail = getConfiguredSklServiceEmail() ?? "";
  const previewStudentId = initialRows[0]?.id ?? null;
  const previewFirstRow = initialRows[0];
  const previewUsesDummy = Boolean(
    previewFirstRow &&
      !isSklSystemDataReady(
        { namaSekolah: school?.namaSekolah?.trim() ?? "" },
        {
          name: previewFirstRow.name,
          nisn: previewFirstRow.nisn,
          sklLetterNumber: previewFirstRow.sklLetterNumber,
          parentGuardianName: previewFirstRow.parentGuardianName,
          nis: previewFirstRow.nis,
        },
      ),
  );

  const initialSklActive = school?.sklActive ?? false;

  return (
    <SklSiswaClient
      initialSklActive={initialSklActive}
      initialRows={initialRows}
      initialSklModelSource={modelSource}
      previewStudentId={previewStudentId}
      previewUsesDummy={previewUsesDummy}
      initialFolderUrl={folderId ? googleDriveFolderUrl(folderId) : ""}
      initialNisnWithSkl={nisnWithSkl}
      driveConfigured={driveConfigured}
      initialDriveError={driveError}
      driveServiceEmail={driveServiceEmail}
      printLetterheadUrl={school?.printLetterheadUrl ?? null}
      cloudinaryReady={isCloudinaryConfigured()}
      schoolName={school?.namaSekolah?.trim() ?? ""}
      initialSklIssuedAt={
        school?.sklIssuedAt
          ? school.sklIssuedAt.toISOString().slice(0, 10)
          : ""
      }
    />
  );
}
