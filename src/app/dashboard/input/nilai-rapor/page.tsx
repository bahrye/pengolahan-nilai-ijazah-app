import { redirect } from "next/navigation";

import { RaporBulkScores } from "@/components/grades/RaporBulkScores";
import {
  loadGradingAspectMode,
  loadRaporPageMaster,
  loadRaporSemesterOptions,
} from "@/server/grade-page-data";
import { requireUserSchoolId } from "@/server/session";

export default async function NilaiRaporPage() {
  const { role, schoolId } = await requireUserSchoolId();

  if (role === "GURU") {
    const canAccess = await import("@/server/grade-page-data").then((m) =>
      m.guruIsHomeroom(),
    );
    if (!canAccess) redirect("/dashboard/input/nilai-ujian");
  }

  const [{ students, subjects, classRooms }, semesterOptions, aspect] = await Promise.all([
    loadRaporPageMaster(),
    loadRaporSemesterOptions(),
    loadGradingAspectMode(),
  ]);

  if (semesterOptions.length === 0) {
    return (
      <div className="mx-auto max-w-xl">
        <h1 className="ui-page-title mb-4">Nilai rapor bulk</h1>
        <div className="ui-alert ui-alert-warn space-y-2 leading-relaxed">
          <span className="font-bold text-amber-950 dark:text-amber-100">
            Belum seed semester.
          </span>
          <p className="mt-2 text-[13px] leading-relaxed text-amber-900/90 dark:text-amber-50/95">
            Data semester belum di-generate. Buka menu{" "}
            <strong>Data Semester</strong> dan klik tombol{" "}
            <strong>&quot;Seed dari jenjang&quot;</strong> untuk menghasilkan
            semester sesuai jenjang sekolah Anda.
          </p>
        </div>
      </div>
    );
  }

  return (
    <RaporBulkScores
      key={schoolId}
      students={students}
      subjects={subjects}
      semesterOptions={semesterOptions}
      initialAspectStored={aspect}
      classRooms={classRooms}
    />
  );
}
