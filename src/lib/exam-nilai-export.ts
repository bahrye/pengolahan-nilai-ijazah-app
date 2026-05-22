import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

import type { ExamNilaiPrintPreview } from "@/server/actions/exam-nilai-print";

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function safeFilePart(s: string): string {
  return s.replace(/[^\w.-]+/g, "_").replace(/_+/g, "_").slice(0, 80);
}

/** Rasterisasi kop ke JPEG dengan latar putih penuh agar area transparan tidak jadi hitam di PDF. */
async function letterheadDataUrl(url: string): Promise<string | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      try {
        const c = document.createElement("canvas");
        c.width = img.naturalWidth;
        c.height = img.naturalHeight;
        const ctx = c.getContext("2d");
        if (!ctx) {
          resolve(null);
          return;
        }
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, c.width, c.height);
        ctx.drawImage(img, 0, 0);
        resolve(c.toDataURL("image/png"));
      } catch {
        resolve(null);
      }
    };
    img.onerror = () => resolve(null);
    img.src = url;
  });
}

export function buildExamNilaiHtmlDocument(data: ExamNilaiPrintPreview): string {
  const pageSize = data.paperSize === "LEGAL" ? "legal portrait" : "a4 portrait";
  const compact = data.compact ? "body{font-size:12px} table{font-size:11px}" : "body{font-size:13px} table{font-size:12.5px}";
  const rowsHtml =
    data.rows.length === 0
      ? `<tr><td colspan="6" style="text-align:center;padding:16px;color:#64748b;border:1px solid #475569">Tidak ada siswa.</td></tr>`
      : data.rows
          .map(
            (r) =>
              `<tr>
  <td style="text-align:center;border:1px solid #475569;padding:5px 4px">${r.no}</td>
  <td style="border:1px solid #475569;padding:5px 4px;font-family:ui-monospace,monospace;white-space:nowrap;color:#000;font-size:12px">${escapeHtml(r.nomorUjian)}</td>
  <td style="text-align:center;border:1px solid #475569;padding:5px 4px;font-family:ui-monospace,monospace;white-space:nowrap;color:#000;font-size:12px">${escapeHtml(r.nisn)}</td>
  <td style="border:1px solid #475569;padding:5px 4px;color:#0f172a">${escapeHtml(r.nama)}</td>
  <td style="text-align:center;border:1px solid #475569;padding:5px 4px;color:#0f172a">${escapeHtml(r.nilai)}</td>
  <td style="border:1px solid #475569;padding:5px 4px;color:#0f172a">${escapeHtml(r.keterangan)}</td>
</tr>`,
          )
          .join("\n");

  const kop = data.letterheadUrl
    ? `<div style="text-align:center;border-bottom:1px solid #e2e8f0;padding-bottom:12px;margin-bottom:0"><img src="${escapeHtml(data.letterheadUrl)}" alt="Kop" style="max-height:96px;max-width:100%;object-fit:contain"/></div>`
    : `<p style="border:1px dashed #f59e0b;padding:8px;text-align:center;font-size:11px;color:#92400e">Belum ada kop surat.</p>`;

  const otherGuru =
    data.otherGuruCount > 0
      ? `<p class="ttd-note">Bersama ${data.otherGuruCount} guru pemeriksa lainnya atas mapel ini.</p>`
      : "";

  return `<!DOCTYPE html>
<html lang="id">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>Nilai Ujian — ${escapeHtml(data.subjectCode)}</title>
<style>
@page { size: ${pageSize}; margin: 10mm; }
html,body{margin:0;padding:0;background:#fff;color:#0f172a;font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;}
.wrap{max-width:${data.paperSize === "LEGAL" ? "216mm" : "210mm"};margin:0 auto;padding:10mm 12mm;box-sizing:border-box;}
h1{text-align:center;font-size:15px;font-weight:700;text-transform:uppercase;letter-spacing:.04em;margin:1.35rem 0 0;}
.meta{margin-top:18px;border-bottom:1px solid #e2e8f0;padding-bottom:14px;font-size:12px;}
.meta-row{display:grid;grid-template-columns:11rem 1.1rem 1fr;column-gap:0.5rem;row-gap:0.25rem;align-items:start;margin-bottom:8px;}
.meta-row .l{font-weight:600;color:#334155;}
.meta-row .c{text-align:center;font-weight:600;color:#0f172a;}
.scroll-x{overflow-x:auto;-webkit-overflow-scrolling:touch;overscroll-behavior-x:contain;margin-top:14px;}
.scroll-x table{min-width:720px;width:100%;border-collapse:collapse;border:1px solid #475569;table-layout:fixed;${compact}}
@media print{
.scroll-x{overflow:visible!important;}
.scroll-x table{min-width:0!important;width:100%!important;}
}
colgroup col:nth-child(1){width:5%;}
colgroup col:nth-child(2){width:24%;}
colgroup col:nth-child(3){width:14%;}
colgroup col:nth-child(4){width:30%;}
colgroup col:nth-child(5){width:8%;}
colgroup col:nth-child(6){width:19%;}
th{background:#f1f5f9;text-align:center;border:1px solid #475569;padding:7px 4px;font-weight:600;color:#0f172a;}
.ttd-scroll{overflow-x:auto;-webkit-overflow-scrolling:touch;overscroll-behavior-x:contain;margin-top:36px;}
.ttd{display:flex;flex-wrap:nowrap;align-items:flex-start;justify-content:space-between;gap:2rem;font-size:12px;min-width:520px;}
.ttd-col{flex:0 1 46%;max-width:46%;text-align:left;}
.ttd-col--guru{text-align:right;}
.ttd-note{flex:1 0 100%;width:100%;font-size:10px;font-style:italic;color:#64748b;margin-top:8px;}
.sig{height:48px;}
@media print{
.ttd-scroll{overflow:visible!important;}
.ttd{min-width:0!important;flex-wrap:wrap;gap:1.25rem 2.5rem;}
.ttd-col{flex:1 1 42%;max-width:48%;text-align:left;}
.ttd-col--guru{flex:0 1 40%;max-width:44%;padding-left:2.75rem;text-align:left;}
}
</style>
</head>
<body>
<div class="wrap">
${kop}
<h1>${escapeHtml(data.examDocHeading)}</h1>
<div class="meta">
  <div class="meta-row"><span class="l">Mata Pelajaran</span><span class="c">:</span><span><strong>${escapeHtml(data.subjectName)}</strong> <span style="color:#64748b">(${escapeHtml(data.subjectCode)})</span></span></div>
  <div class="meta-row"><span class="l">Guru Pemeriksa</span><span class="c">:</span><span>${escapeHtml(data.guruPemeriksaLine)}</span></div>
  <div class="meta-row"><span class="l">Ruang Ujian</span><span class="c">:</span><span>${escapeHtml(data.ruangUjianLabel)}</span></div>
  <div class="meta-row"><span class="l">Kelas</span><span class="c">:</span><span>${escapeHtml(data.kelasLabel)}</span></div>
</div>
<div class="scroll-x">
<table>
<colgroup><col/><col/><col/><col/><col/><col/></colgroup>
<thead><tr>
<th>No</th><th>Nomor Ujian</th><th>NISN</th><th>Nama Peserta Ujian</th><th>Nilai</th><th>Keterangan</th>
</tr></thead>
<tbody>${rowsHtml}</tbody>
</table>
</div>
<div class="ttd-scroll">
<div class="ttd">
  <div class="ttd-col">
    <p><strong>Mengetahui,</strong></p>
    <p><strong>${escapeHtml(data.headLabel)}</strong></p>
    <div class="sig"></div>
    <p><strong><u>${escapeHtml(data.namaKepala ?? "…………………………")}</u></strong></p>
    <p>${data.nipKepala ? `NIP. ${escapeHtml(data.nipKepala)}` : "NIP. —"}</p>
  </div>
  <div class="ttd-col ttd-col--guru">
    <p><strong>${escapeHtml(data.tanggalCetakLine)}</strong></p>
    <p><strong>Guru Pemeriksa</strong></p>
    <div class="sig"></div>
    <p><strong><u>${escapeHtml(data.primaryGuru.nama)}</u></strong></p>
    <p>${data.primaryGuru.nip ? `NIP. ${escapeHtml(data.primaryGuru.nip)}` : "NIP. —"}</p>
  </div>
</div>
${otherGuru}
</div>
</div>
</body>
</html>`;
}

