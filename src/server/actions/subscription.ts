"use server";

import { z } from "zod";

import {
  BANK_PROVIDERS,
  EWALLET_PROVIDERS,
  PREMIUM_TRIAL_DAYS,
  SUBSCRIPTION_PACKAGES,
} from "@/lib/subscription/constants";
import {
  isCloudinaryConfigured,
  uploadSubscriptionPaymentProof,
} from "@/lib/cloudinary-server";
import { prisma } from "@/lib/prisma";

import type { SchoolLevel } from "@prisma/client";
import {
  ensureSchoolSubscription,
  getSchoolAccessSnapshot,
} from "@/server/subscription-access";
import { sendSubscriptionSubmittedEmails } from "@/server/subscription-emails";
import { requireTenantAdmin } from "@/server/session";

import type { SubscriptionPlanPackage, SubscriptionTransferVia } from "@prisma/client";

const submitSchema = z.object({
  package: z.enum(["MONTHS_3", "MONTHS_6", "MONTHS_9"]),
  payerCategory: z.enum(["EWALLET", "BANK"]),
  payerProvider: z.string().min(1).max(80),
  transferVia: z.enum(["SHOPEEPAY", "SEABANK"]),
});

export type LanggananPageData = {
  schoolName: string;
  schoolJenjang: SchoolLevel | null;
  npsn: string | null;
  access: Awaited<ReturnType<typeof getSchoolAccessSnapshot>>;
  packages: typeof SUBSCRIPTION_PACKAGES;
  pendingPayment: {
    id: string;
    package: SubscriptionPlanPackage;
    status: string;
    createdAt: string;
  } | null;
  rejectedPayment: {
    package: SubscriptionPlanPackage;
    rejectNote: string | null;
    reviewedAt: string | null;
  } | null;
};

export async function getLanggananPageDataAction(): Promise<
  { ok: true; data: LanggananPageData } | { ok: false; message: string }
> {
  try {
    const { schoolId } = await requireTenantAdmin();
    const school = await prisma.school.findUnique({
      where: { id: schoolId },
      select: { namaSekolah: true, npsn: true, jenjang: true },
    });
    if (!school) return { ok: false, message: "Data sekolah tidak ditemukan." };

    const access = await getSchoolAccessSnapshot(schoolId);
    const [pending, latest] = await Promise.all([
      prisma.subscriptionPayment.findFirst({
        where: { schoolId, status: "PENDING" },
        orderBy: { createdAt: "desc" },
        select: { id: true, package: true, status: true, createdAt: true },
      }),
      prisma.subscriptionPayment.findFirst({
        where: { schoolId },
        orderBy: { createdAt: "desc" },
        select: {
          package: true,
          status: true,
          rejectNote: true,
          reviewedAt: true,
        },
      }),
    ]);

    const rejectedPayment =
      latest?.status === "REJECTED"
        ? {
            package: latest.package,
            rejectNote: latest.rejectNote,
            reviewedAt: latest.reviewedAt?.toISOString() ?? null,
          }
        : null;

    return {
      ok: true,
      data: {
        schoolName: school.namaSekolah?.trim() || "—",
        schoolJenjang: school.jenjang,
        npsn: school.npsn?.trim() || null,
        access,
        packages: SUBSCRIPTION_PACKAGES,
        pendingPayment: pending
          ? {
              id: pending.id,
              package: pending.package,
              status: pending.status,
              createdAt: pending.createdAt.toISOString(),
            }
          : null,
        rejectedPayment,
      },
    };
  } catch (e) {
    return { ok: false, message: (e as Error).message };
  }
}

