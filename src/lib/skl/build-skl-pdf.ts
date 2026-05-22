import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

import {
  formatBirthPlaceDateSkl,
  formatDateId,
  formatSklUpper,
  formatKabupatenLine,
  formatProvinsiLine,
  jenjangTitleUpper,
  sklAsalLabel,
  sklKepalaTitle,
  sklNomorPesertaLabel,
  type SklDocumentData,
} from "@/lib/skl/skl-document-data";
import { getCachedLetterheadDataUrl } from "@/lib/skl/letterhead-cache";
import { buildSklTableRows, type SklTableRow } from "@/lib/skl/skl-grades";

const MARGIN = 18;
/** Indentasi ~1 tab untuk label isian NPSN / data siswa. */
const FIELD_INDENT = 8;
const HEADER_BG: [number, number, number] = [189, 215, 238];

function drawKop(doc: jsPDF, y: number): number {
  const pageW = doc.internal.pageSize.getWidth();
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.text("KEMENTERIAN AGAMA REPUBLIK INDONESIA", pageW / 2, y, { align: "center" });
  return y + 5;
}

function drawField(
  doc: jsPDF,
  y: number,
  margin: number,
  contentW: number,
  label: string,
  value: string,
): number {
  const labelW = 62;
  const xColon = margin + labelW;
  const xVal = xColon + 3;
  const lineEnd = margin + contentW;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text(label, margin, y);
  doc.text(":", xColon, y);
  const text = value?.trim() ?? "";
  if (text) {
    doc.text(text, xVal, y);
  }
  doc.setLineWidth(0.15);
  doc.line(xVal, y + 0.7, lineEnd, y + 0.7);
  return y + 5.5;
}

type LulusToken = { text: string; bold: boolean; fontSize: number };

function measureToken(doc: jsPDF, token: LulusToken): number {
  doc.setFontSize(token.fontSize);
  doc.setFont("helvetica", token.bold ? "bold" : "normal");
  return doc.getTextWidth(token.text);
}

function drawToken(doc: jsPDF, token: LulusToken, x: number, y: number): void {
  doc.setFontSize(token.fontSize);
  doc.setFont("helvetica", token.bold ? "bold" : "normal");
  doc.text(token.text, x, y);
}

function buildLulusTokens(status: "LULUS" | "TIDAK LULUS"): LulusToken[] {
  const suffix =
    "dari satuan pendidikan setelah memenuhi seluruh kriteria sesuai dengan peraturan perundang-undangan.";
  const tokens: LulusToken[] = [
    { text: "dinyatakan ", bold: false, fontSize: 10 },
    { text: status, bold: true, fontSize: 14 },
    { text: " dari", bold: false, fontSize: 10 },
  ];
  const words = suffix.split(/\s+/).slice(1);
  for (const word of words) {
    tokens.push({ text: ` ${word}`, bold: false, fontSize: 10 });
  }
  return tokens;
}

/** Paragraf kelulusan satu alur: "dinyatakan LULUS dari satuan pendidikan…" */
function drawLulusParagraph(
  doc: jsPDF,
  y: number,
  margin: number,
  contentW: number,
  status: "LULUS" | "TIDAK LULUS",
): number {
  const lineH = 5.2;
  const maxX = margin + contentW;
  const tokens = buildLulusTokens(status);

  let x = margin;
  let cy = y;

  for (const token of tokens) {
    const w = measureToken(doc, token);
    if (x > margin && x + w > maxX) {
      cy += lineH;
      x = margin;
    }
    drawToken(doc, token, x, cy);
    x += w;
  }

  return cy + lineH;
}

function drawSignatureBlock(
  doc: jsPDF,
  y: number,
  data: SklDocumentData,
): void {
  const pageW = doc.internal.pageSize.getWidth();
  const sigW = 72;
  const sigX = pageW - MARGIN - sigW;
  const place =
    data.school.printSignaturePlace?.trim() || formatKabupatenLine(data.school);
  const kepala = sklKepalaTitle(data.school.jenjang);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text(`${place}, ${formatDateId(data.issuedAt)}`, sigX, y);
  y += 5;
  doc.text(kepala, sigX, y);
  y += 18;
  const kepsek = data.school.namaKepsek?.trim();
  if (kepsek) {
    doc.setFont("helvetica", "bold");
    doc.text(kepsek, sigX, y);
    y += 5;
    doc.setFont("helvetica", "normal");
    const nip = data.school.nipKepsek?.trim();
    doc.text(nip ? `NIP. ${nip}` : "NIP. -", sigX, y);
  } else {
    doc.text("............................................", sigX, y);
    y += 5;
    doc.text("NIP. -", sigX, y);
  }
}

