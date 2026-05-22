import ExcelJS from "exceljs";

const SHEET_PASSWORD = "syamsulbahri";

export type ExportMasterStudentRow = {
  nisn: string;
  name: string;
  gender: string;
  birthPlace: string | null;
  birthDate: string | null;
  className: string | null;
  nomorUjian: string | null;
  ruangUjian: string | null;
  parentGuardianName: string | null;
  sklLetterNumber: string | null;
  nis: string | null;
};

export async function buildMasterSiswaExcelBuffer(
  classNames: string[],
  students: ExportMasterStudentRow[],
): Promise<ArrayBuffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "Sistem Nilai Ijazah";
  wb.created = new Date();

  /* ── Sheet 1: Input Siswa ── */
  const ws = wb.addWorksheet("Input Siswa");

  const headerFill: ExcelJS.Fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FF4F46E5" },
  };
  const headerFont: Partial<ExcelJS.Font> = {
    bold: true,
    color: { argb: "FFFFFFFF" },
    size: 11,
  };
  const headerBorder: Partial<ExcelJS.Borders> = {
    top: { style: "thin" },
    left: { style: "thin" },
    bottom: { style: "thin" },
    right: { style: "thin" },
  };

  const columns = [
    { header: "NISN", key: "nisn", width: 16 },
    { header: "Nama Lengkap", key: "name", width: 30 },
    { header: "Jenis Kelamin (L/P)", key: "gender", width: 20 },
    { header: "Tempat Lahir", key: "birthPlace", width: 22 },
    { header: "Tanggal Lahir (YYYY-MM-DD)", key: "birthDate", width: 28 },
    { header: "Kelas", key: "className", width: 22 },
    { header: "Nomor Peserta Ujian", key: "nomorUjian", width: 26 },
    { header: "Nomor Ruang", key: "ruangUjian", width: 14 },
    { header: "Nama Ayah", key: "parentGuardianName", width: 28 },
    { header: "Nomor Surat SKL", key: "sklLetterNumber", width: 36 },
    { header: "NIS Lokal", key: "nis", width: 22 },
  ];
  ws.columns = columns;

  const headerRow = ws.getRow(1);
  headerRow.eachCell((cell) => {
    cell.fill = headerFill;
    cell.font = headerFont;
    cell.border = headerBorder;
    cell.alignment = { vertical: "middle", horizontal: "center" };
  });
  headerRow.height = 28;

  /* Satu validasi per rentang (bukan ribuan sel) — jauh lebih cepat saat writeBuffer */
  const wsDv = ws as ExcelJS.Worksheet & {
    dataValidations: { add: (addr: string, v: ExcelJS.DataValidation) => void };
  };
  wsDv.dataValidations.add("C2:C10001", {
    type: "list",
    allowBlank: true,
    formulae: ['"L,P"'],
  });
  const refSheetName = "Ref_Kelas";
  if (classNames.length > 0) {
    wsDv.dataValidations.add("F2:F10001", {
      type: "list",
      allowBlank: true,
      formulae: [`'${refSheetName}'!$A$2:$A$${classNames.length + 1}`],
      showErrorMessage: true,
      errorTitle: "Kelas tidak valid",
      error: "Pilih kelas dari daftar yang tersedia.",
    });
  }
  ws.getColumn(5).numFmt = "yyyy-mm-dd";

  if (students.length === 0) {
    // Beri contoh jika kosong (mode template)
    const exampleRow = ws.getRow(2);
    exampleRow.getCell(1).value = "0012345678";
    exampleRow.getCell(2).value = "Contoh Nama Siswa";
    exampleRow.getCell(3).value = "L";
    exampleRow.getCell(4).value = "Jakarta";
    exampleRow.getCell(5).value = "2012-05-15";
    exampleRow.getCell(6).value = classNames[0] ?? "6A";
    exampleRow.getCell(7).value = "26-21-04-2-0021-0001";
    exampleRow.getCell(8).value = "1";
    exampleRow.getCell(9).value = "Nama Ayah Contoh";
    exampleRow.getCell(10).value = "B.089/MTs.21.04.26/PP.001.1/06/2024";
    exampleRow.getCell(11).value = "121273020015210019";
    exampleRow.eachCell((cell) => {
      cell.font = { italic: true, color: { argb: "FF9CA3AF" } };
    });
  } else {
    // Isi data siswa yang diekspor
    students.forEach((s, i) => {
      const row = ws.getRow(i + 2);
      row.getCell(1).value = s.nisn;
      row.getCell(2).value = s.name;
      row.getCell(3).value = s.gender;
      row.getCell(4).value = s.birthPlace ?? "";
      row.getCell(5).value = s.birthDate ?? "";
      row.getCell(6).value = s.className ?? "";
      row.getCell(7).value = s.nomorUjian ?? "";
      row.getCell(8).value = s.ruangUjian ?? "";
      row.getCell(9).value = s.parentGuardianName ?? "";
      row.getCell(10).value = s.sklLetterNumber ?? "";
      row.getCell(11).value = s.nis ?? "";
    });
  }

  /* ── Sheet 2: Referensi Kelas (locked) ── */
  const refWs = wb.addWorksheet("Ref_Kelas");

  const refHeaderRow = refWs.getRow(1);
  refWs.getColumn(1).width = 30;
  refWs.getCell("A1").value = "Nama Kelas";
  refWs.getCell("A1").fill = headerFill;
  refWs.getCell("A1").font = headerFont;
  refWs.getCell("A1").border = headerBorder;
  refWs.getCell("A1").alignment = { vertical: "middle", horizontal: "center" };
  refHeaderRow.height = 28;

  classNames.forEach((name, i) => {
    refWs.getCell(`A${i + 2}`).value = name;
  });

  if (classNames.length === 0) {
    refWs.getCell("A2").value = "(Belum ada kelas)";
    refWs.getCell("A2").font = { italic: true, color: { argb: "FF9CA3AF" } };
  }

  await refWs.protect(SHEET_PASSWORD, {
    selectLockedCells: true,
    selectUnlockedCells: true,
    formatCells: false,
    formatColumns: false,
    formatRows: false,
    insertColumns: false,
    insertRows: false,
    insertHyperlinks: false,
    deleteColumns: false,
    deleteRows: false,
    sort: false,
    autoFilter: false,
    pivotTables: false,
  });

  const buf = await wb.xlsx.writeBuffer();
  return buf as ArrayBuffer;
}
