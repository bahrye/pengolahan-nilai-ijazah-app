import { SUBSCRIPTION_PACKAGES } from "@/lib/subscription/constants";
import { sendEmail } from "@/lib/email/mailer";
import { getSchoolAdminEmails, getSuperadminEmails } from "@/lib/email/recipients";
import {
  buildSubscriptionInvoicePdfBuffer,
  invoiceFilename,
} from "@/lib/subscription/subscription-invoice-pdf";
import { prisma } from "@/lib/prisma";

import type { SubscriptionPlanPackage } from "@prisma/client";

function appUrl(): string {
  return (process.env.NEXTAUTH_URL ?? "http://localhost:3000").replace(/\/$/, "");
}

function packageLabel(pkg: SubscriptionPlanPackage): string {
  return SUBSCRIPTION_PACKAGES.find((p) => p.package === pkg)?.label ?? pkg;
}

function formatRp(n: number): string {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(n);
}

function invoiceNumberFromId(paymentId: string): string {
  return `INV-${paymentId.slice(-8).toUpperCase()}`;
}

async function loadPayment(paymentId: string) {
  return prisma.subscriptionPayment.findUnique({
    where: { id: paymentId },
    include: {
      school: {
        select: {
          namaSekolah: true,
          npsn: true,
          subscription: { select: { subscriptionEndsAt: true } },
        },
      },
    },
  });
}

function emailShell(title: string, bodyHtml: string): string {
  return `
<!DOCTYPE html>
<html lang="id">
<body style="font-family:Segoe UI,Helvetica,Arial,sans-serif;line-height:1.5;color:#1e293b;max-width:560px;margin:0 auto;padding:24px">
  <h2 style="color:#4f46e5;margin:0 0 16px">${title}</h2>
  ${bodyHtml}
  <p style="margin-top:24px;font-size:12px;color:#64748b">
    Email otomatis dari Sistem Nilai Ijazah. Jangan balas email ini jika tidak diperlukan.
  </p>
</body>
</html>`;
}

/** Admin sekolah: konfirmasi pengajuan terkirim. */
export async function sendSubscriptionSubmittedEmails(
  paymentId: string,
): Promise<void> {
  const payment = await loadPayment(paymentId);
  if (!payment) return;

  const schoolName = payment.school.namaSekolah ?? payment.schoolNameSnapshot;
  const pkg = packageLabel(payment.package);
  const amount = formatRp(payment.amountRp);
  const langgananUrl = `${appUrl()}/dashboard/langganan`;

  const [adminEmails, superadminEmails] = await Promise.all([
    getSchoolAdminEmails(payment.schoolId, payment.submittedByUserId),
    getSuperadminEmails(),
  ]);

  if (adminEmails.length > 0) {
    try {
      await sendEmail({
        to: adminEmails,
        subject: `[Sistem Nilai Ijazah] Pengajuan langganan diterima — menunggu verifikasi`,
        html: emailShell(
          "Pengajuan langganan berhasil dikirim",
          `
        <p>Halo,</p>
        <p>Pengajuan langganan untuk <strong>${schoolName}</strong> telah kami terima dan sedang menunggu verifikasi superadmin.</p>
        <ul>
          <li><strong>Paket:</strong> ${pkg}</li>
          <li><strong>Nominal:</strong> ${amount}</li>
          <li><strong>Status:</strong> Menunggu verifikasi</li>
        </ul>
        <p><a href="${langgananUrl}" style="color:#4f46e5">Buka halaman Langganan</a> untuk melihat status terbaru.</p>
        `,
        ),
      });
    } catch (err) {
      console.error("[subscription-email] submit admin sekolah:", err);
    }
  }

  if (superadminEmails.length === 0) {
    console.warn(
      "[subscription-email] submit: tidak ada penerima superadmin (SUPERADMIN_EMAILS / user SUPERADMIN).",
    );
    return;
  }

  try {
    await sendEmail({
      to: superadminEmails,
      subject: `[Superadmin] Pengajuan langganan baru — ${schoolName}`,
      html: emailShell(
        "Pengajuan langganan baru",
        `
        <p>Ada pengajuan langganan baru yang perlu diverifikasi.</p>
        <ul>
          <li><strong>Sekolah:</strong> ${schoolName}</li>
          <li><strong>NPSN:</strong> ${payment.npsnSnapshot ?? payment.school.npsn ?? "—"}</li>
          <li><strong>Paket:</strong> ${pkg}</li>
          <li><strong>Nominal:</strong> ${amount}</li>
        </ul>
        <p><a href="${appUrl()}/superadmin" style="color:#4f46e5">Buka panel Superadmin</a></p>
        `,
      ),
    });
  } catch (err) {
    console.error("[subscription-email] submit superadmin:", err);
  }
}

