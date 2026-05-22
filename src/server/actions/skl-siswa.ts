"use server";

import { z } from "zod";

import { extractGoogleDriveFolderId } from "@/lib/extract-google-drive-folder-id";
import {
  isGoogleDriveSklConfigured,
  listSklNisnFromDriveFolder,
} from "@/lib/google-drive-skl";
import { prisma } from "@/lib/prisma";
import { requireTenantAdmin } from "@/server/session";

export async function updateSklDriveFolderAction(
  raw: string,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const { schoolId } = await requireTenantAdmin();
  const trimmed = raw.trim();

  if (!trimmed) {
    await prisma.school.update({
      where: { id: schoolId },
      data: { sklDriveFolderId: null },
    });
    return { ok: true };
  }

  const folderId = extractGoogleDriveFolderId(trimmed);
  if (!folderId) {
    return {
      ok: false,
      message:
        "Tautan atau ID folder tidak dikenali. Gunakan tautan folder (mis. …/drive/folders/…) atau tempel ID foldernya.",
    };
  }

  await prisma.school.update({
    where: { id: schoolId },
    data: { sklDriveFolderId: folderId },
  });
  return { ok: true };
}

export async function refreshSklFromDriveAction(): Promise<
  | {
      ok: true;
      folderId: string | null;
      driveConfigured: boolean;
      nisnWithSkl: string[];
    }
  | { ok: false; message: string }
> {
  const { schoolId } = await requireTenantAdmin();
  const school = await prisma.school.findUnique({
    where: { id: schoolId },
    select: { sklDriveFolderId: true },
  });
  const folderId = school?.sklDriveFolderId ?? null;
  const driveConfigured = isGoogleDriveSklConfigured();

  if (!folderId) {
    return { ok: true, folderId: null, driveConfigured, nisnWithSkl: [] };
  }

  if (!driveConfigured) {
    return {
      ok: false,
      message:
        "Integrasi Google Drive belum diatur di server (variabel GOOGLE_DRIVE_SKL_*). Hubungi pengelola aplikasi.",
    };
  }

  const listed = await listSklNisnFromDriveFolder(folderId);
  if (!listed.ok) return { ok: false, message: listed.message };

  return {
    ok: true,
    folderId,
    driveConfigured,
    nisnWithSkl: Array.from(listed.nisnSet),
  };
}

const sklModelSourceSchema = z.enum(["SYSTEM", "GOOGLE_DRIVE"]);

export async function saveSklModelSourceAction(
  raw: unknown,
): Promise<{ ok: true } | { ok: false; message: string }> {
  try {
    const { schoolId } = await requireTenantAdmin();
    const parsed = z.object({ sklModelSource: sklModelSourceSchema }).safeParse(raw);
    if (!parsed.success) {
      return { ok: false, message: "Data tidak valid." };
    }
    await prisma.school.update({
      where: { id: schoolId },
      data: { sklModelSource: parsed.data.sklModelSource },
    });
    return { ok: true };
  } catch (e) {
    return { ok: false, message: (e as Error).message };
  }
}

export async function saveSklIssuedAtAction(
  raw: unknown,
): Promise<{ ok: true } | { ok: false; message: string }> {
  try {
    const { schoolId } = await requireTenantAdmin();
    const parsed = z
      .object({
        sklIssuedAt: z
          .string()
          .regex(/^\d{4}-\d{2}-\d{2}$/, "Format tanggal tidak valid.")
          .nullable(),
      })
      .safeParse(raw);
    if (!parsed.success) {
      return { ok: false, message: "Tanggal SKL tidak valid." };
    }
    const dateStr = parsed.data.sklIssuedAt;
    await prisma.school.update({
      where: { id: schoolId },
      data: {
        sklIssuedAt: dateStr
          ? new Date(`${dateStr}T12:00:00.000Z`)
          : null,
      },
    });
    return { ok: true };
  } catch (e) {
    return { ok: false, message: (e as Error).message };
  }
}

export async function saveSklActiveAction(
  raw: unknown,
): Promise<{ ok: true } | { ok: false; message: string }> {
  try {
    const { schoolId } = await requireTenantAdmin();
    const parsed = z.object({ sklActive: z.boolean() }).safeParse(raw);
    if (!parsed.success) {
      return { ok: false, message: "Data tidak valid." };
    }
    await prisma.school.update({
      where: { id: schoolId },
      data: { sklActive: parsed.data.sklActive },
    });
    return { ok: true };
  } catch (e) {
    return { ok: false, message: (e as Error).message };
  }
}