export function downloadExamNilaiHtml(data: ExamNilaiPrintPreview, filenameBase: string): void {
  const html = buildExamNilaiHtmlDocument(data);
  const blob = new Blob([html], { type: "text/html;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${safeFilePart(filenameBase)}.html`;
  a.click();
  URL.revokeObjectURL(url);
}

type DocWithAutoTable = jsPDF & { lastAutoTable?: { finalY: number } };

export async function downloadExamNilaiPdf(data: ExamNilaiPrintPreview, filenameBase: string): Promise<void> {
  const fmt = data.paperSize === "LEGAL" ? "legal" : "a4";
  const doc = new jsPDF({ unit: "mm", format: fmt, orientation: "portrait" });
  const pageW = doc.internal.pageSize.getWidth();
  const margin = 12;
  let y = margin;

  const fsTitle = data.compact ? 12 : 13;
  const fsBody = data.compact ? 9 : 10;
  const fsTable = data.compact ? 8.5 : 9.5;
  const lh = data.compact ? 4.4 : 5;

  if (data.letterheadUrl) {
    const dataUrl = await letterheadDataUrl(data.letterheadUrl);
    if (dataUrl) {
      const imgW = pageW - margin * 2;
      const imgH = 28;
      try {
        doc.addImage(dataUrl, "PNG", margin, y, imgW, imgH, undefined, "FAST");
        y += imgH + 8;
      } catch {
        try {
          doc.addImage(dataUrl, "JPEG", margin, y, imgW, imgH, undefined, "FAST");
          y += imgH + 8;
        } catch {
          y = margin;
        }
      }
    }
  }

  doc.setFont("helvetica", "bold");
  doc.setFontSize(fsTitle);
  doc.text(data.examDocHeadingUpper, pageW / 2, y, { align: "center" });
  y += lh + 2;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(fsBody);
  const metaLine = (label: string, val: string) => {
    const labelColMm = 42;
    const colonXMm = margin + labelColMm;
    const valueXMm = margin + labelColMm + 5;
    doc.setFont("helvetica", "bold");
    doc.setTextColor(15, 23, 42);
    doc.text(label, margin, y);
    doc.setFont("helvetica", "normal");
    doc.text(":", colonXMm, y);
    const tw = pageW - margin - valueXMm;
    const lines = doc.splitTextToSize(val, tw);
    doc.text(lines, valueXMm, y);
    y += Math.max(lh, lines.length * lh * 0.85);
  };
  metaLine("Mata Pelajaran", `${data.subjectName} (${data.subjectCode})`);
  metaLine("Guru Pemeriksa", data.guruPemeriksaLine);
  metaLine("Ruang Ujian", data.ruangUjianLabel);
  metaLine("Kelas", data.kelasLabel);
  y += 2;

  /** Lebar kolom: Nomor Ujian dirapatkan, NISN cukup lebar; font lebih besar & grid jelas. */
  const innerW = pageW - margin * 2;
  const colNo = 8;
  const colNomor = data.paperSize === "LEGAL" ? 44 : 40;
  const colNisn = data.paperSize === "LEGAL" ? 26 : 24;
  const colNilai = 14;
  const colKet = data.paperSize === "LEGAL" ? 40 : 36;
  const colNama = Math.max(38, innerW - colNo - colNomor - colNisn - colNilai - colKet);

  const darkMono: [number, number, number] = [0, 0, 0];
  const fsHead = fsTable + 1.35;

  autoTable(doc, {
    startY: y,
    margin: { left: margin, right: margin },
    tableWidth: innerW,
    theme: "grid",
    head: [["No", "Nomor Ujian", "NISN", "Nama Peserta Ujian", "Nilai", "Keterangan"]],
    body: data.rows.map((r) => [String(r.no), r.nomorUjian, r.nisn, r.nama, r.nilai, r.keterangan]),
    styles: {
      fontSize: fsTable,
      cellPadding: 1.35,
      valign: "middle",
      overflow: "linebreak",
      lineColor: [71, 85, 105],
      lineWidth: 0.12,
      textColor: [0, 0, 0],
    },
    headStyles: {
      fillColor: [241, 245, 249],
      textColor: [0, 0, 0],
      fontSize: fsHead,
      halign: "center",
      fontStyle: "bold",
      lineColor: [71, 85, 105],
      lineWidth: 0.12,
    },
    columnStyles: {
      0: { halign: "center", cellWidth: colNo },
      1: {
        cellWidth: colNomor,
        font: "courier",
        fontSize: fsTable - 0.5,
        textColor: darkMono,
        overflow: "visible",
        valign: "middle",
      },
      2: {
        cellWidth: colNisn,
        font: "courier",
        fontSize: fsTable - 0.5,
        textColor: darkMono,
        halign: "center",
        overflow: "visible",
      },
      3: { cellWidth: colNama, overflow: "linebreak", textColor: [0, 0, 0] },
      4: { halign: "center", cellWidth: colNilai, textColor: [0, 0, 0] },
      5: { cellWidth: colKet, overflow: "linebreak", textColor: [0, 0, 0] },
    },
    didParseCell: (hook) => {
      if (hook.section === "head") {
        hook.cell.styles.fontSize = fsHead;
        hook.cell.styles.textColor = darkMono;
        return;
      }
      if (hook.section !== "body") return;
      if (hook.column.index === 1 || hook.column.index === 2) {
        hook.cell.styles.textColor = darkMono;
      }
      if (hook.column.index === 1 && typeof hook.cell.raw === "string") {
        hook.cell.text = [hook.cell.raw.replace(/\s+/g, " ").trim()];
      }
      if (hook.column.index === 2 && typeof hook.cell.raw === "string") {
        hook.cell.text = [hook.cell.raw.replace(/\s+/g, "").trim()];
      }
    },
    willDrawCell: (hook) => {
      if (hook.section === "body" && (hook.column.index === 1 || hook.column.index === 2)) {
        hook.doc.setTextColor(0, 0, 0);
      }
    },
  });

  doc.setTextColor(15, 23, 42);

  y = (doc as DocWithAutoTable).lastAutoTable?.finalY ?? y;
  y += 12;

  /** Garis bawah nama (jsPDF tidak selalu merender opsi underline pada text). */
  const drawUnderlinedBold = (text: string, x: number, yPos: number) => {
    doc.setFont("helvetica", "bold");
    doc.text(text, x, yPos);
    const w = doc.getTextWidth(text);
    doc.setDrawColor(15, 23, 42);
    doc.setLineWidth(0.25);
    doc.line(x, yPos + 0.9, x + w, yPos + 0.9);
  };

  /** Blok kanan (Guru Pemeriksa) digeser ke kanan ~setengah lebar isi + indent agar tidak berdempet dengan Kepala. */
  const ttdLeftX = margin + colNo;
  const ttdRightX = margin + innerW * 0.5 + 14;
  doc.setFontSize(fsBody);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(15, 23, 42);
  doc.text("Mengetahui,", ttdLeftX, y);
  doc.text(data.tanggalCetakLine, ttdRightX, y);
  y += lh;
  doc.setFont("helvetica", "bold");
  doc.text(data.headLabel, ttdLeftX, y);
  doc.text("Guru Pemeriksa", ttdRightX, y);
  y += 18;
  drawUnderlinedBold(data.namaKepala ?? "…………………………", ttdLeftX, y);
  drawUnderlinedBold(data.primaryGuru.nama, ttdRightX, y);
  y += lh;
  doc.setFont("helvetica", "normal");
  doc.text(data.nipKepala ? `NIP. ${data.nipKepala}` : "NIP. —", ttdLeftX, y);
  doc.text(data.primaryGuru.nip ? `NIP. ${data.primaryGuru.nip}` : "NIP. —", ttdRightX, y);
  y += lh;
  if (data.otherGuruCount > 0) {
    doc.setFontSize(fsBody - 1);
    doc.setFont("helvetica", "italic");
    doc.text(`Bersama ${data.otherGuruCount} guru pemeriksa lainnya atas mapel ini.`, ttdLeftX, y, {
      maxWidth: pageW - margin - ttdLeftX,
    });
  }

  doc.save(`${safeFilePart(filenameBase)}.pdf`);
}
