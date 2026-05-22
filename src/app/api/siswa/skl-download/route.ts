import { NextResponse } from "next/server";

import { auth } from "@/auth";
import {
  fetchSklPdfArrayBuffer,
  findSklPdfFileIdForNisn,
  isGoogleDriveSklConfigured,
} from "@/lib/google-drive-skl";
import { buildSystemSklPdfForStudentUser } from "@/lib/skl/load-skl-for-student";
import { getStudentSklDownloadBlockReason } from "@/lib/student-ijazah-visibility";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

/**
 * Unduh PDF SKL siswa yang sedang login — model sistem (PDF otomatis) atau Google Drive (NISN.pdf).
 */
export async function GET() {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== "SISWA") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const student = await prisma.student.findFirst({
    where: { userId: session.user.id, isActive: true },
    select: {
      nisn: true,
      graduationAnnouncementAckAt: true,
      school: {
        select: {
          sklActive: true,
          sklModelSource: true,
          sklDriveFolderId: true,
          graduationAnnouncementAt: true,
          ijazahRekapVisibility: true,
        },
      },
    },
  });

  if (!student) {
    return NextResponse.json({ error: "Data siswa tidak ditemukan." }, { status: 404 });
  }

  const school = student.school;
  const block = getStudentSklDownloadBlockReason({
    sklActive: school?.sklActive ?? false,
    graduationAnnouncementAt: school?.graduationAnnouncementAt ?? null,
    ijazahRekapVisibility: school?.ijazahRekapVisibility ?? "AFTER_CHECK_ANNOUNCEMENT",
    graduationAnnouncementAckAt: student.graduationAnnouncementAckAt,
    now: new Date(),
  });
  if (block) {
    return NextResponse.json({ error: block }, { status: 403 });
  }

  const nisn = student.nisn.replace(/\D/g, "").slice(0, 10);
  const model = school?.sklModelSource ?? "GOOGLE_DRIVE";

  if (model === "SYSTEM") {
    const built = await buildSystemSklPdfForStudentUser(session.user.id);
    if (!built.ok) {
      return NextResponse.json({ error: built.message }, { status: built.status });
    }
    return new NextResponse(new Uint8Array(built.buffer), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${built.filename}"`,
        "Cache-Control": "private, no-store",
      },
    });
  }

  const folderId = school?.sklDriveFolderId ?? null;
  if (!folderId || !isGoogleDriveSklConfigured()) {
    return NextResponse.json({ error: "SKL belum tersedia." }, { status: 404 });
  }

  const fileId = await findSklPdfFileIdForNisn(folderId, student.nisn);
  if (!fileId) {
    return NextResponse.json({ error: "SKL belum tersedia." }, { status: 404 });
  }

  const bin = await fetchSklPdfArrayBuffer(fileId);
  if (!bin.ok) {
    return NextResponse.json({ error: bin.message }, { status: bin.status });
  }

  return new NextResponse(bin.buffer, {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${nisn}.pdf"`,
      "Cache-Control": "private, no-store",
    },
  });
}
