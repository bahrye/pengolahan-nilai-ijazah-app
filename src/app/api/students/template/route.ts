import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { requireTenantAdmin } from "@/server/session";
import { buildMasterSiswaExcelBuffer } from "@/lib/student-export-excel";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const { schoolId } = await requireTenantAdmin();

    const activeYear = await prisma.academicYear.findFirst({
      where: { schoolId, isActive: true },
    });
    const classRooms = activeYear
      ? await prisma.classRoom.findMany({
          where: { academicYearId: activeYear.id },
          orderBy: { name: "asc" },
          select: { name: true },
        })
      : [];
    const classNames = classRooms.map((c) => c.name);

    const buf = await buildMasterSiswaExcelBuffer(classNames, []);

    return new NextResponse(buf, {
      status: 200,
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition":
          'attachment; filename="template_import_siswa.xlsx"',
        "Cache-Control": "no-store",
      },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Gagal membuat template.";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
