"use server";

import { z } from "zod";

import {
  formatDatetimeLocalWib,
  formatMaintenanceEndsAtWib,
  getPlatformMaintenance,
  parseDatetimeLocalAsWib,
  PLATFORM_MAINTENANCE_ID,
} from "@/lib/platform-maintenance";
import { prisma } from "@/lib/prisma";
import { requireSuperadmin } from "@/server/session";

export type PlatformMaintenanceDto = {
  isActive: boolean;
  endsAtIso: string | null;
  /** Nilai untuk input datetime-local (komponen WIB). */
  endsAtLocalWib: string | null;
  endsAtLabelWib: string | null;
  isRegistrationOpen: boolean;
};

export async function getPlatformMaintenanceAction(): Promise<PlatformMaintenanceDto> {
  await requireSuperadmin();
  const state = await getPlatformMaintenance();
  return {
    isActive: state.isActive,
    endsAtIso: state.endsAt?.toISOString() ?? null,
    endsAtLocalWib: state.endsAt ? formatDatetimeLocalWib(state.endsAt) : null,
    endsAtLabelWib: state.endsAt ? formatMaintenanceEndsAtWib(state.endsAt) : null,
    isRegistrationOpen: state.isRegistrationOpen,
  };
};

const setSchema = z.object({
  isActive: z.boolean(),
  /** Nilai datetime-local; diinterpretasikan sebagai WIB (UTC+7). */
  endsAtLocal: z.string().optional(),
  isRegistrationOpen: z.boolean().optional(),
});

export async function setPlatformMaintenanceAction(
  raw: z.infer<typeof setSchema>,
): Promise<{ ok: true; data: PlatformMaintenanceDto } | { ok: false; message: string }> {
  await requireSuperadmin();
  const parsed = setSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, message: "Data tidak valid." };
  }

  const { isActive, endsAtLocal, isRegistrationOpen } = parsed.data;
  let endsAt: Date | null = null;

  if (isActive) {
    const trimmed = endsAtLocal?.trim() ?? "";
    if (!trimmed) {
      return {
        ok: false,
        message: "Isi waktu perkiraan selesai maintenance sebelum mengaktifkan.",
      };
    }
    const parsedDate = parseDatetimeLocalAsWib(trimmed);
    if (!parsedDate) {
      return { ok: false, message: "Format waktu selesai tidak valid." };
    }
    if (parsedDate.getTime() <= Date.now()) {
      return {
        ok: false,
        message: "Waktu selesai harus di masa depan.",
      };
    }
    endsAt = parsedDate;
  }

  await prisma.platformMaintenance.upsert({
    where: { id: PLATFORM_MAINTENANCE_ID },
    create: {
      id: PLATFORM_MAINTENANCE_ID,
      isActive,
      endsAt,
      isRegistrationOpen: isRegistrationOpen ?? true,
    },
    update: {
      isActive,
      endsAt: isActive ? endsAt : undefined,
      ...(isRegistrationOpen !== undefined ? { isRegistrationOpen } : {}),
    },
  });

  const state = await getPlatformMaintenance();
  return {
    ok: true,
    data: {
      isActive: state.isActive,
      endsAtIso: state.endsAt?.toISOString() ?? null,
      endsAtLocalWib: state.endsAt ? formatDatetimeLocalWib(state.endsAt) : null,
      endsAtLabelWib: state.endsAt ? formatMaintenanceEndsAtWib(state.endsAt) : null,
      isRegistrationOpen: state.isRegistrationOpen,
    },
  };
}
