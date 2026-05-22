import type { NpsnSekolahPreview } from "@/server/npsn/types";

const BELAJAR_ID_SEARCH_URL =
  "https://api.data.belajar.id/data-portal-backend/v2/master-data/satuan-pendidikan/daftar-data-induk/360";

export const BELAJAR_ID_SUMBER_DATA = "Data Kemendikdasmen (api.data.belajar.id)";

function clean(s: unknown): string {
  return String(s ?? "").trim();
}

/** Hilangkan awalan PROV., KAB., KEC. (dan varian) pada label wilayah dari API Belajar ID. */
export function stripBelajarWilayahLabel(n: string): string {
  let s = clean(n);
  if (!s) return "";
  s = s.replace(/^(prov\.?\s*|provinsi\s+)/i, "");
  s = s.replace(/^(kab\.?\s*|kabupaten\s+)/i, "");
  s = s.replace(/^(kec\.?\s*|kecamatan\s+)/i, "");
  s = s.replace(/^kota\s+adm\.?\s*(?:\.\s*)?/i, "");
  s = s.replace(/^kota\s+/i, "");
  return s.trim();
}

type BelajarIdErrorBody = {
  error?: { message?: string; code?: number };
};

type BelajarIdSuccessBody = {
  data?: Record<string, unknown>[];
  meta?: { total?: number };
};

export function mapBelajarIdRecordToPreview(raw: Record<string, unknown>): NpsnSekolahPreview | null {
  const nama = clean(raw.nama);
  const npsn = clean(raw.npsn).replace(/\D/g, "");
  if (!nama || !npsn) return null;

  const kabRaw = clean(raw.namaKabupaten);
  const provRaw = clean(raw.namaProvinsi);

  return {
    npsn,
    nama,
    bentukPendidikan: clean(raw.bentukPendidikan),
    alamatJalan: clean(raw.alamatJalan) || null,
    namaDesaDagri: clean(raw.namaDesa) || null,
    namaKecamatanDagri: stripBelajarWilayahLabel(clean(raw.namaKecamatan)) || null,
    namaKabupatenDagri: stripBelajarWilayahLabel(kabRaw) || null,
    namaProvinsiDagri: stripBelajarWilayahLabel(provRaw) || null,
    sumberData: BELAJAR_ID_SUMBER_DATA,
    regencyNameRaw: kabRaw || null,
  };
}

export async function searchSatuanPendidikanBelajarId(
  keywordRaw: string,
  options?: { limit?: number; offset?: number },
): Promise<
  | { ok: true; items: NpsnSekolahPreview[]; total: number }
  | { ok: false; message: string }
> {
  const keyword = keywordRaw.trim();
  if (keyword.length < 2) {
    return {
      ok: false,
      message: "Masukkan minimal 2 karakter (NPSN atau nama sekolah).",
    };
  }

  const limit = options?.limit ?? 20;
  const offset = options?.offset ?? 0;
  const url = `${BELAJAR_ID_SEARCH_URL}?keyword=${encodeURIComponent(keyword)}&limit=${limit}&offset=${offset}`;

  let res: Response;
  try {
    res = await fetch(url, {
      headers: { Accept: "application/json" },
      next: { revalidate: 0 },
    });
  } catch {
    return {
      ok: false,
      message: "Tidak dapat menghubungi api.data.belajar.id. Periksa koneksi internet Anda.",
    };
  }

  let body: BelajarIdSuccessBody & BelajarIdErrorBody;
  try {
    body = (await res.json()) as BelajarIdSuccessBody & BelajarIdErrorBody;
  } catch {
    return { ok: false, message: "Respons api.data.belajar.id bukan JSON yang valid." };
  }

  if (res.status === 404 || body.error?.code === 404) {
    return {
      ok: false,
      message:
        "Sekolah tidak ditemukan. Coba NPSN 8 digit atau kata kunci nama sekolah yang lebih spesifik.",
    };
  }

  if (!res.ok) {
    const msg =
      typeof body.error?.message === "string"
        ? body.error.message
        : `Layanan api.data.belajar.id mengembalikan status ${res.status}.`;
    return { ok: false, message: msg };
  }

  const rows = Array.isArray(body.data) ? body.data : [];
  const items: NpsnSekolahPreview[] = [];
  for (const row of rows) {
    if (!row || typeof row !== "object") continue;
    const preview = mapBelajarIdRecordToPreview(row as Record<string, unknown>);
    if (preview) items.push(preview);
  }

  if (!items.length) {
    return {
      ok: false,
      message:
        "Tidak ada data sekolah pada respons api.data.belajar.id. Coba kata kunci lain.",
    };
  }

  const total = typeof body.meta?.total === "number" ? body.meta.total : items.length;
  return { ok: true, items, total };
}
