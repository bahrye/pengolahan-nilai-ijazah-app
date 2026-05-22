import { unstable_cache } from "next/cache";

import { runRekapForSchool } from "./rekap-service";

/**
 * Mendapatkan hasil kalkulasi penuh rekapitulasi nilai satu sekolah dan
 * menyimpannya di cache secara persisten. Invalidate cache dilakukan
 * dengan `revalidateTag("rekap", "max")` setiap kali ada input nilai baru.
 */
export const getCachedFullRekapForSchool = async (schoolId: string) => {
  const fetcher = unstable_cache(
    async () => {
      return await runRekapForSchool(schoolId);
    },
    ["rekap-full-data", schoolId],
    {
      revalidate: 3600 * 24 * 7, // 1 minggu
      tags: [`rekap-${schoolId}`],
    }
  );
  return await fetcher();
};
