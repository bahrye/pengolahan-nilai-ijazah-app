import { google } from "googleapis";

const PDF_MIME = "application/pdf";
const NISN_PDF = /^(\d{10})\.pdf$/i;

/** Hilangkan tanda kutip pembungkus umum dari nilai .env (Vercel/dll.). */
function stripOuterQuotes(s: string): string {
  const t = s.trim();
  if (t.length >= 2) {
    const a = t[0];
    const b = t[t.length - 1];
    if ((a === '"' && b === '"') || (a === "'" && b === "'")) return t.slice(1, -1).trim();
  }
  return t;
}

function normalizeClientEmail(raw: string): string {
  return stripOuterQuotes(raw).trim();
}

function normalizePrivateKey(raw: string): string {
  let k = stripOuterQuotes(raw);
  k = k.replace(/\\n/g, "\n");
  return k;
}

export function getConfiguredSklServiceEmail(): string | null {
  const n = normalizeClientEmail(process.env.GOOGLE_DRIVE_SKL_CLIENT_EMAIL ?? "");
  return n || null;
}

export function isGoogleDriveSklConfigured(): boolean {
  const email = process.env.GOOGLE_DRIVE_SKL_CLIENT_EMAIL;
  const key = process.env.GOOGLE_DRIVE_SKL_PRIVATE_KEY;
  return Boolean(email?.trim() && key?.trim());
}

function getDriveClient() {
  const clientEmail = normalizeClientEmail(process.env.GOOGLE_DRIVE_SKL_CLIENT_EMAIL ?? "");
  const privateKey = normalizePrivateKey(process.env.GOOGLE_DRIVE_SKL_PRIVATE_KEY ?? "");
  if (!clientEmail || !privateKey.trim()) return null;

  const auth = new google.auth.GoogleAuth({
    credentials: {
      client_email: clientEmail,
      private_key: privateKey,
    },
    scopes: ["https://www.googleapis.com/auth/drive.readonly"],
  });

  return google.drive({ version: "v3", auth });
}

function driveApiDetail(e: unknown): { status?: number; reason?: string; apiMessage?: string } {
  const g = e as {
    response?: { status?: number; data?: { error?: { message?: string; errors?: { reason?: string }[] } } };
    message?: string;
  };
  const status = g.response?.status;
  const err = g.response?.data?.error;
  const apiMessage = typeof err?.message === "string" ? err.message : undefined;
  const reason = err?.errors?.[0]?.reason;
  return { status, reason, apiMessage };
}

function formatDriveAccessError(detail: { status?: number; reason?: string; apiMessage?: string }): string {
  const bits: string[] = [
    "Akses ditolak ke folder Drive (403). Periksa hal berikut:",
    "1) Di Google Cloud Console, pada proyek yang sama dengan service account ini, aktifkan API \"Google Drive\".",
    "2) Di Drive, folder yang tautannya Anda simpan harus dibagikan ke email service account yang sama persis dengan yang ditampilkan di halaman ini (Pembaca / Viewer cukup).",
    "3) Pastikan GOOGLE_DRIVE_SKL_PRIVATE_KEY di hosting adalah kunci privat dari JSON key yang sama dengan email service account tersebut (satu baris dengan \\n; hindari tanda kutip ganda membungkus seluruh kunci).",
    "4) Setelah mengubah env di Vercel/Render, lakukan redeploy / restart agar nilai terbaca ulang.",
    "5) Jika pakai Google Workspace sekolah, admin mungkin membatasi berbagi ke akun luar — minta pengecualian untuk email …iam.gserviceaccount.com.",
  ];
  if (detail.apiMessage) bits.push(`Detail Google: ${detail.apiMessage}`);
  if (detail.reason) bits.push(`Alasan: ${detail.reason}`);
  return bits.join("\n");
}

/**
 * Kumpulkan NISN dari nama berkas PDF di folder: hanya `1234567890.pdf` (huruf besar/kecil .pdf).
 */
