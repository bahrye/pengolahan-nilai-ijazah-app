import type { KabupatenType } from "@prisma/client";

import { mapBentukPendidikanToJenjang } from "@/domain/school-levels";
import { searchSatuanPendidikanBelajarId, stripBelajarWilayahLabel } from "@/server/npsn/belajar-id-api";
import type { NpsnSekolahPreview, SchoolCreateFromNpsn } from "@/server/npsn/types";

export type { NpsnSekolahPreview, SchoolCreateFromNpsn } from "@/server/npsn/types";

function inferKabupatenType(kab: string | null | undefined): KabupatenType {
  const u = (kab ?? "").toUpperCase();
  if (u.startsWith("KOTA ") || u.includes("KOTA ADM")) return "Kota";
  return "Kabupaten";
}

/** Normalisasi teks alamat wilayah untuk kolom Prisma. */
function clean(s: unknown): string {
  return String(s ?? "").trim();
}

/** Hilangkan awalan Prov./Kab./Kec. (dan varian) pada label wilayah dari API. */
function stripWilayahLabel(n: string): string {
  return stripBelajarWilayahLabel(clean(n));
}

/**
 * API referensi kadang mengembalikan bidang sekolah di `data` langsung,
 * kadang bersarang di `data.satuanPendidikan` (bentuk terbaru).
 */
function schoolFieldsFromApiData(data: Record<string, unknown>): Record<string, unknown> {
  const nested = data.satuanPendidikan;
  if (nested && typeof nested === "object" && !Array.isArray(nested)) {
    return nested as Record<string, unknown>;
  }
  return data;
}

function mapProvider2Fields(raw: Record<string, unknown>): Record<string, unknown> {
  const alamat =
    raw.alamat && typeof raw.alamat === "object" && !Array.isArray(raw.alamat)
      ? (raw.alamat as Record<string, unknown>)
      : {};
  return {
    npsn: raw.npsn,
    nama: raw.nama,
    bentukPendidikan: raw.bentukPendidikan,
    alamatJalan: typeof raw.alamat === "string" ? raw.alamat : alamat.jalan,
    namaDesaDagri: raw.nama_desa ?? alamat.nama_desa,
    namaKecamatanDagri: raw.nama_kecamatan ?? alamat.nama_kecamatan,
    namaKabupatenDagri: raw.nama_kabupaten ?? alamat.nama_kabupaten,
    namaProvinsiDagri: raw.nama_provinsi ?? alamat.nama_provinsi,
  };
}

function parseProvider1(root: unknown): { ok: true; preview: NpsnSekolahPreview } | { ok: false; message: string } {
  const body = root as { data?: Record<string, unknown> };
  const d = body.data;
  if (!d || typeof d !== "object") {
    return { ok: false, message: "Format respons NPSN (v1) tidak dikenali." };
  }

  if ("error" in d && d.error) {
    const err = d.error as { message?: string };
    return {
      ok: false,
      message: typeof err.message === "string" ? err.message : "Sekolah tidak ditemukan.",
    };
  }

  const s = schoolFieldsFromApiData(d);
  const nama = clean(s.nama);
  if (!nama) {
    return { ok: false, message: "Data sekolah dari layanan NPSN belum lengkap." };
  }

  return {
    ok: true,
    preview: {
      npsn: clean(s.npsn),
      nama,
      bentukPendidikan: clean(s.bentukPendidikan),
      alamatJalan: clean(s.alamatJalan) || null,
      namaDesaDagri: clean(s.namaDesaDagri) || null,
      namaKecamatanDagri: clean(s.namaKecamatanDagri) || null,
      namaKabupatenDagri: clean(s.namaKabupatenDagri) || null,
      namaProvinsiDagri: clean(s.namaProvinsiDagri) || null,
      sumberData: "Referensi NPSN (fazriansyah.eu.org)",
    },
  };
}

function parseProvider2(root: unknown): { ok: true; preview: NpsnSekolahPreview } | { ok: false; message: string } {
  const body = root as { data?: unknown };
  let raw: Record<string, unknown> | null = null;
  if (Array.isArray(body.data)) {
    const first = body.data[0];
    if (first && typeof first === "object") raw = first as Record<string, unknown>;
  } else if (body.data && typeof body.data === "object") {
    raw = body.data as Record<string, unknown>;
  } else if (root && typeof root === "object" && !Array.isArray(root)) {
    raw = root as Record<string, unknown>;
  }
  if (!raw) {
    return { ok: false, message: "Format respons NPSN (cadangan) tidak dikenali." };
  }
  const s = mapProvider2Fields(raw);
  const nama = clean(s.nama);
  if (!nama) {
    return { ok: false, message: "Data sekolah dari layanan cadangan belum lengkap." };
  }

  return {
    ok: true,
    preview: {
      npsn: clean(s.npsn),
      nama,
      bentukPendidikan: clean(s.bentukPendidikan),
      alamatJalan: clean(s.alamatJalan) || null,
      namaDesaDagri: clean(s.namaDesaDagri) || null,
      namaKecamatanDagri: clean(s.namaKecamatanDagri) || null,
      namaKabupatenDagri: clean(s.namaKabupatenDagri) || null,
      namaProvinsiDagri: clean(s.namaProvinsiDagri) || null,
      sumberData: "Referensi NPSN (sekolah.devapi.id)",
    },
  };
}

