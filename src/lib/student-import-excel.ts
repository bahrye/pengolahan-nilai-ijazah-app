import type { Worksheet } from "exceljs";

/** Hapus awalan "Kelas " dari label PDUM (mis. "Kelas 9" → "9"). */
export function normalizeImportedClassName(
  raw: string | null | undefined,
): string | null {
  if (raw == null) return null;
  let s = String(raw).trim();
  if (!s) return null;
  s = s.replace(/^kelas\s+/i, "").trim();
  return s || null;
}

/** Ubah nilai tanggal sel / teks ke YYYY-MM-DD. */
export function parseBirthDateToIso(raw: unknown): string | null {
  if (raw instanceof Date && !Number.isNaN(raw.getTime())) {
    return raw.toISOString().slice(0, 10);
  }
  const text = String(raw ?? "").trim();
  if (!text) return null;

  const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(text);
  if (iso) return text.slice(0, 10);

  const dmy = /^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/.exec(text);
  if (dmy) {
    const dd = dmy[1].padStart(2, "0");
    const mm = dmy[2].padStart(2, "0");
    return `${dmy[3]}-${mm}-${dd}`;
  }

  return null;
}

function normalizeHeaderLabel(raw: string): string {
  return raw
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[()]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

type HeaderKey =
  | "no"
  | "nomorPeserta"
  | "nisn"
  | "nama"
  | "gender"
  | "birthPlace"
  | "birthDate"
  | "className"
  | "parentGuardianName"
  | "ruangUjian"
  | "sklLetterNumber"
  | "nis";

const HEADER_ALIASES: Record<string, HeaderKey> = {
  no: "no",
  "nomor peserta": "nomorPeserta",
  "nomor peserta ujian": "nomorPeserta",
  nopes: "nomorPeserta",
  nisn: "nisn",
  nama: "nama",
  "nama lengkap": "nama",
  "jenis kelamin": "gender",
  jk: "gender",
  "tempat lahir": "birthPlace",
  "tgl lahir dd-mm-yyyy": "birthDate",
  "tgl lahir": "birthDate",
  "tanggal lahir": "birthDate",
  "tanggal lahir yyyy-mm-dd": "birthDate",
  kelas: "className",
  "nama ayah": "parentGuardianName",
  "nomor ruang": "ruangUjian",
  ruang: "ruangUjian",
  "nomor surat skl": "sklLetterNumber",
  "nomor surat": "sklLetterNumber",
  "no surat": "sklLetterNumber",
  "no surat skl": "sklLetterNumber",
  nis: "nis",
  "nis lokal": "nis",
  "nomor induk siswa": "nis",
  "nomor induk siswa nis lengkap": "nis",
};

function mapHeaderToKey(label: string): HeaderKey | null {
  const norm = normalizeHeaderLabel(label);
  return HEADER_ALIASES[norm] ?? null;
}

function cellText(value: unknown): string {
  if (value == null) return "";
  if (typeof value === "object" && value !== null && "text" in value) {
    return String((value as { text?: string }).text ?? "").trim();
  }
  if (typeof value === "object" && value !== null && "result" in value) {
    return cellText((value as { result?: unknown }).result);
  }
  return String(value).trim();
}

function findPdumHeaderRow(ws: Worksheet): { rowNumber: number; cols: Partial<Record<HeaderKey, number>> } | null {
  for (let r = 1; r <= 20; r++) {
    const cols: Partial<Record<HeaderKey, number>> = {};
    ws.getRow(r).eachCell({ includeEmpty: false }, (cell, colNumber) => {
      const key = mapHeaderToKey(cellText(cell.value));
      if (key) cols[key] = colNumber;
    });
    if (cols.nisn && cols.nama) {
      return { rowNumber: r, cols };
    }
  }
  return null;
}

function isInternalTemplateSheet(ws: Worksheet): boolean {
  const h1 = cellText(ws.getRow(1).getCell(1).value).toLowerCase();
  const h2 = cellText(ws.getRow(1).getCell(2).value).toLowerCase();
  return h1 === "nisn" && (h2.includes("nama") || h2 === "nama lengkap");
}

export type ParsedStudentImportRow = {
  excelRow: number;
  nisn: string;
  name: string;
  gender: string;
  birthPlace: string;
  birthDate: string;
  className: string;
  classRoomName: string;
  nomorUjian: string;
  ruangUjian: string;
  parentGuardianName: string;
  sklLetterNumber: string;
  nis: string;
  error?: string;
};

export type StudentImportParseResult = {
  format: "pdum" | "internal";
  headerRow: number;
  rows: ParsedStudentImportRow[];
};

function validateParsedRow(
  partial: Omit<ParsedStudentImportRow, "error">,
): ParsedStudentImportRow {
  const missing: string[] = [];
  const nisnDigits = partial.nisn.replace(/\D/g, "");
  if (!nisnDigits) missing.push("NISN");
  else if (!/^\d{10}$/.test(nisnDigits)) {
    return {
      ...partial,
      nisn: nisnDigits || partial.nisn,
      error: "NISN harus tepat 10 digit angka.",
    };
  }
  if (!partial.name.trim()) missing.push("Nama");
  if (!partial.birthDate) missing.push("Tanggal Lahir");

  const error =
    missing.length > 0 ? `${missing.join(", ")} kosong atau tidak valid` : undefined;

  return {
    ...partial,
    nisn: nisnDigits || partial.nisn,
    error,
  };
}

function parsePdumRows(
  ws: Worksheet,
  header: { rowNumber: number; cols: Partial<Record<HeaderKey, number>> },
): ParsedStudentImportRow[] {
  const { cols } = header;
  const rows: ParsedStudentImportRow[] = [];
  const lastRow = ws.rowCount;

  for (let r = header.rowNumber + 1; r <= lastRow; r++) {
    const row = ws.getRow(r);
    const get = (key: HeaderKey) => {
      const col = cols[key];
      if (!col) return "";
      return cellText(row.getCell(col).value);
    };

    const nisn = get("nisn");
    const name = get("nama");
    if (!nisn && !name) continue;

    const genderRaw = get("gender").toUpperCase();
    const gender = genderRaw === "P" ? "P" : "L";
    const classRaw = normalizeImportedClassName(get("className")) ?? "";
    const birthDate = parseBirthDateToIso(
      cols.birthDate ? row.getCell(cols.birthDate).value : "",
    );

    const ruangRaw = get("ruangUjian").trim();

    rows.push(
      validateParsedRow({
        excelRow: r,
        nisn,
        name,
        gender,
        birthPlace: get("birthPlace"),
        birthDate: birthDate ?? "",
        className: classRaw,
        classRoomName: classRaw,
        nomorUjian: get("nomorPeserta"),
        ruangUjian: ruangRaw || "1",
        parentGuardianName: get("parentGuardianName"),
        sklLetterNumber: get("sklLetterNumber"),
        nis: get("nis"),
      }),
    );
  }

  return rows;
}

function parseInternalRows(ws: Worksheet): ParsedStudentImportRow[] {
  const rows: ParsedStudentImportRow[] = [];
  const lastRow = ws.rowCount;

  for (let r = 2; r <= lastRow; r++) {
    const row = ws.getRow(r);
    const nisn = cellText(row.getCell(1).value);
    const name = cellText(row.getCell(2).value);
    if (!nisn && !name) continue;

    const genderRaw = cellText(row.getCell(3).value).toUpperCase();
    const gender = genderRaw === "P" ? "P" : "L";
    const birthPlace = cellText(row.getCell(4).value);
    const birthDate = parseBirthDateToIso(row.getCell(5).value) ?? "";
    const classRaw = normalizeImportedClassName(cellText(row.getCell(6).value)) ?? "";
    const nomorUjian = cellText(row.getCell(7).value);
    const ruangRaw = cellText(row.getCell(8).value);
    const parentGuardianName = cellText(row.getCell(9).value);
    const sklLetterNumber = cellText(row.getCell(10).value);
    const nis = cellText(row.getCell(11).value);

    rows.push(
      validateParsedRow({
        excelRow: r,
        nisn,
        name,
        gender,
        birthPlace,
        birthDate,
        className: classRaw,
        classRoomName: classRaw,
        nomorUjian,
        ruangUjian: ruangRaw || "1",
        parentGuardianName,
        sklLetterNumber,
        nis,
      }),
    );
  }

  return rows;
}

/** Deteksi format PDUM atau template internal, lalu parse baris siswa. */
export function parseStudentImportWorksheet(ws: Worksheet): StudentImportParseResult {
  if (isInternalTemplateSheet(ws)) {
    return {
      format: "internal",
      headerRow: 1,
      rows: parseInternalRows(ws),
    };
  }

  const pdumHeader = findPdumHeaderRow(ws);
  if (pdumHeader) {
    return {
      format: "pdum",
      headerRow: pdumHeader.rowNumber,
      rows: parsePdumRows(ws, pdumHeader),
    };
  }

  return { format: "internal", headerRow: 1, rows: [] };
}

/** Pilih worksheet yang berisi data siswa. */
export function pickStudentImportWorksheet(
  worksheets: Worksheet[],
): Worksheet | null {
  for (const ws of worksheets) {
    const name = (ws.name ?? "").toLowerCase();
    if (name.includes("input siswa")) return ws;
  }
  for (const ws of worksheets) {
    const probe = findPdumHeaderRow(ws);
    if (probe) return ws;
  }
  for (const ws of worksheets) {
    if (isInternalTemplateSheet(ws)) return ws;
  }
  return worksheets[0] ?? null;
}