export async function submitSubscriptionPaymentAction(
  formData: FormData,
): Promise<{ ok: true } | { ok: false; message: string }> {
  try {
    const { schoolId, userId } = await requireTenantAdmin();

    const parsed = submitSchema.safeParse({
      package: formData.get("package"),
      payerCategory: formData.get("payerCategory"),
      payerProvider: formData.get("payerProvider"),
      transferVia: formData.get("transferVia"),
    });
    if (!parsed.success) {
      return { ok: false, message: "Data pembayaran tidak valid." };
    }

    const pkgMeta = SUBSCRIPTION_PACKAGES.find((p) => p.package === parsed.data.package);
    if (!pkgMeta) return { ok: false, message: "Paket tidak dikenali." };

    const providerList: readonly string[] =
      parsed.data.payerCategory === "EWALLET" ? EWALLET_PROVIDERS : BANK_PROVIDERS;
    if (!providerList.includes(parsed.data.payerProvider)) {
      return { ok: false, message: "Provider pembayaran tidak valid." };
    }

    const existingPending = await prisma.subscriptionPayment.findFirst({
      where: { schoolId, status: "PENDING" },
    });
    if (existingPending) {
      return {
        ok: false,
        message: "Masih ada pengajuan pembayaran yang menunggu verifikasi.",
      };
    }

    const file = formData.get("proof");
    if (!(file instanceof File) || file.size === 0) {
      return { ok: false, message: "Unggah bukti pembayaran (foto)." };
    }
    if (!file.type.startsWith("image/")) {
      return { ok: false, message: "Bukti pembayaran harus berupa gambar (JPEG/PNG/WebP)." };
    }
    if (file.size > 3 * 1024 * 1024) {
      return { ok: false, message: "Ukuran bukti maksimal 3 MB." };
    }
    if (!isCloudinaryConfigured()) {
      return {
        ok: false,
        message: "Penyimpanan bukti belum dikonfigurasi (Cloudinary). Hubungi pengelola sistem.",
      };
    }

    const school = await prisma.school.findUnique({
      where: { id: schoolId },
      select: { namaSekolah: true, npsn: true },
    });
    if (!school) return { ok: false, message: "Data sekolah tidak ditemukan." };

    const buffer = Buffer.from(await file.arrayBuffer());
    const uploaded = await uploadSubscriptionPaymentProof({ schoolId, buffer });

    const payment = await prisma.subscriptionPayment.create({
      data: {
        schoolId,
        package: parsed.data.package,
        amountRp: pkgMeta.priceRp,
        payerCategory: parsed.data.payerCategory,
        payerProvider: parsed.data.payerProvider.trim(),
        transferVia: parsed.data.transferVia as SubscriptionTransferVia,
        proofUrl: uploaded.secureUrl,
        proofPublicId: uploaded.publicId,
        schoolNameSnapshot: school.namaSekolah?.trim() || "—",
        npsnSnapshot: school.npsn?.trim() || null,
        submittedByUserId: userId,
      },
    });

    try {
      await sendSubscriptionSubmittedEmails(payment.id);
    } catch (err) {
      console.error("[subscription-email] submit:", err);
    }

    return { ok: true };
  } catch (e) {
    return { ok: false, message: (e as Error).message };
  }
}

/** Aktifkan trial premium 3 hari (sekali per sekolah, hanya jika belum berlangganan berbayar). */
export async function startPremiumTrialAction(): Promise<
  { ok: true; endsAt: string } | { ok: false; message: string }
> {
  try {
    const { schoolId } = await requireTenantAdmin();
    const access = await getSchoolAccessSnapshot(schoolId);
    if (access.isSubscribed) {
      return { ok: false, message: "Sekolah Anda sudah berlangganan aktif." };
    }
    if (!access.canStartPremiumTrial) {
      if (access.isPremiumTrialActive) {
        return { ok: false, message: "Trial premium 3 hari sedang berjalan." };
      }
      return {
        ok: false,
        message: "Trial premium 3 hari sudah pernah digunakan untuk sekolah ini.",
      };
    }

    await ensureSchoolSubscription(schoolId);

    const now = new Date();
    const endsAt = new Date(now);
    endsAt.setUTCDate(endsAt.getUTCDate() + PREMIUM_TRIAL_DAYS);

    await prisma.schoolSubscription.update({
      where: { schoolId },
      data: {
        premiumTrialUsedAt: now,
        premiumTrialEndsAt: endsAt,
      },
    });

    return { ok: true, endsAt: endsAt.toISOString() };
  } catch (e) {
    return { ok: false, message: (e as Error).message };
  }
}
