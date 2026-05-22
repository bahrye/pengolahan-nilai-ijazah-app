"use server";

import { z } from "zod";

import type { RaporAspectMode } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { requireTenantAdmin } from "@/server/session";

const payload = z.object({
  bobotUjian: z.coerce.number().min(0).max(100),
  bobotRapor: z.coerce.number().min(0).max(100),
  kkm: z.coerce.number().min(0).max(100),
  raporAspectMode: z.enum([
    "PENGETAHUAN_ONLY",
    "KETERAMPILAN_ONLY",
    "BOTH",
  ] as const),
});

/** Menyimpan preferensi cara meratakan rapor untuk rekap ijazah. */
export async function updateRaporAspectModeAction(
  mode: "PENGETAHUAN_ONLY" | "KETERAMPILAN_ONLY" | "BOTH",
): Promise<{ ok: true } | { ok: false; message: string }> {
  try {
    const { schoolId } = await requireTenantAdmin();
    await prisma.schoolGradingConfig.upsert({
      where: { schoolId },
      create: {
        schoolId,
        raporAspectMode: mode as RaporAspectMode,
      },
      update: { raporAspectMode: mode as RaporAspectMode },
    });

    const { revalidateTag } = await import("next/cache");
    revalidateTag(`rekap-${schoolId}`, "max");

    return { ok: true };
  } catch (e) {
    return { ok: false, message: (e as Error).message };
  }
}

export async function updateGradingConfigAction(
  raw: z.infer<typeof payload>,
): Promise<{ ok: true } | { ok: false; message: string }> {
  let data: z.infer<typeof payload>;
  try {
    data = payload.parse(raw);
  } catch {
    return { ok: false, message: "Data tidak valid." };
  }
  if (Math.abs(data.bobotUjian + data.bobotRapor - 100) > 0.01) {
    return { ok: false, message: "Bobot ujian + bobot rapor harus 100%." };
  }
  try {
    const { schoolId } = await requireTenantAdmin();
    await prisma.schoolGradingConfig.upsert({
      where: { schoolId },
      create: {
        schoolId,
        bobotUjian: data.bobotUjian,
        bobotRapor: data.bobotRapor,
        kkm: data.kkm,
        raporAspectMode: data.raporAspectMode as RaporAspectMode,
      },
      update: {
        bobotUjian: data.bobotUjian,
        bobotRapor: data.bobotRapor,
        kkm: data.kkm,
        raporAspectMode: data.raporAspectMode as RaporAspectMode,
      },
    });

    const { revalidateTag } = await import("next/cache");
    revalidateTag(`rekap-${schoolId}`, "max");

    return { ok: true };
  } catch (e) {
    return { ok: false, message: (e as Error).message };
  }
}
