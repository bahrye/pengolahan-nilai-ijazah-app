import { listAcademicYearsAction, listTeachersForSchoolAction } from "@/server/actions/akademik";

import { KelasClient } from "./KelasClient";

export default async function KelasPage() {
  const [years, teachers] = await Promise.all([
    listAcademicYearsAction(),
    listTeachersForSchoolAction(),
  ]);
  const opts = years.map((y) => ({ id: y.id, label: y.label }));

  if (opts.length === 0) {
    return (
      <p className="rounded border border-amber-200 bg-amber-50 p-4 text-sm dark:border-amber-900 dark:bg-amber-950/40">
        Belum ada tahun ajaran — buat dulu dari menu Tahun Ajaran.
      </p>
    );
  }

  return (
    <KelasClient
      years={opts}
      teachers={teachers.map((t) => ({ id: t.id, nama: t.nama }))}
    />
  );
}
