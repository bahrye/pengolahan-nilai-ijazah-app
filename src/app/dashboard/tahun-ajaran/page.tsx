import { listAcademicYearsAction } from "@/server/actions/akademik";
import { requireTenantAdmin } from "@/server/session";
import { getSchoolAccessSnapshot } from "@/server/subscription-access";

import { TahunClient } from "./TahunClient";

export default async function TahunAjaranPage() {
  const { schoolId } = await requireTenantAdmin();
  const [years, access] = await Promise.all([
    listAcademicYearsAction(),
    getSchoolAccessSnapshot(schoolId),
  ]);
  return (
    <>
      <h2 className="mb-4 text-lg font-bold text-[#1e3a8a] dark:text-blue-400">
        Tahun ajaran
      </h2>
      <TahunClient years={years} canAddYear={access.canAddAcademicYear} />
    </>
  );
}
