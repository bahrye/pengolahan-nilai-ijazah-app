import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

import { SUBSCRIPTION_PACKAGES } from "@/lib/subscription/constants";
import { packageMonths } from "@/lib/subscription/periods";

import type { SubscriptionPlanPackage } from "@prisma/client";

export type SubscriptionInvoiceData = {
  invoiceNumber: string;
  schoolName: string;
  npsn: string | null;
  package: SubscriptionPlanPackage;
  amountRp: number;
  payerCategory: string;
  payerProvider: string;
  transferVia: string;
  paidAt: Date;
  approvedAt: Date;
  subscriptionEndsAt: Date | null;
};

function formatRp(n: number): string {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(n);
}

function formatDate(d: Date): string {
  return d.toLocaleDateString("id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export function buildSubscriptionInvoicePdfBuffer(
  data: SubscriptionInvoiceData,
): Buffer {
  const pkgMeta = SUBSCRIPTION_PACKAGES.find((p) => p.package === data.package);
  const pkgLabel = pkgMeta?.label ?? data.package;
  const months = packageMonths(data.package);

  const doc = new jsPDF({ unit: "mm", format: "a4", compress: true });
  const margin = 18;
  let y = margin;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.text("INVOICE / FAKTUR", margin, y);
  y += 8;

  doc.setFontSize(11);
  doc.setFont("helvetica", "normal");
  doc.text("Sistem Nilai Ijazah — Langganan Sekolah", margin, y);
  y += 10;

  doc.setFont("helvetica", "bold");
  doc.text(`No. Invoice: ${data.invoiceNumber}`, margin, y);
  y += 6;
  doc.setFont("helvetica", "normal");
  doc.text(`Tanggal invoice: ${formatDate(data.approvedAt)}`, margin, y);
  y += 6;
  doc.text(`Status pembayaran: LUNAS`, margin, y);
  y += 10;

  doc.setFont("helvetica", "bold");
  doc.text("Pembeli", margin, y);
  y += 6;
  doc.setFont("helvetica", "normal");
  doc.text(data.schoolName, margin, y);
  y += 5;
  if (data.npsn) {
    doc.text(`NPSN: ${data.npsn}`, margin, y);
    y += 5;
  }
  y += 6;

  autoTable(doc, {
    startY: y,
    margin: { left: margin, right: margin },
    head: [["Deskripsi", "Periode", "Jumlah"]],
    body: [
      [
        `Langganan ${pkgLabel}`,
        `${months} bulan`,
        formatRp(data.amountRp),
      ],
    ],
    styles: { fontSize: 10, cellPadding: 3 },
    headStyles: { fillColor: [79, 70, 229], textColor: 255 },
  });

  const docWithTable = doc as jsPDF & { lastAutoTable?: { finalY: number } };
  y = (docWithTable.lastAutoTable?.finalY ?? y) + 10;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text(`Total dibayar: ${formatRp(data.amountRp)}`, margin, y);
  y += 10;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text(
    `Metode: ${data.payerCategory} — ${data.payerProvider} (transfer ${data.transferVia})`,
    margin,
    y,
  );
  y += 5;
  doc.text(`Tanggal pengajuan: ${formatDate(data.paidAt)}`, margin, y);
  y += 5;
  doc.text(`Tanggal disetujui: ${formatDate(data.approvedAt)}`, margin, y);
  y += 5;
  if (data.subscriptionEndsAt) {
    doc.text(
      `Langganan aktif sampai: ${formatDate(data.subscriptionEndsAt)}`,
      margin,
      y,
    );
    y += 5;
  }

  y += 8;
  doc.setFontSize(9);
  doc.setTextColor(100);
  doc.text(
    "Dokumen ini diterbitkan otomatis setelah verifikasi pembayaran oleh superadmin.",
    margin,
    y,
  );
  doc.setTextColor(0);

  const arrayBuffer = doc.output("arraybuffer");
  return Buffer.from(arrayBuffer);
}

export function invoiceFilename(schoolName: string, invoiceNumber: string): string {
  const safe = schoolName
    .replace(/[^a-z0-9-_ ]/gi, "")
    .trim()
    .replace(/\s+/g, "_")
    .slice(0, 40);
  return `Invoice-Langganan-${safe || "Sekolah"}-${invoiceNumber}.pdf`;
}
