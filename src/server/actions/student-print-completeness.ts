"use server";


import { prisma } from "@/lib/prisma";
import { requireTenantAdmin } from "@/server/session";
import { studentWhereParticipatingActiveYear } from "@/server/active-academic-year-scope";


/** Mengosongkan nomor peserta ujian dan nama ruang ujian untuk semua siswa di sekolah ini. */
export async function clearStudentPrintCompletenessAction(): Promise<
  { ok: true; cleared: number } | { ok: false; message: string }
> {
  try {
    const { schoolId } = await requireTenantAdmin();
    const participatingWhere = await studentWhereParticipatingActiveYear(schoolId);
    const result = await prisma.student.updateMany({
      where: participatingWhere,
      data: { nomorUjian: null, ruangUjian: null },
    });
    return { ok: true, cleared: result.count };
  } catch (e) {
    return { ok: false, message: (e as Error).message };
  }
}
