import type { TeacherLoginCardPdfRow } from "./buildTeacherLoginCardsPdf";

/**
 * Membuat file teks kartu login untuk banyak guru (unduh / simpan di perangkat pengguna).
 */
export function buildTeacherLoginCardsTxtBlob(params: {
  schoolName?: string;
  exportedAtLabel: string;
  loginUrl: string;
  cards: TeacherLoginCardPdfRow[];
  errors: string[];
}): Blob {
  const lines: string[] = [
    "══════════════════════════════════════",
    "KARTU LOGIN GURU (ringkasan semua)",
    "══════════════════════════════════════",
    "",
  ];
  if (params.schoolName) lines.push(`Sekolah: ${params.schoolName}`, "");
  lines.push(`Diekspor: ${params.exportedAtLabel}`, "", "");

  for (const c of params.cards) {
    lines.push(`── ${c.nama} ──`, `Email: ${c.email}`, `Password: ${c.password}`);
    if (params.loginUrl) {
      lines.push(`Link login: ${params.loginUrl}`);
    }
    lines.push(
      c.wasReset ? "(PIN baru dibuat karena password belum tersimpan di sistem.)" : "",
      "",
    );
  }

  if (params.errors.length > 0) {
    lines.push("── Gagal / dilewati ──", ...params.errors.map((e) => `- ${e}`), "");
  }

  return new Blob([lines.join("\n")], { type: "text/plain;charset=utf-8" });
}