/** Ambil daftar objek sekolah dari respons use.api.co.id (bentuk respons bervariasi). */
function extractApiCoSchoolList(root: unknown): Record<string, unknown>[] {
  if (!root || typeof root !== "object" || Array.isArray(root)) return [];
  const o = root as Record<string, unknown>;
  const pushObjects = (arr: unknown): Record<string, unknown>[] => {
    if (!Array.isArray(arr)) return [];
    return arr.filter((x): x is Record<string, unknown> => Boolean(x) && typeof x === "object" && !Array.isArray(x));
  };

  const fromData = pushObjects(o.data);
  if (fromData.length) return fromData;

  const d = o.data;
  if (d && typeof d === "object" && !Array.isArray(d)) {
    const inner = d as Record<string, unknown>;
    for (const k of ["schools", "items", "results", "records", "rows"]) {
      const arr = inner[k];
      const list = pushObjects(arr);
      if (list.length) return list;
    }
    if (inner.npsn != null || inner.nama != null) return [inner];
  }

  for (const k of ["schools", "items", "results"]) {
    const list = pushObjects(o[k]);
    if (list.length) return list;
  }

  return [];
}

function parseProvider3(
  root: unknown,
  digits: string,
): { ok: true; preview: NpsnSekolahPreview } | { ok: false; message: string } {
  const list = extractApiCoSchoolList(root);
  const match = list.find((r) => String(r.npsn ?? "").replace(/\D/g, "") === digits);
  const raw = match ?? list[0];
  if (!raw) {
    return { ok: false, message: "Data sekolah dari layanan api.co.id tidak ditemukan atau formatnya tidak dikenali." };
  }

  const pick = (a: unknown, b: unknown) => (a != null && String(a).trim() !== "" ? clean(a) : clean(b));

  const nama = pick(raw.nama, raw.name);
  if (!nama) {
    return { ok: false, message: "Data sekolah dari layanan api.co.id belum lengkap." };
  }

  const npsn = clean(raw.npsn);
  const grade = pick(raw.grade, raw.bentukPendidikan);
  const address = pick(raw.address, raw.alamat);
  const provRaw = pick(raw.province_name, raw.provinceName);
  const kabRaw = pick(raw.regency_name, raw.regencyName);

  return {
    ok: true,
    preview: {
      npsn,
      nama,
      bentukPendidikan: grade,
      alamatJalan: address || null,
      namaDesaDagri: null,
      namaKecamatanDagri: null,
      namaKabupatenDagri: stripWilayahLabel(kabRaw) || null,
      namaProvinsiDagri: stripWilayahLabel(provRaw) || null,
      sumberData: "Referensi NPSN (use.api.co.id)",
      omitDesaKec: true,
      regencyNameRaw: kabRaw || null,
    },
  };
}

export function mapNpsnPayloadToSchoolCreate(p: NpsnSekolahPreview): SchoolCreateFromNpsn {
  const kab = clean(p.namaKabupatenDagri);
  const kabForType = clean(p.regencyNameRaw) || clean(p.namaKabupatenDagri) || kab;
  const hideDesaKec = p.omitDesaKec === true;

  return {
    npsn: clean(p.npsn),
    namaSekolah: clean(p.nama),
    jenjang: mapBentukPendidikanToJenjang(p.bentukPendidikan),
    alamat: clean(p.alamatJalan) || null,
    provinsi: clean(p.namaProvinsiDagri) || "—",
    tipeKabupaten: inferKabupatenType(kabForType),
    kabupaten: kab || "—",
    kecamatan: hideDesaKec ? "" : clean(p.namaKecamatanDagri) || "—",
    tipeKelurahan: "Kelurahan",
    kelurahan: hideDesaKec ? "" : clean(p.namaDesaDagri) || "—",
  };
}

function mergePreviewNpsn(
  preview: NpsnSekolahPreview,
  digits: string,
): NpsnSekolahPreview {
  return {
    ...preview,
    npsn: clean(preview.npsn) || digits,
  };
}

async function fetchProvider3(
  digits: string,
): Promise<
  | { ok: true; preview: NpsnSekolahPreview }
  | { ok: false; message: string }
  | { skip: true }
