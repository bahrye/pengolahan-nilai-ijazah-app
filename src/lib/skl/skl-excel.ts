import ExcelJS from "exceljs";

export const SKL_EXCEL_SHEET_NAME = "Data SKL";

export const SKL_EXCEL_COLUMNS = [
  { header: "NISN", key: "nisn", width: 14 },
  { header: "Nama Siswa", key: "name", width: 28 },
  { header: "Nomor Surat SKL", key: "sklLetterNumber", width: 36 },
  { header: "Nama Ayah/Wali Laki-Laki", key: "parentGuardianName", width: 28 },
  { header: "Nomor Induk Siswa (NIS) Lengkap", key: "nis", width: 26 },
] as const;

export type SklExcelRow = {
  nisn: string;
  name: string;
  sklLetterNumber: string;
  parentGuardianName: string;
  nis: string;
};

export async function buildSklExcelBuffer(rows: SklExcelRow[]): Promise<ArrayBuffer> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet(SKL_EXCEL_SHEET_NAME);

  ws.columns = SKL_EXCEL_COLUMNS.map((c) => ({ ...c }));

  const headerRow = ws.getRow(1);
  headerRow.font = { bold: true, color: { argb: "FFFFFFFF" } };
  headerRow.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FF4F46E5" },
  };
  headerRow.alignment = { vertical: "middle", horizontal: "center" };
  headerRow.height = 24;

  for (const r of rows) {
    ws.addRow(r);
  }

  if (rows.length === 0) {
    ws.addRow({
      nisn: "0012345678",
      name: "Contoh Nama Siswa",
      sklLetterNumber: "B.089/MTs.21.04.26/PP.001.1/06/2024",
      parentGuardianName: "Nama Wali",
      nis: "121273020015210019",
    });
  }

  return wb.xlsx.writeBuffer() as Promise<ArrayBuffer>;
}
