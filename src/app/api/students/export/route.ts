import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { requireTenantAdmin } from "@/server/session";
import { buildMasterSiswaExcelBuffer, type ExportMasterStudentRow } from "@/lib/student-export-excel";
import { studentWhereParticipatingActiveYear } from "@/server/active-academic-year-scope";

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

    const studentWhere = await studentWhereParticipatingActiveYear(schoolId);
    const students = await prisma.student.findMany({
      where: studentWhere,
      include: { classRoom: { select: { name: true } } },
      orderBy: [{ className: "asc" }, { name: "asc" }],
    });

    const rows: ExportMasterStudentRow[] = students.map((s) => ({
      nisn: s.nisn,
      name: s.name,
      gender: s.gender === "P" ? "P" : "L",
      birthPlace: s.birthPlace,
      birthDate: s.birthDate ? s.birthDate.toISOString().slice(0, 10) : null,
      className: s.className ?? s.classRoom?.name ?? null,
      nomorUjian: s.nomorUjian,
      ruangUjian: s.ruangUjian,
      parentGuardianName: s.parentGuardianName,
      sklLetterNumber: s.sklLetterNumber,
      nis: s.nis,
    }));

    const buf = await buildMasterSiswaExcelBuffer(classNames, rows);

    return new NextResponse(buf, {
      status: 200,
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition":
          'attachment; filename="export_data_siswa.xlsx"',
        "Cache-Control": "no-store",
      },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Gagal mengekspor data siswa.";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
