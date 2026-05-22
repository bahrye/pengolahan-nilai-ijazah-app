"use server";

import { KabupatenType, KelurahanType, SchoolLevel } from "@prisma/client";
import { z } from "zod";

import { schoolLevelSchema } from "@/domain/school-levels";
import { prisma } from "@/lib/prisma";
import { requirePlatformSchoolAdmin } from "@/server/session";

const schoolPayload = z.object({
  jenjang: schoolLevelSchema,
  namaSekolah: z.string().min(1),
  npsn: z.string().optional().nullable(),
  nsm: z.string().optional().nullable(),
  alamat: z.string().optional().nullable(),
  provinsi: z.string().min(1),
  tipeKabupaten: z.enum(["Kabupaten", "Kota"]).default("Kabupaten"),
  kabupaten: z.string().min(1),
  kecamatan: z.string().min(1),
  tipeKelurahan: z.enum(["Kelurahan", "Desa"]).default("Kelurahan"),
  kelurahan: z.string().min(1),
  kodePos: z.string().optional().nullable(),
  telepon: z.string().optional().nullable(),
  email: z.string().optional().nullable(),
  website: z.string().optional().nullable(),
  namaKepsek: z.string().min(1),
  nipKepsek: z.string().optional().nullable(),
  raporSemesterCount: z.coerce.number().int(),
});

function numOnly(s: string | null | undefined) {
  if (!s) return true;
  return /^\d+$/.test(s.trim());
}

export async function upsertSchoolDataForm(
  raw: z.infer<typeof schoolPayload>,
): Promise<{ ok: true } | { ok: false; message: string }> {
  let data: z.infer<typeof schoolPayload>;
  try {
    data = schoolPayload.parse(raw);
  } catch {
    return { ok: false, message: "Data tidak valid atau tidak lengkap." };
  }

  if (data.npsn && !numOnly(data.npsn))
    return { ok: false, message: "NPSN harus berupa angka." };
  if (data.nsm && !numOnly(data.nsm))
    return { ok: false, message: "NSM harus berupa angka." };
  const em = typeof data.email === "string" ? data.email.trim() : "";
  if (em !== "" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(em))
    return { ok: false, message: "Format email sekolah tidak valid." };

  let raporCount = data.raporSemesterCount;
  
  const jenjangSD = ["MI", "SD", "SDLB"];
  const jenjangSMPSMA = ["MTS", "SMP", "SMPLB", "MA", "SMA", "SMALB", "SMK", "SLB", "PKBM"];

  if (jenjangSD.includes(data.jenjang as string)) {
    if (![3, 4, 5, 6].includes(raporCount))
      return { ok: false, message: "Untuk SD/MI sederajat, semester rapor hanya 3, 4, 5, atau 6." };
  } else if (jenjangSMPSMA.includes(data.jenjang as string)) {
    if (![5, 6].includes(raporCount))
      return { ok: false, message: "Untuk SMP/SMA sederajat, semester rapor hanya 5 atau 6." };
  } else {
    raporCount = 5;
  }

  try {
    const { userId } = await requirePlatformSchoolAdmin();

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) return { ok: false, message: "Pengguna tidak ditemukan." };

    await prisma.$transaction(async (tx) => {
      let schoolId = user.schoolId;
      const existingSchool = schoolId
        ? await tx.school.findUnique({
            where: { id: schoolId },
            select: { jenjang: true, npsn: true },
          })
        : null;

      const lockedJenjang = existingSchool?.jenjang ?? data.jenjang;
      const lockedNpsn = existingSchool?.npsn ?? (data.npsn?.trim() || null);
      const isLockedSD = jenjangSD.includes(lockedJenjang as string);
      const isLockedSMPSMA = jenjangSMPSMA.includes(lockedJenjang as string);
      const effectiveRaporCount = isLockedSD || isLockedSMPSMA ? raporCount : 5;

      const schoolCore = {
        jenjang: lockedJenjang as SchoolLevel,
        namaSekolah: data.namaSekolah.trim(),
        npsn: lockedNpsn,
        nsm: data.nsm?.trim() || null,
        alamat: data.alamat?.trim() || null,
        provinsi: data.provinsi.trim(),
        tipeKabupaten: data.tipeKabupaten as KabupatenType,
        kabupaten: data.kabupaten.trim(),
        kecamatan: data.kecamatan.trim(),
        tipeKelurahan: data.tipeKelurahan as KelurahanType,
        kelurahan: data.kelurahan.trim(),
        kodePos: data.kodePos?.trim() || null,
        telepon: data.telepon?.trim() || null,
        email: em === "" ? null : em.toLowerCase(),
        website: data.website?.trim() || null,
        namaKepsek: data.namaKepsek.trim(),
        nipKepsek: (() => {
          const nipRaw = data.nipKepsek?.trim();
          return nipRaw ? nipRaw.replace(/^'+/, "").replace(/^`+/, "") : null;
        })(),
        raporSemesterCount: effectiveRaporCount,
      };

      if (!schoolId) {
        const school = await tx.school.create({ data: schoolCore });
        schoolId = school.id;
        await tx.schoolGradingConfig.create({ data: { schoolId } });
        await tx.user.update({
          where: { id: userId },
          data: { schoolId },
        });
      } else {
        await tx.school.update({ where: { id: schoolId }, data: schoolCore });
      }
    });

    const finalSchoolId = user.schoolId;
    if (finalSchoolId) {
      const { revalidateTag } = await import("next/cache");
      revalidateTag(`rekap-${finalSchoolId}`, "max");
    }

    return { ok: true };
  } catch (e) {
    return { ok: false, message: (e as Error).message };
  }
}
