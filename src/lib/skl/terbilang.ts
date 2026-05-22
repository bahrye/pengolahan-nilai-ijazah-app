const SATU = [
  "",
  "Satu",
  "Dua",
  "Tiga",
  "Empat",
  "Lima",
  "Enam",
  "Tujuh",
  "Delapan",
  "Sembilan",
  "Sepuluh",
  "Sebelas",
  "Dua Belas",
  "Tiga Belas",
  "Empat Belas",
  "Lima Belas",
  "Enam Belas",
  "Tujuh Belas",
  "Delapan Belas",
  "Sembilan Belas",
];

function terbilangInt(n: number): string {
  if (!Number.isFinite(n) || n < 0) return "";
  if (n === 0) return "Nol";
  if (n < 20) return SATU[n] ?? String(n);
  if (n < 100) {
    const puluh = Math.floor(n / 10);
    const sisa = n % 10;
    const p = puluh === 1 ? "Sepuluh" : `${SATU[puluh]} Puluh`;
    return sisa === 0 ? p : `${p} ${SATU[sisa]}`.trim();
  }
  if (n < 200) {
    const sisa = n - 100;
    return sisa === 0 ? "Seratus" : `Seratus ${terbilangInt(sisa)}`.trim();
  }
  if (n < 1000) {
    const ratus = Math.floor(n / 100);
    const sisa = n % 100;
    return sisa === 0
      ? `${SATU[ratus]} Ratus`
      : `${SATU[ratus]} Ratus ${terbilangInt(sisa)}`.trim();
  }
  return String(n);
}

/** Contoh: 86,93 → "Delapan Enam Koma Sembilan Tiga" */
export function terbilangNilai(value: number | string | undefined): string {
  if (value === undefined || value === null || value === "") return "";
  const raw = typeof value === "number" ? value : parseFloat(String(value).replace(",", "."));
  if (Number.isNaN(raw)) return "";

  const neg = raw < 0;
  const abs = Math.abs(raw);
  const intPart = Math.floor(abs);
  const decStr = abs.toFixed(2).split(".")[1] ?? "00";

  let out = terbilangInt(intPart);
  if (decStr !== "00") {
    const digits = decStr
      .split("")
      .map((d) => SATU[Number(d)] ?? d)
      .join(" ");
    out = `${out} Koma ${digits}`.trim();
  }
  return neg ? `Minus ${out}` : out;
}

const DIGIT_WORD = [
  "Nol",
  "Satu",
  "Dua",
  "Tiga",
  "Empat",
  "Lima",
  "Enam",
  "Tujuh",
  "Delapan",
  "Sembilan",
];

function terbilangDigitChars(digits: string): string {
  const only = digits.replace(/\D/g, "");
  if (!only) return "";
  return only
    .split("")
    .map((d) => DIGIT_WORD[Number(d)] ?? d)
    .join(" ");
}

/**
 * Terbilang per digit sesuai tampilan nilai SKL.
 * Contoh: "93" → "Sembilan Tiga"; "86,93" → "Delapan Enam Koma Sembilan Tiga".
 */
export function terbilangNilaiTampilan(displayAngka: string | undefined): string {
  const s = String(displayAngka ?? "").trim();
  if (!s) return "";

  const comma = s.includes(",") ? "," : s.includes(".") ? "." : null;
  if (!comma) {
    return terbilangDigitChars(s);
  }

  const [intPart, decPart] = s.split(comma);
  let out = terbilangDigitChars(intPart ?? "");
  const dec = terbilangDigitChars(decPart ?? "");
  if (dec) {
    out = out ? `${out} Koma ${dec}` : `Koma ${dec}`;
  }
  return out.trim();
}