function drawPage1(doc: jsPDF, data: SklDocumentData, letterheadDataUrl: string | null): void {
  const pageW = doc.internal.pageSize.getWidth();
  const contentW = pageW - MARGIN * 2;
  const fieldMargin = MARGIN + FIELD_INDENT;
  const fieldW = contentW - FIELD_INDENT;
  let y = 12;

  if (letterheadDataUrl) {
    try {
      const props = doc.getImageProperties(letterheadDataUrl);
      const maxH = 36;
      let w = contentW;
      let h = w / (props.width / props.height);
      if (h > maxH) {
        h = maxH;
        w = h * (props.width / props.height);
      }
      doc.addImage(letterheadDataUrl, props.fileType, (pageW - w) / 2, y, w, h, undefined, "FAST");
      y += h + 6;
    } catch {
      y = drawKop(doc, y);
    }
  } else {
    y = drawKop(doc, y);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    const sn = data.school.namaSekolah?.trim().toUpperCase() || "";
    if (sn) {
      doc.text(sn, pageW / 2, y, { align: "center" });
      y += 5;
    }
    y += 4;
  }

  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text("SURAT KETERANGAN LULUS", pageW / 2, y, { align: "center" });
  y += 6;
  const ta = data.academicYearLabel?.trim() || "—";
  doc.text(`TAHUN PELAJARAN ${ta.toUpperCase()}`, pageW / 2, y, { align: "center" });
  y += 8;

  doc.setFontSize(10);
  doc.text(`Nomor : ${data.letterNumberDisplay}`, pageW / 2, y, { align: "center" });
  y += 10;

  const schoolName = data.school.namaSekolah?.trim() || "—";
  doc.setFont("helvetica", "normal");
  const intro = `Yang bertanda tangan di bawah ini kepala ${schoolName}:`;
  doc.text(intro, MARGIN, y);
  y += 7;

  y = drawField(
    doc,
    y,
    fieldMargin,
    fieldW,
    "nomor pokok sekolah nasional (NPSN)",
    data.school.npsn ?? "",
  );
  y = drawField(doc, y, fieldMargin, fieldW, "Kabupaten/Kota", formatKabupatenLine(data.school));
  y = drawField(doc, y, fieldMargin, fieldW, "Provinsi", formatProvinsiLine(data.school));
  y += 3;

  doc.text("menerangkan bahwa:", MARGIN, y);
  y += 7;

  y = drawField(doc, y, fieldMargin, fieldW, "nama", formatSklUpper(data.student.name));
  y = drawField(
    doc,
    y,
    fieldMargin,
    fieldW,
    "tempat dan tanggal lahir",
    formatBirthPlaceDateSkl(data.student.birthPlace, data.student.birthDate),
  );
  y = drawField(
    doc,
    y,
    fieldMargin,
    fieldW,
    "nama orang tua/wali",
    formatSklUpper(data.student.parentGuardianName),
  );
  y = drawField(doc, y, fieldMargin, fieldW, "nomor induk siswa", data.student.nis ?? "");
  y = drawField(
    doc,
    y,
    fieldMargin,
    fieldW,
    "nomor induk siswa nasional",
    data.student.nisn.replace(/\D/g, "").slice(0, 10),
  );
  y = drawField(
    doc,
    y,
    fieldMargin,
    fieldW,
    sklNomorPesertaLabel(data.school.jenjang),
    data.student.nomorUjian ?? "",
  );
  y = drawField(
    doc,
    y,
    fieldMargin,
    fieldW,
    sklAsalLabel(data.school.jenjang),
    schoolName,
  );
  y += 6;

  y = drawLulusParagraph(doc, y, MARGIN, contentW, data.grades.status);
  y += 5;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text("Demikian surat keterangan ini dibuat untuk digunakan sebagaimana mestinya.", MARGIN, y);
  y += 14;

  drawSignatureBlock(doc, y, data);
}

type BackTableCell =
  | string
  | {
      content: string;
      colSpan?: number;
      rowSpan?: number;
      styles?: {
        halign?: "left" | "center" | "right";
        fontStyle?: "normal" | "bold" | "italic";
        overflow?: "hidden" | "linebreak" | "ellipsize";
        cellPadding?: { left?: number; right?: number; top?: number; bottom?: number };
      };
    };

