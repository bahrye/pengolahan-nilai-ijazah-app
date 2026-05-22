import type { RekapStudentRow } from "@/domain/rekapitulasi";

export type RekapExportOpts = {
  title: string;
  /** Ditampilkan setelah judul rekap, mis. "… - MTS TANUNTUNG" */
  schoolName?: string | null;
  mapel: { kode: string; nama?: string }[];
  rows: RekapStudentRow[];
  decimals: number;
  showStatus?: boolean;
  showPdum?: boolean;
  /** Nama file tanpa ekstensi; akan disanitasi */
  fileBase?: string;
};

function fmtCell(val: number, decimals: number): string {
  if (decimals === 0) return String(Math.round(val));
  return val.toFixed(decimals).replace(".", ",");
}

function sanitizeFileBase(s: string): string {
  const t = s
    .replace(/[^a-zA-Z0-9\s_-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
  return t.slice(0, 72) || "rekap-nilai";
}

/** Nama file unduhan (tanpa ekstensi), termasuk nama sekolah bila ada. */
function exportDownloadStem(opts: Pick<RekapExportOpts, "fileBase" | "title" | "schoolName">): string {
  const stem = opts.fileBase ?? opts.title;
  const school = opts.schoolName?.trim();
  const raw = school ? `${stem} - ${school}` : stem;
  return sanitizeFileBase(raw);
}

/** Karakter aman untuk font standar PDF (WinAnsi). */
function pdfSafe(s: string): string {
  if (!s) return "";
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\x09\x0A\x0D\x20-\x7E]/g, "?");
}

function fullExportTitle(title: string, schoolName?: string | null): string {
  const s = schoolName?.trim();
  return s ? `${title} - ${s}` : title;
}

