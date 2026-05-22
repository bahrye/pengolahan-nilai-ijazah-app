import { NextResponse } from "next/server";

import { auth } from "@/auth";
import { buildSystemSklPdfPreviewForStudent } from "@/lib/skl/load-skl-for-student";
import { prisma } from "@/lib/prisma";
import { studentWhereParticipatingActiveYear } from "@/server/active-academic-year-scope";

export const runtime = "edge";

/** Pratinjau PDF SKL sistem untuk admin sekolah. */
export async function GET(req: Request) {
  const session = await auth();
  if (
    !session?.user?.id ||
    (session.user.role !== "ADMIN_SEKOLAH" && session.user.role !== "SUPERADMIN")
  ) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const schoolId = session.user.schoolId;
  if (!schoolId) {
    return NextResponse.json({ error: "Sekolah tidak ditemukan." }, { status: 403 });
  }

  const url = new URL(req.url);
  let studentId = url.searchParams.get("studentId")?.trim() ?? "";

  if (!studentId) {
    const studentWhere = await studentWhereParticipatingActiveYear(schoolId);
    const first = await prisma.student.findFirst({
      where: studentWhere,
      orderBy: [{ className: "asc" }, { name: "asc" }],
      select: { id: true },
    });
    if (!first) {
      return NextResponse.json(
        { error: "Belum ada siswa untuk pratinjau. Tambahkan siswa terlebih dahulu." },
        { status: 404 },
      );
    }
    studentId = first.id;
  }

  let built: Awaited<ReturnType<typeof buildSystemSklPdfPreviewForStudent>>;
  try {
    built = await buildSystemSklPdfPreviewForStudent(schoolId, studentId);
  } catch (err) {
    console.error("[skl-preview] unhandled", err);
    return NextResponse.json(
      { error: "Gagal membuat pratinjau SKL. Coba lagi." },
      { status: 500 },
    );
  }

  if (!built.ok) {
    return NextResponse.json({ error: built.message }, { status: built.status });
  }

  return new NextResponse(new Uint8Array(built.buffer), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="preview-skl.pdf"`,
      "Cache-Control": "private, no-store",
    },
  });
}