function tableRowsToBody(rows: SklTableRow[]): BackTableCell[][] {
  const body: BackTableCell[][] = [];
  for (const row of rows) {
    if (row.kind === "group") {
      body.push([
        {
          content: row.label,
          colSpan: 3,
        styles: { halign: "left", fontStyle: "bold" },
      },
    ]);
    } else if (row.kind === "parent") {
      body.push([
        {
          content: row.label,
          colSpan: 3,
          styles: { halign: "left", fontStyle: "bold" },
        },
      ]);
    } else if (row.kind === "subject") {
      body.push([
        {
          content: row.label,
          styles: row.indent
            ? { halign: "left", cellPadding: { left: 10 }, overflow: "hidden" }
            : { halign: "left", overflow: "hidden" },
        },
        { content: row.nilaiAngka, styles: { halign: "center", overflow: "hidden" } },
        {
          content: row.nilaiHuruf,
          styles: { halign: "left", fontStyle: "italic", overflow: "hidden" },
        },
      ]);
    } else if (row.kind === "average") {
      body.push([
        { content: "Rata-Rata", styles: { halign: "center", fontStyle: "bold" } },
        { content: row.nilaiAngka, styles: { halign: "center", fontStyle: "bold" } },
        {
          content: row.nilaiHuruf,
          styles: { halign: "left", fontStyle: "italic" },
        },
      ]);
    }
  }
  return body;
}

function drawPage2(doc: jsPDF, data: SklDocumentData): void {
  const pageW = doc.internal.pageSize.getWidth();
  const contentW = pageW - MARGIN * 2;
  let y = 16;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text("DAFTAR NILAI", pageW / 2, y, { align: "center" });
  y += 6;
  doc.text(jenjangTitleUpper(data.school.jenjang), pageW / 2, y, { align: "center" });
  y += 6;
  const ta = data.academicYearLabel?.trim() || "—";
  doc.text(`TAHUN PELAJARAN ${ta.toUpperCase()}`, pageW / 2, y, { align: "center" });
  y += 10;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  y = drawField(doc, y, MARGIN, contentW, "Nama", formatSklUpper(data.student.name));
  y = drawField(
    doc,
    y,
    MARGIN,
    contentW,
    "Tempat dan Tanggal Lahir",
    formatBirthPlaceDateSkl(data.student.birthPlace, data.student.birthDate),
  );
  y = drawField(doc, y, MARGIN, contentW, "Nomor Induk Siswa", data.student.nis ?? "");
  y = drawField(
    doc,
    y,
    MARGIN,
    contentW,
    "Nomor Induk Siswa Nasional",
    data.student.nisn.replace(/\D/g, "").slice(0, 10),
  );
  y += 4;

  const tableMargin = 10;
  const tableW = pageW - tableMargin * 2;
  const colMapel = tableW * 0.62;
  const colAngka = tableW * 0.12;
  const colHuruf = tableW - colMapel - colAngka;

  autoTable(doc, {
    startY: y,
    margin: { left: tableMargin, right: tableMargin },
    tableWidth: tableW,
    head: [
      [
        { content: "Mata Pelajaran", rowSpan: 2, styles: { halign: "center", valign: "middle" } },
        { content: "Nilai", colSpan: 2, styles: { halign: "center" } },
      ],
      [
        { content: "Angka", styles: { halign: "center" } },
        { content: "Huruf", styles: { halign: "center" } },
      ],
    ],
    body: tableRowsToBody(buildSklTableRows(data.grades)),
    theme: "grid",
    styles: {
      font: "helvetica",
      fontSize: 9,
      cellPadding: 1.5,
      lineColor: [0, 0, 0],
      lineWidth: 0.15,
      valign: "middle",
      overflow: "hidden",
    },
    headStyles: {
      fillColor: HEADER_BG,
      textColor: [0, 0, 0],
      fontStyle: "bold",
      halign: "center",
    },
    columnStyles: {
      0: { cellWidth: colMapel },
      1: { cellWidth: colAngka, halign: "center" },
      2: { cellWidth: colHuruf, halign: "left", fontStyle: "italic" },
    },
  });

  const afterY =
    (doc as jsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? y + 40;
  drawSignatureBlock(doc, afterY + 12, data);
}

export async function buildSklPdfBuffer(data: SklDocumentData): Promise<Buffer> {
  const doc = new jsPDF({ unit: "mm", format: "a4", compress: true });

  let letterheadDataUrl: string | null = null;
  const letterhead = data.school.printLetterheadUrl?.trim();
  if (letterhead) {
    letterheadDataUrl = await getCachedLetterheadDataUrl(letterhead);
  }

  drawPage1(doc, data, letterheadDataUrl);
  doc.addPage();
  drawPage2(doc, data);

  return Buffer.from(doc.output("arraybuffer"));
}
