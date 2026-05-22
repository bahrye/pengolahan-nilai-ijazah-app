import { jsPDF } from "jspdf";

type StudentData = {
  id: string;
  name: string;
  nisn: string | null;
  nis: string | null;
  birthPlace: string | null;
  birthDate: Date | null;
};

type TracerStudyData = {
  student: StudentData;
  schoolName: string;
  className: string;
  jenjang: string | null;
  printLetterheadUrl: string | null;
};

const MARGIN = 20;

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
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.drawImage(img, 0, 0);
        resolve(canvas.toDataURL("image/png"));
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

export async function generateTracerStudyPdf(data: TracerStudyData): Promise<jsPDF> {
  const doc = new jsPDF({ unit: "mm", format: "a4", compress: true });
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
      // Fallback if image fails to load
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
  doc.text("FORMULIR PENELUSURAN ALUMNI (TRACER STUDY)", pageW / 2, y, { align: "center" });
  y += 5.5;
  doc.setFontSize(10);
  doc.text(`Tahun Kelulusan: ${new Date().getFullYear()}`, pageW / 2, y, { align: "center" });
  y += 10;

  // 3. Section: Identitas Alumni
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10.5);
  doc.text("A. IDENTITAS ALUMNI", MARGIN, y);
  y += 5.5;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  
  const labelW = 45;
  const xColon = MARGIN + labelW;
  const xVal = xColon + 3;

  const drawField = (label: string, value: string, isBold = false) => {
    doc.setFont("helvetica", "normal");
    doc.text(label, MARGIN + 4, y);
    doc.text(":", xColon, y);
    if (isBold) {
      doc.setFont("helvetica", "bold");
    }
    doc.text(value || ".........................................................................", xVal, y);
    doc.setFont("helvetica", "normal");
    y += 5.5;
  };

  const ttl = (data.student.birthPlace || "") + 
              (data.student.birthPlace && data.student.birthDate ? ", " : "") + 
              (data.student.birthDate ? new Intl.DateTimeFormat("id-ID", { day: "2-digit", month: "long", year: "numeric" }).format(new Date(data.student.birthDate)) : "");

  drawField("Nama Lengkap", data.student.name.toUpperCase(), true);
  drawField("Tempat, Tanggal Lahir", ttl);
  drawField("NISN / NIS", `${data.student.nisn || "-"} / ${data.student.nis || "-"}`);
  drawField("Kelas Terakhir", data.className);
  drawField("No. HP / WhatsApp", ".........................................................................");
  drawField("Email Aktif", ".........................................................................");
  drawField("Alamat Saat Ini", ".........................................................................");
  y += 2; // extra space for multiline address if they write it

  y += 5;

  // 4. Section: Status Setelah Lulus
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10.5);
  doc.text("B. STATUS SETELAH LULUS", MARGIN, y);
  y += 6;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  const txt1 = "Berilah tanda centang (";
  const txt2 = ") pada salah satu pilihan di bawah ini:";
  doc.text(txt1, MARGIN + 4, y);
  const w1 = doc.getTextWidth(txt1);
  doc.setFont("ZapfDingbats");
  doc.text("4", MARGIN + 4 + w1, y);
  const w2 = doc.getTextWidth("4");
  doc.setFont("helvetica", "normal");
  doc.text(txt2, MARGIN + 4 + w1 + w2, y);
  y += 7;

  const drawCheckbox = (label: string) => {
    doc.rect(MARGIN + 4, y - 3, 4, 4);
    doc.text(label, MARGIN + 12, y);
  };

  const drawOptionField = (label: string, value: string) => {
    const labelX = MARGIN + 12;
    const colonX = MARGIN + 58;
    const valX = colonX + 3;
    doc.text(label, labelX, y);
    doc.text(":", colonX, y);
    doc.text(value, valX, y);
    y += 5.5;
  };

  // Logic Jenjang Lanjutan
  let jenjangOptions = "SMP / MTs";
  const currentJenjang = data.jenjang ? data.jenjang.toUpperCase() : "";
  if (currentJenjang === "SMP" || currentJenjang === "MTS") {
    jenjangOptions = "SMA / SMK / MA / MAK";
  } else if (["SMA", "SMK", "MA", "MAK"].includes(currentJenjang)) {
    jenjangOptions = "Diploma / Sarjana (S1) / Akademi";
  }

  drawCheckbox("1. Melanjutkan Pendidikan");
  y += 6.5;
  drawOptionField("Jenjang Sekolah", `${jenjangOptions}  (Coret yang tidak perlu)`);
  drawOptionField("Nama Sekolah / PT", "................................................................");
  drawOptionField("Alamat Sekolah / PT", "................................................................");
  drawOptionField("Bulan dan Tahun Mulai", "................................................................");
  y += 3;

  drawCheckbox("2. Bekerja");
  y += 6.5;
  drawOptionField("Nama Perusahaan", "................................................................");
  drawOptionField("Alamat Perusahaan", "................................................................");
  drawOptionField("Bidang Pekerjaan", "................................................................");
  drawOptionField("Jabatan / Posisi", "................................................................");
  drawOptionField("Bulan & Tahun Masuk", "................................................................");
  y += 3;
  
  drawCheckbox("3. Wirausaha / Usaha Mandiri");
  y += 6.5;
  drawOptionField("Nama Usaha", "................................................................");
  drawOptionField("Bidang Usaha", "................................................................");
  drawOptionField("Alamat Usaha", "................................................................");
  drawOptionField("Bulan & Tahun Mulai", "................................................................");
  y += 3;

  drawCheckbox("4. Sedang Mencari Kerja / Belum Bekerja");
  y += 6.5;

  drawCheckbox("5. Lainnya:");
  doc.text(".............................................................................................", MARGIN + 28, y);
  y += 18; // Increased spacing before signature

  // 5. Signature
  const sigW = 85; // Increased width so it moves left
  const sigX = pageW - MARGIN - sigW;
  
  // ensure we don't bleed page
  if (y > 240) y = 240;

  doc.text(`................................, ....... - ........................ - 20......`, sigX, y);
  y += 5;
  doc.text("Alumni,", sigX, y);
  y += 18;
  doc.setFont("helvetica", "bold");
  doc.text(data.student.name.toUpperCase(), sigX, y);
  y += 1;
  doc.setLineWidth(0.3);
  const textWidth = doc.getTextWidth(data.student.name.toUpperCase());
  doc.line(sigX, y, sigX + textWidth, y);

  return doc;
}
