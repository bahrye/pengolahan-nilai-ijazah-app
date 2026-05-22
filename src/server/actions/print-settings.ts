"use server";

import { z } from "zod";

import { deleteCloudinaryImage, isCloudinaryConfigured, uploadSchoolLetterheadImage } from "@/lib/cloudinary-server";
import { prisma } from "@/lib/prisma";
import { requireTenantAdmin } from "@/server/session";

import type { PrintDateMode } from "@prisma/client";

const saveSchema = z.object({
  printSignaturePlace: z.string().max(160).nullable(),
  printDateMode: z.enum(["AUTO_ON_SUBMIT", "MANUAL"]),
  printManualDateIso: z.string().nullable(),
});

const allowedMime = new Set(["image/jpeg", "image/png", "image/webp"]);
const maxBytes = 3 * 1024 * 1024;

function resolveUploadedImageMime(file: File): string | null {
  const t = (file.type || "").toLowerCase().trim();
  if (allowedMime.has(t)) return t;
  const name = (file.name || "").toLowerCase();
  if (name.endsWith(".jpg") || name.endsWith(".jpeg")) return "image/jpeg";
  if (name.endsWith(".png")) return "image/png";
  if (name.endsWith(".webp")) return "image/webp";
  return null;
}

export async function savePrintSettingsAction(
  raw: unknown,
): Promise<{ ok: true } | { ok: false; message: string }> {
  try {
    const { schoolId } = await requireTenantAdmin();
    const parsed = saveSchema.safeParse(raw);
    if (!parsed.success) {
      return { ok: false, message: "Data tidak valid." };
    }
    const { printSignaturePlace, printDateMode, printManualDateIso } = parsed.data;

    let printManualDate: Date | null = null;
    if (printDateMode === "MANUAL") {
      if (!printManualDateIso?.trim()) {
        return { ok: false, message: "Mode manual wajib memilih tanggal cetak." };
      }
      const t = printManualDateIso.trim();
      const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(t);
      if (!m) {
        return { ok: false, message: "Format tanggal manual harus YYYY-MM-DD." };
      }
      const y = Number(m[1]);
      const mo = Number(m[2]) - 1;
      const d = Number(m[3]);
      const dt = new Date(y, mo, d, 12, 0, 0, 0);
      if (Number.isNaN(dt.getTime())) {
        return { ok: false, message: "Tanggal manual tidak valid." };
      }
      printManualDate = dt;
    }

    await prisma.school.update({
      where: { id: schoolId },
      data: {
        printSignaturePlace: printSignaturePlace?.trim() || null,
        printDateMode: printDateMode as PrintDateMode,
        printManualDate: printDateMode === "MANUAL" ? printManualDate : null,
      },
    });
    return { ok: true };
  } catch (e) {
    return { ok: false, message: (e as Error).message };
  }
}

export async function uploadPrintLetterheadAction(
  formData: FormData,
): Promise<{ ok: true; url: string } | { ok: false; message: string }> {
  try {
    if (!isCloudinaryConfigured()) {
      return {
        ok: false,
        message:
          "Cloudinary belum dikonfigurasi. Isi CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, dan CLOUDINARY_API_SECRET di server.",
      };
    }

    const { schoolId } = await requireTenantAdmin();
    const file = formData.get("file");
    if (!(file instanceof File)) {
      return { ok: false, message: "Tidak ada berkas yang diunggah." };
    }
    if (file.size <= 0) {
      return { ok: false, message: "Berkas kosong." };
    }
    if (file.size > maxBytes) {
      return { ok: false, message: "Ukuran gambar maksimal 3 MB." };
    }
    const mime = resolveUploadedImageMime(file);
    if (!mime) {
      return {
        ok: false,
        message:
          "Format gambar tidak dikenali. Gunakan JPEG, PNG, atau WebP (pastikan ekstensi berkas benar jika peramban tidak mengirim tipe MIME).",
      };
    }

    const buffer = Buffer.from(await file.arrayBuffer());

    const prev = await prisma.school.findUnique({
      where: { id: schoolId },
      select: { printLetterheadPublicId: true },
    });

    const { secureUrl, publicId } = await uploadSchoolLetterheadImage({
      schoolId,
      buffer,
    });

    await prisma.school.update({
      where: { id: schoolId },
      data: {
        printLetterheadUrl: secureUrl,
        printLetterheadPublicId: publicId,
      },
    });

    if (prev?.printLetterheadPublicId && prev.printLetterheadPublicId !== publicId) {
      await deleteCloudinaryImage(prev.printLetterheadPublicId);
    }

    return { ok: true, url: secureUrl };
  } catch (e) {
    return { ok: false, message: (e as Error).message };
  }
}

export async function removePrintLetterheadAction(): Promise<{ ok: true } | { ok: false; message: string }> {
  try {
    const { schoolId } = await requireTenantAdmin();
    const prev = await prisma.school.findUnique({
      where: { id: schoolId },
      select: { printLetterheadPublicId: true },
    });

    await prisma.school.update({
      where: { id: schoolId },
      data: {
        printLetterheadUrl: null,
        printLetterheadPublicId: null,
      },
    });

    if (prev?.printLetterheadPublicId) {
      await deleteCloudinaryImage(prev.printLetterheadPublicId);
    }

    return { ok: true };
  } catch (e) {
    return { ok: false, message: (e as Error).message };
  }
}
