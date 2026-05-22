"use server";

import { z } from "zod";

import { deleteCloudinaryImage } from "@/lib/cloudinary-server";
import { quotaAllowanceDecrement } from "@/lib/subscription/periods";
import { prisma } from "@/lib/prisma";
import {
  applyApprovedSubscriptionPayment,
  syncSubscriptionEndsAt,
} from "@/server/subscription-periods";
import {
  sendSubscriptionApprovedEmail,
  sendSubscriptionRejectedEmail,
} from "@/server/subscription-emails";
import { requireSuperadmin } from "@/server/session";

export async function listPendingSubscriptionPaymentsAction() {
  await requireSuperadmin();
  return prisma.subscriptionPayment.findMany({
    where: { status: "PENDING" },
    orderBy: { createdAt: "asc" },
    include: {
      school: { select: { namaSekolah: true, schoolCode: true } },
    },
  });
}

export async function listSubscriptionPaymentsTableAction() {
  await requireSuperadmin();
  const rows = await prisma.subscriptionPayment.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      school: {
        select: {
          namaSekolah: true,
          npsn: true,
          subscription: {
            select: {
              subscriptionEndsAt: true,
              studentQuotaAllowance: true,
              studentAddsUsed: true,
              activePackage: true,
            },
          },
        },
      },
    },
  });
  return rows.map((r) => ({
    id: r.id,
    schoolId: r.schoolId,
    schoolName: r.school.namaSekolah ?? r.schoolNameSnapshot,
    npsn: r.npsnSnapshot ?? r.school.npsn,
    package: r.package,
    amountRp: r.amountRp,
    payerCategory: r.payerCategory,
    payerProvider: r.payerProvider,
    transferVia: r.transferVia,
    status: r.status,
    proofUrl: r.proofUrl,
    proofPublicId: r.proofPublicId,
    rejectNote: r.rejectNote,
    createdAt: r.createdAt.toISOString(),
    reviewedAt: r.reviewedAt?.toISOString() ?? null,
    subscriptionEndsAt:
      r.school.subscription?.subscriptionEndsAt?.toISOString() ?? null,
    studentQuotaAllowance: r.school.subscription?.studentQuotaAllowance ?? 150,
    studentAddsUsed: r.school.subscription?.studentAddsUsed ?? 0,
    activePackage: r.school.subscription?.activePackage ?? null,
  }));
}

export async function deleteSubscriptionPaymentAction(
  paymentId: string,
): Promise<{ ok: true } | { ok: false; message: string }> {
  try {
    await requireSuperadmin();
    const payment = await prisma.subscriptionPayment.findUnique({
      where: { id: paymentId },
      include: { period: true },
    });
    if (!payment) return { ok: false, message: "Data pembayaran tidak ditemukan." };

    const sub = await prisma.schoolSubscription.findUnique({
      where: { schoolId: payment.schoolId },
    });

    await prisma.$transaction(async (tx) => {
      if (payment.period) {
        await tx.schoolSubscriptionPeriod.delete({
          where: { id: payment.period.id },
        });
        if (sub && payment.status === "APPROVED") {
          const nextAllowance = quotaAllowanceDecrement(
            sub.studentQuotaAllowance,
            payment.package,
          );
          await tx.schoolSubscription.update({
            where: { schoolId: payment.schoolId },
            data: { studentQuotaAllowance: nextAllowance },
          });
        }
      }
      await tx.subscriptionPayment.delete({ where: { id: paymentId } });
    });

    if (payment.status === "APPROVED") {
      await syncSubscriptionEndsAt(payment.schoolId);
    }

    await deleteCloudinaryImage(payment.proofPublicId);

    return { ok: true };
  } catch (e) {
    return { ok: false, message: (e as Error).message };
  }
}

const reviewSchema = z.object({
  paymentId: z.string().min(1),
  rejectNote: z.string().optional(),
});

export async function approveSubscriptionPaymentAction(
  paymentId: string,
): Promise<{ ok: true } | { ok: false; message: string }> {
  try {
    const session = await requireSuperadmin();
    const userId = session.user.id;
    const payment = await prisma.subscriptionPayment.findUnique({
      where: { id: paymentId },
    });
    if (!payment) return { ok: false, message: "Pengajuan tidak ditemukan." };
    if (payment.status !== "PENDING") {
      return { ok: false, message: "Pengajuan sudah diproses." };
    }

    await prisma.subscriptionPayment.update({
      where: { id: payment.id },
      data: {
        status: "APPROVED",
        reviewedAt: new Date(),
        reviewedByUserId: userId,
      },
    });

    await applyApprovedSubscriptionPayment(
      payment.schoolId,
      payment.id,
      payment.package,
    );

    try {
      await sendSubscriptionApprovedEmail(payment.id);
    } catch (err) {
      console.error("[subscription-email] approve:", err);
    }

    return { ok: true };
  } catch (e) {
    return { ok: false, message: (e as Error).message };
  }
}

export async function rejectSubscriptionPaymentAction(
  raw: z.infer<typeof reviewSchema>,
): Promise<{ ok: true } | { ok: false; message: string }> {
  try {
    const session = await requireSuperadmin();
    const userId = session.user.id;
    const parsed = reviewSchema.safeParse(raw);
    if (!parsed.success) return { ok: false, message: "Data tidak valid." };

    const payment = await prisma.subscriptionPayment.findUnique({
      where: { id: parsed.data.paymentId },
    });
    if (!payment) return { ok: false, message: "Pengajuan tidak ditemukan." };
    if (payment.status !== "PENDING") {
      return { ok: false, message: "Pengajuan sudah diproses." };
    }

    await prisma.subscriptionPayment.update({
      where: { id: payment.id },
      data: {
        status: "REJECTED",
        reviewedAt: new Date(),
        reviewedByUserId: userId,
        rejectNote: parsed.data.rejectNote?.trim() || null,
      },
    });

    try {
      await sendSubscriptionRejectedEmail(payment.id);
    } catch (err) {
      console.error("[subscription-email] reject:", err);
    }

    return { ok: true };
  } catch (e) {
    return { ok: false, message: (e as Error).message };
  }
}
