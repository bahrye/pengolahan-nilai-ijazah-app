/** Terbilang ringkas untuk nilai ujian (0–100 + hingga dua desimal). */

const angka = [
  "",
  "satu",
  "dua",
  "tiga",
  "empat",
  "lima",
  "enam",
  "tujuh",
  "delapan",
  "sembilan",
  "sepuluh",
  "sebelas",
];

function terbilangPuluh(n: number): string {
  if (n < 12) return angka[n] ?? "";
  if (n < 20) return `${angka[n - 10] ?? ""} belas`.trim();
  const p = Math.floor(n / 10);
  const s = n % 10;
  const depan = angka[p] ?? "";
  return s === 0 ? `${depan} puluh` : `${depan} puluh ${angka[s] ?? ""}`.trim();
}

function terbilangRatusan(n: number): string {
  if (n === 0) return "";
  if (n < 12) return angka[n] ?? "";
  if (n < 20) return `${angka[n - 10] ?? ""} belas`;
  if (n < 100) return terbilangPuluh(n);
  const r = Math.floor(n / 100);
  const sisa = n % 100;
  const awal = r === 1 ? "seratus" : `${angka[r] ?? ""} ratus`;
  if (sisa === 0) return awal;
  return `${awal} ${terbilangPuluh(sisa)}`.trim();
}

function digitTerbilang(d: string): string {
  if (d === "0") return "nol";
  const n = Number.parseInt(d, 10);
  if (Number.isNaN(n) || n < 0 || n > 9) return d;
  return angka[n] ?? d;
}

/** Contoh: 85 → "delapan puluh lima"; 85.5 → "delapan puluh lima koma lima"; 85.05 → "… koma nol lima". */
export function nilaiUjianToTerbilang(value: number): string {
  if (Number.isNaN(value) || !Number.isFinite(value)) return "—";
  const rounded = Math.round((value + Number.EPSILON) * 100) / 100;
  const [intRaw, fracRaw = "00"] = rounded.toFixed(2).split(".");
  const intPart = Number.parseInt(intRaw, 10);
  const intStr = terbilangRatusan(Math.abs(intPart));
  if (fracRaw === "00") {
    return intStr || "nol";
  }
  const fracWords = [...fracRaw].map((d) => digitTerbilang(d)).join(" ");
  return `${intStr || "nol"} koma ${fracWords}`.trim();
}
