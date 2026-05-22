import { listAcademicYearsAction } from "@/server/actions/akademik";

import { SemesterClient } from "./SemesterClient";

export default async function SemesterPage() {
  const years = await listAcademicYearsAction();
  const opts = years.map((y) => ({ id: y.id, label: y.label }));

  if (opts.length === 0) {
    return (
      <p className="rounded border border-amber-200 bg-amber-50 p-4 text-sm dark:border-amber-900 dark:bg-amber-950/40">
        Belum ada tahun ajaran — buat dulu dari menu Tahun Ajaran.
      </p>
    );
  }

  return (
    <>
      <h2 className="mb-4 text-lg font-bold text-[#1e3a8a] dark:text-blue-400">
        Data semester
      </h2>
      <SemesterClient years={opts} />
    </>
  );
}
