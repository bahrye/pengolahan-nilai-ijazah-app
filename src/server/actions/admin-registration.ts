"use server";

import bcrypt from "bcryptjs";
import { headers } from "next/headers";
import { z } from "zod";

import { clientIpFromHeaders } from "@/lib/http/client-ip";
import { enforceAdminRegistrationRateLimit } from "@/lib/login-rate-limit";
import { prisma } from "@/lib/prisma";
import {
  fetchSekolahByNpsn,
  mapNpsnPayloadToSchoolCreate,
  searchSekolahByKeyword,
} from "@/server/npsn/fetch-sekolah";
import type { NpsnSekolahPreview } from "@/server/npsn/types";
import { getPlatformMaintenance } from "@/lib/platform-maintenance";

const emailSchema = z.string().trim().email("Format email tidak valid.");
const passwordSchema = z
  .string()
  .min(8, "Sandi minimal 8 karakter.")
  .max(72, "Sandi terlalu panjang (maks. 72 karakter).");

export type NpsnLookupResult =
  | { ok: true; preview: NpsnSekolahPreview }
  | { ok: false; message: string };

export type SchoolSearchResult =
  | { ok: true; results: NpsnSekolahPreview[]; total: number }
  | { ok: false; message: string };

export async function searchSchoolAction(keywordRaw: unknown): Promise<SchoolSearchResult> {
  const k = z.string().trim().min(2, "Masukkan minimal 2 karakter.").max(120).safeParse(keywordRaw);
  if (!k.success) {
    return { ok: false, message: "Masukkan NPSN atau nama sekolah (minimal 2 karakter)." };
  }
  return searchSekolahByKeyword(k.data);
}

export async function lookupNpsnAction(npsnRaw: unknown): Promise<NpsnLookupResult> {
  const n = z.string().trim().min(1).safeParse(npsnRaw);
  if (!n.success) return { ok: false, message: "Masukkan NPSN." };

  const result = await fetchSekolahByNpsn(n.data);
  if (!result.ok) return result;

  const npsnNorm = result.preview.npsn.replace(/\D/g, "");
  const existingSchool = await prisma.school.findFirst({
    where: { npsn: npsnNorm },
    include: {
      users: {
        where: { role: "ADMIN_SEKOLAH", isActive: true },
        select: { id: true },
        take: 1,
      },
    },
  });

  if (existingSchool && existingSchool.users.length > 0) {
    return {
      ok: false,
      message:
        "Sekolah dengan NPSN ini sudah memiliki administrator aktif. Silakan login, atau hubungi superadmin jika admin sebelumnya dinonaktifkan.",
    };
  }

  return result;
}

export async function registerAdminSchoolAction(payload: unknown): Promise<
  | { ok: true }
  | { ok: false; message: string }
> {
  const maintenance = await getPlatformMaintenance();
  if (!maintenance.isRegistrationOpen) {
    return { ok: false, message: "Registrasi akun telah ditutup oleh sistem." };
  }

  const schema = z.object({
    npsn: z.string().trim().min(1),
    adminName: z.string().trim().min(2, "Nama admin minimal 2 karakter.").max(120),
    email: emailSchema,
    password: passwordSchema,
  });

  let data: z.infer<typeof schema>;
  try {
    data = schema.parse(payload);
  } catch (e) {
    const msg =
      e instanceof z.ZodError
        ? e.issues.map((i) => i.message).join(" ")
        : "Data tidak valid.";
    return { ok: false, message: msg };
  }

  const email = data.email.trim().toLowerCase();
  const npsnDigits = data.npsn.replace(/\D/g, "");

  const h = await headers();
  const rate = enforceAdminRegistrationRateLimit(email, clientIpFromHeaders(h));
  if (!rate.ok) return rate;

  const api = await fetchSekolahByNpsn(npsnDigits);
  if (!api.ok) return { ok: false, message: api.message };

  const existingUser = await prisma.user.findUnique({
    where: { email },
    include: { school: { select: { namaSekolah: true } } },
  });
  if (existingUser) {
    const schoolName = existingUser.school?.namaSekolah;
    const detail = schoolName
      ? ` di ${schoolName}`
      : "";
    return {
      ok: false,
      message: `Email ini sudah terdaftar${detail}. Silakan gunakan halaman login, atau gunakan email lain untuk mendaftar.`,
    };
  }

  const npsnNorm = api.preview.npsn.replace(/\D/g, "");
  const existingSchool = await prisma.school.findFirst({
    where: { npsn: npsnNorm },
    include: {
      users: {
        where: { role: "ADMIN_SEKOLAH", isActive: true },
        select: { id: true },
        take: 1,
      },
    },
  });

  if (existingSchool && existingSchool.users.length > 0) {
    return {
      ok: false,
      message:
        "Sekolah dengan NPSN ini sudah memiliki administrator aktif. Silakan login, atau hubungi superadmin jika admin sebelumnya dinonaktifkan.",
    };
  }

  const passwordHash = await bcrypt.hash(data.password, 12);
  const school = mapNpsnPayloadToSchoolCreate(api.preview);
  school.npsn = npsnNorm;

  try {
    await prisma.$transaction(async (tx) => {
      let schoolRecord = existingSchool;

      if (!schoolRecord) {
        schoolRecord = await tx.school.create({
          data: {
            npsn: school.npsn,
            namaSekolah: school.namaSekolah,
            ...(school.jenjang ? { jenjang: school.jenjang } : {}),
            alamat: school.alamat,
            provinsi: school.provinsi,
            tipeKabupaten: school.tipeKabupaten,
            kabupaten: school.kabupaten,
            kecamatan: school.kecamatan,
            tipeKelurahan: school.tipeKelurahan,
            kelurahan: school.kelurahan,
            namaKepsek: data.adminName.trim(),
          },
          include: {
            users: {
              where: { role: "ADMIN_SEKOLAH", isActive: true },
              select: { id: true },
              take: 1,
            },
          },
        });
      }

      const activeOnSchool = await tx.user.findFirst({
        where: {
          schoolId: schoolRecord.id,
          role: "ADMIN_SEKOLAH",
          isActive: true,
        },
        select: { id: true },
      });
      if (activeOnSchool) {
        throw new Error("Sekolah ini sudah memiliki administrator aktif.");
      }

      await tx.user.create({
        data: {
          email,
          name: data.adminName.trim(),
          passwordHash,
          role: "ADMIN_SEKOLAH",
          schoolId: schoolRecord.id,
          emailVerified: new Date(),
        },
      });

      await tx.schoolGradingConfig.upsert({
        where: { schoolId: schoolRecord.id },
        create: { schoolId: schoolRecord.id },
        update: {},
      });
    });
  } catch (e) {
    console.error(e);
    return {
      ok: false,
      message: "Gagal menyimpan data. Coba lagi atau hubungi dukungan.",
    };
  }

  return { ok: true };
}
