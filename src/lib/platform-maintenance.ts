import { prisma } from "@/lib/prisma";
import {
  datetimeLocalToUtcWib,
  formatInstantInTimeZone,
  INDONESIA_WIB_TIME_ZONE,
  isoUtcToDatetimeLocalWib,
} from "@/lib/indonesia-timezone";

export const PLATFORM_MAINTENANCE_ID = "global";

/** @deprecated Pakai {@link INDONESIA_WIB_TIME_ZONE}. */
export const WIB_IANA = INDONESIA_WIB_TIME_ZONE;

/**
 * Nilai `datetime-local` (tanpa zona) dianggap waktu Indonesia (WIB),
 * bukan zona server (UTC di Vercel).
 */
export function parseDatetimeLocalAsWib(value: string): Date | null {
  return datetimeLocalToUtcWib(value);
}

/** Untuk input `datetime-local` — selalu komponen jam/menit WIB. */
export function formatDatetimeLocalWib(isoOrDate: Date | string | null): string {
  if (isoOrDate == null) return "";
  const iso =
    typeof isoOrDate === "string" ? isoOrDate : isoOrDate.toISOString();
  return isoUtcToDatetimeLocalWib(iso);
}

export type PlatformMaintenanceState = {
  isActive: boolean;
  endsAt: Date | null;
  isRegistrationOpen: boolean;
};

/** Baca status maintenance; nonaktifkan otomatis jika sudah lewat `endsAt`. */
export async function getPlatformMaintenance(): Promise<PlatformMaintenanceState> {
  let row = await prisma.platformMaintenance.findUnique({
    where: { id: PLATFORM_MAINTENANCE_ID },
  });

  if (!row) {
    row = await prisma.platformMaintenance.create({
      data: { id: PLATFORM_MAINTENANCE_ID },
    });
  }

  const now = new Date();
  if (row.isActive && row.endsAt && row.endsAt.getTime() <= now.getTime()) {
    await prisma.platformMaintenance.update({
      where: { id: PLATFORM_MAINTENANCE_ID },
      data: { isActive: false },
    });
    return { isActive: false, endsAt: row.endsAt, isRegistrationOpen: row.isRegistrationOpen };
  }

  return { isActive: row.isActive, endsAt: row.endsAt, isRegistrationOpen: row.isRegistrationOpen };
}

export function isPlatformMaintenanceBlocking(
  state: PlatformMaintenanceState,
): boolean {
  if (!state.isActive) return false;
  if (!state.endsAt) return true;
  return state.endsAt.getTime() > Date.now();
}

/** Teks perkiraan selesai untuk halaman maintenance (zona WIB). */
export function formatMaintenanceEndsAtWib(endsAt: Date | null): string {
  return formatInstantInTimeZone(endsAt, INDONESIA_WIB_TIME_ZONE, { hour12: true });
}
