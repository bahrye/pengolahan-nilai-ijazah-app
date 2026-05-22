import { jsPDF } from "jspdf";

export type TeacherLoginCardPdfRow = {
  nama: string;
  email: string;
  password: string;
  wasReset: boolean;
};

/**
 * Membuat PDF kartu login untuk banyak guru (unduh / simpan di perangkat pengguna).
 */
export function buildTeacherLoginCardsPdfBlob(params: {
  schoolName?: string;
  exportedAtLabel: string;
  loginUrl: string;
  cards: TeacherLoginCardPdfRow[];
  errors: string[];
}): Blob {
  const doc = new jsPDF({ unit: "mm", format: "a4", compress: true });
  const margin = 16;
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const maxW = pageW - margin * 2;
  let y = margin;

  const newPageIfNeeded = (needMm: number) => {
    if (y + needMm > pageH - margin) {
      doc.addPage();
      y = margin;
    }
  };

  const writeLines = (
    raw: string,
    opts: { size?: number; font?: "helvetica" | "courier"; style?: "normal" | "bold" | "italic" },
  ) => {
    const size = opts.size ?? 10;
    const font = opts.font ?? "helvetica";
    const style = opts.style ?? "normal";
    doc.setFont(font, style);
    doc.setFontSize(size);
    const parts = doc.splitTextToSize(raw, maxW) as string[];
    const lineH = size * 0.55;
    for (const ln of parts) {
      newPageIfNeeded(lineH);
      doc.text(ln, margin, y);
      y += lineH;
    }
    y += 0.5;
  };

  doc.setFont("helvetica", "bold");
  doc.setFontSize(15);
  newPageIfNeeded(12);
  doc.text("Kartu login guru (ringkasan semua)", margin, y);
  y += 9;

  if (params.schoolName) {
    writeLines(`Sekolah: ${params.schoolName}`, { size: 11 });
  }
  writeLines(`Diekspor: ${params.exportedAtLabel}`, { size: 10 });

  y += 2;
  doc.setDrawColor(190, 198, 210);
  newPageIfNeeded(4);
  doc.line(margin, y, pageW - margin, y);
  y += 7;

  for (const c of params.cards) {
    newPageIfNeeded(32);
    writeLines(c.nama, { size: 13, style: "bold" });
    writeLines(`Email: ${c.email}`, { size: 10.5 });
    writeLines(`Password: ${c.password}`, { size: 11, font: "courier", style: "bold" });
    if (params.loginUrl) {
      const lh = 9 * 0.55;
      newPageIfNeeded(lh * 3);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.setTextColor(67, 56, 202);
      doc.text("Link login:", margin, y);
      y += lh;
      const urlLines = doc.splitTextToSize(params.loginUrl, maxW) as string[];
      for (const segment of urlLines) {
        newPageIfNeeded(lh);
        doc.textWithLink(segment, margin, y, { url: params.loginUrl });
        y += lh;
      }
      y += 0.5;
      doc.setTextColor(0, 0, 0);
    }
    if (c.wasReset) {
      writeLines("(PIN baru dibuat karena password belum tersimpan di sistem.)", {
        size: 9,
        style: "italic",
      });
    }
    y += 2;
    doc.setDrawColor(226, 232, 240);
    newPageIfNeeded(3);
    doc.line(margin, y, pageW - margin, y);
    y += 7;
  }

  if (params.errors.length > 0) {
    newPageIfNeeded(14);
    writeLines("Gagal / dilewati", { size: 12, style: "bold" });
    for (const err of params.errors) {
      writeLines(`• ${err}`, { size: 10 });
    }
  }

  return doc.output("blob") as Blob;
}