export async function listSklNisnFromDriveFolder(
  folderId: string,
): Promise<{ ok: true; nisnSet: Set<string> } | { ok: false; message: string }> {
  const drive = getDriveClient();
  if (!drive) {
    return {
      ok: false,
      message:
        "Integrasi Google Drive belum diatur di server (variabel GOOGLE_DRIVE_SKL_*). Hubungi pengelola aplikasi.",
    };
  }
  const api = drive;

  const nisnSet = new Set<string>();
  let pageToken: string | undefined;

  const q = `'${folderId}' in parents and mimeType = '${PDF_MIME}' and trashed = false`;

  async function listPage(opts: {
    supportsAllDrives: boolean;
    includeItemsFromAllDrives: boolean;
  }) {
    return api.files.list({
      q,
      fields: "nextPageToken, files(name)",
      pageSize: 1000,
      pageToken,
      supportsAllDrives: opts.supportsAllDrives,
      includeItemsFromAllDrives: opts.includeItemsFromAllDrives,
    });
  }

  try {
    /* Cek akses ke folder (pesan error lebih jelas daripada langsung list). */
    try {
      await api.files.get({
        fileId: folderId,
        fields: "id,name,mimeType",
        supportsAllDrives: true,
      });
    } catch (e: unknown) {
      const d = driveApiDetail(e);
      if (d.status === 404) {
        return { ok: false, message: "Folder Google Drive tidak ditemukan. Periksa tautan atau ID folder." };
      }
      if (d.status === 403) {
        return { ok: false, message: formatDriveAccessError(d) };
      }
      throw e;
    }

    for (;;) {
      let res;
      try {
        res = await listPage({ supportsAllDrives: true, includeItemsFromAllDrives: true });
      } catch (e: unknown) {
        const d = driveApiDetail(e);
        if (d.status === 403) {
          res = await listPage({ supportsAllDrives: false, includeItemsFromAllDrives: false });
        } else {
          throw e;
        }
      }

      const files = res.data.files ?? [];
      for (const f of files) {
        const name = f.name?.trim();
        if (!name) continue;
        const m = NISN_PDF.exec(name);
        if (m?.[1]) nisnSet.add(m[1]);
      }

      pageToken = res.data.nextPageToken ?? undefined;
      if (!pageToken) break;
    }

    return { ok: true, nisnSet };
  } catch (e: unknown) {
    const d = driveApiDetail(e);
    const msg = typeof (e as { message?: string }).message === "string" ? (e as { message: string }).message : String(e);
    if (d.status === 404) {
      return { ok: false, message: "Folder Google Drive tidak ditemukan. Periksa tautan atau ID folder." };
    }
    if (d.status === 403 || /insufficient|forbidden/i.test(msg)) {
      return { ok: false, message: formatDriveAccessError(d) };
    }
    return { ok: false, message: `Gagal membaca Google Drive: ${d.apiMessage ?? msg}` };
  }
}

/**
 * Cari berkas PDF SKL `{NISN}.pdf` di folder (nama mengikuti pola 10 digit + .pdf, tidak peka huruf pada ekstensi).
 */
export async function findSklPdfFileIdForNisn(folderId: string, nisn: string): Promise<string | null> {
  const drive = getDriveClient();
  if (!drive) return null;
  const api = drive;

  const digits = nisn.replace(/\D/g, "").slice(0, 10);
  if (digits.length !== 10) return null;

  const q = `'${folderId}' in parents and mimeType = '${PDF_MIME}' and trashed = false`;
  let pageToken: string | undefined;

  async function listPage(supportsAllDrives: boolean, includeItemsFromAllDrives: boolean) {
    return api.files.list({
      q,
      fields: "nextPageToken, files(id,name)",
      pageSize: 500,
      pageToken,
      supportsAllDrives,
      includeItemsFromAllDrives,
    });
  }

  try {
    for (;;) {
      let res;
      try {
        res = await listPage(true, true);
      } catch (e: unknown) {
        const d = driveApiDetail(e);
        if (d.status === 403) {
          res = await listPage(false, false);
        } else {
          return null;
        }
      }

      for (const f of res.data.files ?? []) {
        const name = f.name?.trim();
        if (!name || !f.id) continue;
        const m = NISN_PDF.exec(name);
        if (m?.[1] === digits) return f.id;
      }

      pageToken = res.data.nextPageToken ?? undefined;
      if (!pageToken) break;
    }
  } catch {
    return null;
  }

  return null;
}

/** Unduh isi berkas PDF (bytes) — dipakai rute API siswa. */
export async function fetchSklPdfArrayBuffer(fileId: string): Promise<
  { ok: true; buffer: ArrayBuffer } | { ok: false; status: number; message: string }
> {
  const drive = getDriveClient();
  if (!drive) {
    return { ok: false, status: 503, message: "Integrasi Drive tidak tersedia." };
  }
  const api = drive;

  try {
    const res = await api.files.get({ fileId, alt: "media" }, { responseType: "arraybuffer" });
    const data = res.data as ArrayBuffer | undefined;
    if (!data || (typeof data === "object" && "byteLength" in data && (data as ArrayBuffer).byteLength === 0)) {
      return { ok: false, status: 502, message: "Berkas kosong atau tidak dapat dibaca." };
    }
    return { ok: true, buffer: data as ArrayBuffer };
  } catch (e: unknown) {
    const d = driveApiDetail(e);
    if (d.status === 404) return { ok: false, status: 404, message: "Berkas tidak ditemukan." };
    if (d.status === 403) return { ok: false, status: 403, message: "Akses ke berkas ditolak." };
    return { ok: false, status: 502, message: d.apiMessage ?? "Gagal mengunduh dari Drive." };
  }
}
