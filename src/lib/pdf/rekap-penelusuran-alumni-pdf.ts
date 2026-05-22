import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

type StudentData = {
  id: string;
  name: string;
  nisn: string | null;
  nis: string | null;
};

type RekapTracerStudyData = {
  students: StudentData[];
  schoolName: string;
  className: string;
  jenjang: string | null;
  printLetterheadUrl: string | null;
};

const MARGIN = 15;

function isKemenag(jenjang: string | null) {
  if (!jenjang) return false;
  return ["MI", "MTS", "MA"].includes(jenjang.toUpperCase());
}

async function fetchImageAsBase64(url: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "Anonymous";
    img.onload = () => {
      const canvas = document.createElement("canvas");
      let w = img.width;
      let h = img.height;
      if (w > 2400) {
        h = Math.round((2400 / w) * h);
        w = 2400;
      }
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL("image/jpeg", 0.85));
      } else {
        reject(new Error("Failed to get canvas context"));
      }
    };
    img.onerror = () => reject(new Error("Failed to load image"));
    img.src = url;
  });
}

function drawKop(doc: jsPDF, y: number, jenjang: string | null): number {
  const pageW = doc.internal.pageSize.getWidth();
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  const kopText = isKemenag(jenjang) 
    ? "KEMENTERIAN AGAMA REPUBLIK INDONESIA" 
    : "DINAS PENDIDIKAN";
  doc.text(kopText, pageW / 2, y, { align: "center" });
  return y + 6;
}

export async function generateRekapTracerStudyPdf(data: RekapTracerStudyData): Promise<jsPDF> {
  // Use landscape for more columns
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4", compress: true });
  const pageW = doc.internal.pageSize.getWidth();
  const contentW = pageW - MARGIN * 2;
  
  let y = 15;

  // 1. Draw Kop / Letterhead
  if (data.printLetterheadUrl) {
    try {
      const base64Img = await fetchImageAsBase64(data.printLetterheadUrl);
      const props = doc.getImageProperties(base64Img);
      const maxH = 34;
      let w = contentW;
      let h = w / (props.width / props.height);
      if (h > maxH) {
        h = maxH;
        w = h * (props.width / props.height);
      }
      doc.addImage(base64Img, props.fileType, (pageW - w) / 2, y, w, h, undefined, "FAST");
      y += h + 6;
    } catch {
      y = drawKop(doc, y, data.jenjang);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(12);
      const sn = data.schoolName?.trim().toUpperCase() || "";
      if (sn) {
        doc.text(sn, pageW / 2, y, { align: "center" });
        y += 6;
      }
      doc.setLineWidth(0.5);
      doc.line(MARGIN, y, pageW - MARGIN, y);
      y += 6;
    }
  } else {
    y = drawKop(doc, y, data.jenjang);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    const sn = data.schoolName?.trim().toUpperCase() || "";
    if (sn) {
      doc.text(sn, pageW / 2, y, { align: "center" });
      y += 6;
    }
    doc.setLineWidth(0.5);
    doc.line(MARGIN, y, pageW - MARGIN, y);
    y += 6;
  }

  // 2. Title
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.text("DAFTAR DATA PENELUSURAN ALUMNI", pageW / 2, y, { align: "center" });
  y += 5.5;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text(`Kelas: ${data.className}  |  Tahun Lulus: ${new Date().getFullYear()}`, pageW / 2, y, { align: "center" });
  y += 10;

  // 3. Table
  const tableData = data.students.map((s, idx) => [
    (idx + 1).toString(),
    s.name.toUpperCase(),
    s.nisn || "-",
    "", // Lanjut Pendidikan
    "", // Bekerja
    "", // Wirausaha
    "", // Belum Bekerja
    ""  // Lainnya
  ]);

  autoTable(doc, {
    startY: y,
    head: [[
      "No", 
      "Nama Siswa", 
      "NISN", 
      "Lanjut Pendidikan\n(Tulis Jenjang)", 
      "Bekerja", 
      "Wirausaha", 
      "Belum\nBekerja", 
      "Lainnya"
    ]],
    body: tableData,
    theme: "grid",
    headStyles: {
      fillColor: [241, 245, 249],
      textColor: [15, 23, 42],
      fontStyle: "bold",
      halign: "center",
      valign: "middle",
      lineWidth: 0.1,
      lineColor: [200, 200, 200]
    },
    bodyStyles: {
      textColor: [15, 23, 42],
      lineWidth: 0.1,
      lineColor: [200, 200, 200]
    },
    columnStyles: {
      0: { halign: "center", cellWidth: 12 },
      1: { cellWidth: 60 },
      2: { halign: "center", cellWidth: 25 },
      3: { cellWidth: "auto" },
      4: { cellWidth: 25 },
      5: { cellWidth: 25 },
      6: { cellWidth: 22 },
      7: { cellWidth: 35 },
    },
    styles: {
      font: "helvetica",
      fontSize: 9,
      cellPadding: 3,
    },
    margin: { top: MARGIN, left: MARGIN, right: MARGIN, bottom: MARGIN },
  });

  return doc;
}