/** Admin sekolah: disetujui + invoice PDF. */
export async function sendSubscriptionApprovedEmail(
  paymentId: string,
): Promise<void> {
  const payment = await loadPayment(paymentId);
  if (!payment || payment.status !== "APPROVED") return;

  const adminEmails = await getSchoolAdminEmails(
    payment.schoolId,
    payment.submittedByUserId,
  );
  if (adminEmails.length === 0) return;

  const schoolName = payment.school.namaSekolah ?? payment.schoolNameSnapshot;
  const pkg = packageLabel(payment.package);
  const amount = formatRp(payment.amountRp);
  const invNo = invoiceNumberFromId(payment.id);
  const endsAt = payment.school.subscription?.subscriptionEndsAt;

  const approvedAt = payment.reviewedAt ?? new Date();
  const pdf = buildSubscriptionInvoicePdfBuffer({
    invoiceNumber: invNo,
    schoolName,
    npsn: payment.npsnSnapshot ?? payment.school.npsn,
    package: payment.package,
    amountRp: payment.amountRp,
    payerCategory: payment.payerCategory,
    payerProvider: payment.payerProvider,
    transferVia: payment.transferVia,
    paidAt: payment.createdAt,
    approvedAt,
    subscriptionEndsAt: endsAt ?? null,
  });

  await sendEmail({
    to: adminEmails,
    subject: `[Sistem Nilai Ijazah] Langganan disetujui — Invoice ${invNo} (Lunas)`,
    html: emailShell(
      "Langganan disetujui",
      `
      <p>Halo,</p>
      <p>Pengajuan langganan <strong>${pkg}</strong> untuk <strong>${schoolName}</strong> telah <strong style="color:#059669">DISETUJUI</strong>.</p>
      <ul>
        <li><strong>Nominal:</strong> ${amount} — <strong>LUNAS</strong></li>
        <li><strong>No. Invoice:</strong> ${invNo}</li>
        ${
          endsAt
            ? `<li><strong>Langganan aktif sampai:</strong> ${endsAt.toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })}</li>`
            : ""
        }
      </ul>
      <p>Invoice PDF terlampir pada email ini.</p>
      <p><a href="${appUrl()}/dashboard/langganan" style="color:#4f46e5">Buka halaman Langganan</a></p>
      `,
    ),
    attachments: [
      {
        filename: invoiceFilename(schoolName, invNo),
        content: pdf,
        contentType: "application/pdf",
      },
    ],
  });
}

/** Admin sekolah: ditolak + alasan. */
export async function sendSubscriptionRejectedEmail(
  paymentId: string,
): Promise<void> {
  const payment = await loadPayment(paymentId);
  if (!payment || payment.status !== "REJECTED") return;

  const adminEmails = await getSchoolAdminEmails(
    payment.schoolId,
    payment.submittedByUserId,
  );
  if (adminEmails.length === 0) return;

  const schoolName = payment.school.namaSekolah ?? payment.schoolNameSnapshot;
  const pkg = packageLabel(payment.package);
  const reason =
    payment.rejectNote?.trim() ||
    "Tidak ada catatan tambahan dari superadmin.";

  await sendEmail({
    to: adminEmails,
    subject: `[Sistem Nilai Ijazah] Pengajuan langganan ditolak`,
    html: emailShell(
      "Pengajuan langganan ditolak",
      `
      <p>Halo,</p>
      <p>Pengajuan langganan <strong>${pkg}</strong> untuk <strong>${schoolName}</strong> <strong style="color:#dc2626">ditolak</strong>.</p>
      <p><strong>Alasan penolakan:</strong></p>
      <p style="background:#fef2f2;border-left:4px solid #dc2626;padding:12px 16px;border-radius:4px">${reason}</p>
      <p>Silakan perbaiki bukti/nominal lalu ajukan kembali melalui halaman Langganan.</p>
      <p><a href="${appUrl()}/dashboard/langganan" style="color:#4f46e5">Buka halaman Langganan</a></p>
      `,
    ),
  });
}