> {
  const key = process.env.USE_API_CO_ID_KEY?.trim();
  if (!key) return { skip: true };

  const url3 = `https://use.api.co.id/regional/indonesia/schools?npsn=${encodeURIComponent(digits)}&page=1`;
  let res3: Response;
  try {
    res3 = await fetch(url3, {
      headers: {
        Accept: "application/json",
        "x-api-co-id": key,
      },
      next: { revalidate: 0 },
    });
  } catch {
    return { ok: false, message: "Tidak dapat menghubungi layanan api.co.id (jaringan)." };
  }

  if (res3.status === 429) {
    return { ok: false, message: "Layanan api.co.id sedang padat (429). Coba lagi beberapa detik." };
  }

  if (!res3.ok) {
    return {
      ok: false,
      message: `Layanan api.co.id mengembalikan status ${res3.status}.`,
    };
  }

  let json3: unknown;
  try {
    json3 = await res3.json();
  } catch {
    return { ok: false, message: "Respons api.co.id bukan JSON yang valid." };
  }

  const p3 = parseProvider3(json3, digits);
  if (!p3.ok) return p3;
  return { ok: true, preview: p3.preview };
}

export async function searchSekolahByKeyword(
  keywordRaw: string,
): Promise<
  | { ok: true; results: NpsnSekolahPreview[]; total: number }
  | { ok: false; message: string }
> {
  const belajar = await searchSatuanPendidikanBelajarId(keywordRaw, { limit: 20, offset: 0 });
  if (!belajar.ok) return belajar;
  return { ok: true, results: belajar.items, total: belajar.total };
}

export async function fetchSekolahByNpsn(
  npsnRaw: string,
): Promise<
  | { ok: true; preview: NpsnSekolahPreview }
  | { ok: false; message: string }
> {
  const digits = npsnRaw.replace(/\D/g, "");
  if (digits.length !== 8) {
    return { ok: false, message: "NPSN harus 8 digit angka." };
  }

  const belajar = await searchSatuanPendidikanBelajarId(digits, { limit: 5, offset: 0 });
  if (belajar.ok) {
    const exact =
      belajar.items.find((item) => item.npsn.replace(/\D/g, "") === digits) ?? belajar.items[0];
    if (exact && exact.npsn.replace(/\D/g, "") === digits) {
      return { ok: true, preview: mergePreviewNpsn(exact, digits) };
    }
  }

  const url1 = `https://api.fazriansyah.eu.org/v1/sekolah?npsn=${encodeURIComponent(digits)}`;
  const url2 = `https://sekolah.devapi.id/sekolah?npsn=${encodeURIComponent(digits)}`;

  let res1: Response;
  try {
    res1 = await fetch(url1, {
      headers: { Accept: "application/json" },
      next: { revalidate: 0 },
    });
  } catch {
    res1 = new Response(null, { status: 599, statusText: "Network Error" });
  }

  if (res1.ok) {
    try {
      const json1 = await res1.json();
      const p1 = parseProvider1(json1);
      if (p1.ok) {
        return { ok: true, preview: mergePreviewNpsn(p1.preview, digits) };
      }
    } catch {
      // lanjut ke provider 2
    }
  }

  let res2: Response | null = null;
  let json2: unknown | null = null;
  try {
    res2 = await fetch(url2, {
      headers: { Accept: "application/json" },
      next: { revalidate: 0 },
    });
  } catch {
    const p3 = await fetchProvider3(digits);
    if ("ok" in p3 && p3.ok) return { ok: true, preview: mergePreviewNpsn(p3.preview, digits) };
    return {
      ok: false,
      message:
        res1.status === 429
          ? "Layanan NPSN sedang padat (429). Coba lagi beberapa detik."
          : "Tidak dapat menghubungi layanan pencarian NPSN.",
    };
  }

  if (!res2.ok) {
    const p3 = await fetchProvider3(digits);
    if ("ok" in p3 && p3.ok) return { ok: true, preview: mergePreviewNpsn(p3.preview, digits) };
    if (res1.status === 429 || res2.status === 429) {
      return { ok: false, message: "Layanan NPSN sedang padat (429). Coba lagi beberapa detik." };
    }
    return { ok: false, message: `Layanan NPSN mengembalikan status ${res2.status}.` };
  }

  try {
    json2 = await res2.json();
  } catch {
    const p3 = await fetchProvider3(digits);
    if ("ok" in p3 && p3.ok) return { ok: true, preview: mergePreviewNpsn(p3.preview, digits) };
    return { ok: false, message: "Respons NPSN bukan JSON yang valid." };
  }

  const p2 = parseProvider2(json2);
  if (!p2.ok) {
    const p3 = await fetchProvider3(digits);
    if ("ok" in p3 && p3.ok) return { ok: true, preview: mergePreviewNpsn(p3.preview, digits) };
    if ("ok" in p3 && !p3.ok && process.env.USE_API_CO_ID_KEY?.trim()) {
      return { ok: false, message: `${p2.message} (${p3.message})` };
    }
    return { ok: false, message: p2.message };
  }

  return { ok: true, preview: mergePreviewNpsn(p2.preview, digits) };
}
