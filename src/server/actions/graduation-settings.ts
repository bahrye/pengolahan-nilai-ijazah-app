"use server";

import { z } from "zod";

import { prisma } from "@/lib/prisma";
import { requireTenantAdmin } from "@/server/session";

const saveSchema = z.object({
  graduationAnnouncementAtIso: z.string().nullable(),
  ijazahRekapVisibility: z.enum(["AT_ANNOUNCEMENT_TIME", "AFTER_CHECK_ANNOUNCEMENT"]),
});

export async function saveGraduationSettingsAction(
  raw: unknown,
): Promise<{ ok: true } | { ok: false; message: string }> {
  try {
    const { schoolId } = await requireTenantAdmin();
    const parsed = saveSchema.safeParse(raw);
    if (!parsed.success) {
      return { ok: false, message: "Data tidak valid." };
    }
    const { graduationAnnouncementAtIso, ijazahRekapVisibility } = parsed.data;
    let graduationAnnouncementAt: Date | null = null;
    if (graduationAnnouncementAtIso && graduationAnnouncementAtIso.trim() !== "") {
      const d = new Date(graduationAnnouncementAtIso);
      if (Number.isNaN(d.getTime())) {
        return { ok: false, message: "Tanggal/waktu pengumuman tidak valid." };
      }
      graduationAnnouncementAt = d;
    }

    await prisma.school.update({
      where: { id: schoolId },
      data: {
        graduationAnnouncementAt,
        ijazahRekapVisibility,
        /** Sama dengan tampilan rekap ijazah — akses unduh SKL siswa mengikuti pengaturan ini. */
        sklDownloadVisibility: ijazahRekapVisibility,
      },
    });
    return { ok: true };
  } catch (e) {
    return { ok: false, message: (e as Error).message };
  }
}
