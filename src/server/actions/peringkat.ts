"use server";

import { runRekapForSchool } from "@/lib/rekap-service";
import { requireTenantAdmin } from "@/server/session";

export type PeringkatItem = {
  nisn: string;
  nama: string;
  rataRata: number;
};

export type PeringkatData = {
  ijazah: PeringkatItem[];
  ujian: PeringkatItem[];
  rapor: PeringkatItem[];
};

export async function getPeringkatKelasAction(classRoomId: string): Promise<{ ok: true; data: PeringkatData } | { ok: false; message: string }> {
  try {
    const { schoolId } = await requireTenantAdmin();
    
    // We pass homeroomClassRoomIds: [classRoomId] to only compute for this specific class.
    const computed = await runRekapForSchool(schoolId, { homeroomClassRoomIds: [classRoomId] });
    
    const mapToPeringkat = (rows: typeof computed.rowsIjazah) => {
      return rows
        .map(row => ({
          nisn: row.nisn,
          nama: row.nama,
          rataRata: row.rataRataNumeric,
        }))
        .sort((a, b) => {
          if (b.rataRata === a.rataRata) {
            return a.nama.localeCompare(b.nama, "id");
          }
          return b.rataRata - a.rataRata;
        });
    };

    const data: PeringkatData = {
      ijazah: mapToPeringkat(computed.rowsIjazah),
      ujian: mapToPeringkat(computed.rowsUjian),
      rapor: mapToPeringkat(computed.rowsRapor),
    };

    return { ok: true, data };
  } catch (e) {
    return { ok: false, message: (e as Error).message };
  }
}