export async function exportRekapExcel(opts: RekapExportOpts): Promise<void> {
  const ExcelJS = (await import("exceljs")).default;
  const wb = new ExcelJS.Workbook();
  wb.creator = "Sistem Nilai Ijazah";
  const headers = ["NISN", "Nama", "Kelas", ...opts.mapel.map((m) => m.kode), "Jumlah", "Rata-rata"];
  if (opts.showStatus) headers.push("Status");
  if (opts.showPdum) headers.push("PDUM");

  const ws = wb.addWorksheet("Rekap", {
    views: [{ state: "frozen", ySplit: opts.schoolName?.trim() ? 2 : 1 }],
  });

  if (opts.schoolName?.trim()) {
    ws.mergeCells(1, 1, 1, headers.length);
    const t = ws.getCell(1, 1);
    t.value = fullExportTitle(opts.title, opts.schoolName);
    t.font = { bold: true, size: 12, color: { argb: "FF1E1B4B" } };
    t.alignment = { vertical: "middle", horizontal: "left", wrapText: true };
    ws.getRow(1).height = 28;
  }

  const headRow = ws.addRow(headers);
  headRow.font = { bold: true, color: { argb: "FFFFFFFF" } };
  headRow.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FF4338CA" },
  };
  headRow.alignment = { vertical: "middle", horizontal: "center" };
  headRow.height = 22;

  for (const r of opts.rows) {
    const cells: (string | number)[] = [
      r.nisn,
      r.nama,
      r.kelas,
      ...opts.mapel.map((m) => fmtCell(r.scoresByCode[m.kode] ?? 0, opts.decimals)),
      fmtCell(r.jumlah, opts.decimals),
      opts.decimals === 0
        ? Math.round(r.rataRataNumeric)
        : r.rataRataDisplay,
    ];
    if (opts.showStatus) cells.push(r.status ?? "");
    if (opts.showPdum) cells.push(r.rataRataAmPdum ?? "");
    const row = ws.addRow(cells);
    row.alignment = { vertical: "middle" };
    row.getCell(1).alignment = { horizontal: "left" };
    row.getCell(2).alignment = { horizontal: "left" };
  }

  ws.columns = headers.map((h, i) => {
    if (i === 0) return { width: 14 };
    if (i === 1) return { width: 30 };
    if (i === 2) return { width: 12 };
    if (h === "Jumlah" || h === "Rata-rata" || h === "PDUM") return { width: 11 };
    if (h === "Status") return { width: 14 };
    return { width: 9 };
  });

  const buf = await wb.xlsx.writeBuffer();
  const blob = new Blob([buf], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${exportDownloadStem(opts)}.xlsx`;
  a.click();
  URL.revokeObjectURL(url);
}

export async function exportRekapPdf(opts: RekapExportOpts): Promise<void> {
  const [{ jsPDF }, autoTableMod] = await Promise.all([
    import("jspdf"),
    import("jspdf-autotable"),
  ]);
  const autoTable = autoTableMod.default;

  const doc = new jsPDF({
    orientation: "landscape",
    unit: "mm",
    format: "a4",
    compress: true,
  });

  const headers = [
    "NISN",
    "Nama",
    "Kelas",
    ...opts.mapel.map((m) => m.kode),
    "Jumlah",
    "Rata-rata",
  ];
  if (opts.showStatus) headers.push("Status");
  if (opts.showPdum) headers.push("PDUM");

  const body = opts.rows.map((r) => {
    const row: string[] = [
      pdfSafe(r.nisn),
      pdfSafe(r.nama),
      pdfSafe(r.kelas),
      ...opts.mapel.map((m) =>
        pdfSafe(fmtCell(r.scoresByCode[m.kode] ?? 0, opts.decimals)),
      ),
      pdfSafe(fmtCell(r.jumlah, opts.decimals)),
      pdfSafe(
        opts.decimals === 0
          ? String(Math.round(r.rataRataNumeric))
          : r.rataRataDisplay,
      ),
    ];
    if (opts.showStatus) row.push(pdfSafe(r.status ?? ""));
    if (opts.showPdum) row.push(pdfSafe(r.rataRataAmPdum != null ? String(r.rataRataAmPdum) : ""));
    return row;
  });

  const colCount = headers.length;
  const fontSize = colCount > 22 ? 5.5 : colCount > 16 ? 6.5 : 7.5;
  const margin = { top: 16, right: 8, bottom: 10, left: 8 };
  const pageW = doc.internal.pageSize.getWidth();
  const titleFull = pdfSafe(fullExportTitle(opts.title, opts.schoolName));
  doc.setFont("helvetica", "bold");
  const titleFontSize =
    titleFull.length > 140 ? 7 : titleFull.length > 90 ? 8 : titleFull.length > 70 ? 8.5 : 9.5;
  doc.setFontSize(titleFontSize);
  const titleReservedRight = 52;
  const titleMaxW = Math.max(36, pageW - margin.left - margin.right - titleReservedRight);
  const titleLines = doc.splitTextToSize(titleFull, titleMaxW);
  const lineH = titleFontSize * 0.45 + 0.9;
  const headerBandH = Math.max(11, 5 + titleLines.length * lineH);

  const printed = pdfSafe(
    new Date().toLocaleString("id-ID", {
      dateStyle: "medium",
      timeStyle: "short",
    }),
  );

  autoTable(doc, {
    head: [headers],
    body,
    theme: "grid",
    styles: {
      font: "helvetica",
      fontSize,
      cellPadding: 1.1,
      overflow: "ellipsize",
      valign: "middle",
      lineColor: [200, 200, 210],
      lineWidth: 0.1,
    },
    headStyles: {
      fillColor: [67, 56, 202],
      textColor: 255,
      fontStyle: "bold",
      halign: "center",
    },
    bodyStyles: { halign: "center" },
    columnStyles: {
      0: { halign: "left", cellWidth: 22 },
      1: { halign: "left", cellWidth: 36 },
      2: { halign: "center", cellWidth: 16 },
    },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    margin: { ...margin, top: headerBandH + 3 },
    showHead: "everyPage",
    tableWidth: "auto",
    horizontalPageBreak: colCount > 18,
    horizontalPageBreakRepeat: [0, 1, 2],
    willDrawPage: () => {
      const w = doc.internal.pageSize.getWidth();
      doc.setFillColor(67, 56, 202);
      doc.rect(0, 0, w, headerBandH, "F");
      doc.setTextColor(255, 255, 255);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(titleFontSize);
      doc.text(titleLines, margin.left, 5.8);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7.5);
      doc.text(printed, w - margin.right, Math.max(6.5, headerBandH - 2.5), { align: "right" });
      doc.setTextColor(0, 0, 0);
    },
    startY: headerBandH + 3,
  });

  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    const h = doc.internal.pageSize.getHeight();
    doc.setFontSize(7);
    doc.setTextColor(120, 120, 130);
    doc.text(`Halaman ${i} / ${pageCount}`, doc.internal.pageSize.getWidth() / 2, h - 5, {
      align: "center",
    });
    doc.setTextColor(0, 0, 0);
  }

  doc.save(`${exportDownloadStem(opts)}.pdf`);
}
