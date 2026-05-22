import { UnifiedExamScores } from "@/components/grades/UnifiedExamScores";
import { loadGradePageMaster } from "@/server/grade-page-data";
import { prisma } from "@/lib/prisma";
import { requireUserSchoolId } from "@/server/session";

export default async function NilaiUjianPage() {
  const { schoolId } = await requireUserSchoolId();
  const [{ students, subjects, classRooms, examInput, userRole }, grading] = await Promise.all([
    loadGradePageMaster(),
    prisma.schoolGradingConfig.findUnique({ where: { schoolId } }),
  ]);

  const kkm = grading ? Number(grading.kkm) : 75;

  return (
    <UnifiedExamScores
      key={schoolId}
      tenantSchoolId={schoolId}
      students={students}
      subjects={subjects}
      classRooms={classRooms}
      kkm={kkm}
      examInput={examInput}
      userRole={userRole}
    />
  );
}
