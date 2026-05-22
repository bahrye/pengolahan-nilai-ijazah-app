import nodemailer from "nodemailer";

const RESEND_FETCH_TIMEOUT_MS = 20_000;

function smtpTimeoutMs(): number {
  const raw = Number(process.env.SMTP_SEND_TIMEOUT_MS?.trim());
  if (Number.isFinite(raw) && raw >= 5000 && raw <= 120_000) return raw;
  return 20_000;
}

function appendRenderSmtpHint(message: string): string {
  if (process.env.RENDER !== "true") return message;
  const m = message.toLowerCase();
  if (
    m.includes("timeout") ||
    m.includes("etimedout") ||
    m.includes("econnreset") ||
    m.includes("habis waktu") ||
    m.includes("greeting") ||
    m.includes("connection")
  ) {
    return `${message}\n\nCatatan hosting: layanan web gratis Render memblokir koneksi keluar ke port SMTP (25/465/587). Solusi: gunakan Resend (API HTTPS, set RESEND_API_KEY), SMTP relay pihak ketiga lewat HTTPS, atau upgrade ke plan berbayar agar SMTP diizinkan.`;
  }
  return message;
}

export function hasResendConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY?.trim());
}

/** Gmail / penyedia SMTP: set `SMTP_HOST`, `SMTP_USER`, `SMTP_PASS` (App Password untuk Gmail). */
export function hasSmtpConfigured(): boolean {
  return Boolean(
    process.env.SMTP_HOST?.trim() &&
      process.env.SMTP_USER?.trim() &&
      process.env.SMTP_PASS?.trim(),
  );
}

export function hasMailOutgoingConfigured(): boolean {
  return hasResendConfigured() || hasSmtpConfigured();
}

/** `resend` | `smtp` | kosong = otomatis (Resend dulu, lalu SMTP jika Resend gagal). */
function mailTransportMode(): "auto" | "resend" | "smtp" {
  const t = process.env.MAIL_TRANSPORT?.trim().toLowerCase();
  if (t === "smtp") return "smtp";
  if (t === "resend") return "resend";
  return "auto";
}

async function sendViaResend(params: {
  to: string;
  subject: string;
  html: string;
}): Promise<{ sent: boolean; errorText?: string }> {
  const keyRaw = process.env.RESEND_API_KEY;
  const key = keyRaw?.trim();
  if (!key) {
    return { sent: false, errorText: "Resend: RESEND_API_KEY belum diset." };
  }
  const from =
    process.env.RESEND_FROM?.trim() ?? "Sistem Nilai Ijazah <onboarding@resend.dev>";

  let res: Response;
  try {
    res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: [params.to],
        subject: params.subject,
        html: params.html,
      }),
      signal: AbortSignal.timeout(RESEND_FETCH_TIMEOUT_MS),
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return {
      sent: false,
      errorText: msg.includes("abort")
        ? `Resend: permintaan habis waktu (${RESEND_FETCH_TIMEOUT_MS} ms).`
        : `Resend: ${msg}`,
    };
  }

  if (!res.ok) {
    let errorText: string | undefined;
    try {
      const j = (await res.json()) as { message?: string };
      errorText = j.message;
    } catch {
      /* ignore */
    }
    return { sent: false, errorText };
  }
  return { sent: true };
}

async function sendViaSmtp(params: {
  to: string;
  subject: string;
  html: string;
}): Promise<{ sent: boolean; errorText?: string }> {
  const hostRaw = process.env.SMTP_HOST?.trim();
  const userRaw = process.env.SMTP_USER?.trim();
  const passRaw = process.env.SMTP_PASS?.trim()?.replace(/\s/g, "");

  if (!hostRaw || !userRaw || !passRaw) {
    return {
      sent: false,
      errorText: "SMTP_HOST, SMTP_USER, dan SMTP_PASS wajib diset untuk pengiriman lewat SMTP.",
    };
  }

  const host = hostRaw;
  const port = Number(process.env.SMTP_PORT?.trim() || "587");
  const user = userRaw;
  const pass = passRaw;
  const secure =
    process.env.SMTP_SECURE === "1" ||
    process.env.SMTP_SECURE === "true" ||
    String(port) === "465";

  const from =
    process.env.SMTP_FROM?.trim() ||
    process.env.EMAIL_FROM?.trim() ||
    `Sistem Nilai Ijazah <${user}>`;

  const sendTimeoutMs = smtpTimeoutMs();
  const useIpv4 = process.env.SMTP_FORCE_IPV4 !== "0";

  const smtpOptions = {
    host,
    port,
    secure,
    auth: { user, pass },
    pool: false,
    connectionTimeout: 14_000,
    greetingTimeout: 14_000,
    socketTimeout: sendTimeoutMs,
    requireTLS: !secure && port === 587,
    tls: {
      minVersion: "TLSv1.2" as const,
      servername: host,
    },
    ...(useIpv4 ? { family: 4 as const } : {}),
  } as Parameters<typeof nodemailer.createTransport>[0];

  const transporter = nodemailer.createTransport(smtpOptions);

  try {
    await Promise.race([
      transporter.sendMail({
        from,
        to: params.to,
        subject: params.subject,
        html: params.html,
      }),
      new Promise<never>((_, reject) => {
        setTimeout(() => {
          reject(
            new Error(
              `SMTP habis waktu (${sendTimeoutMs} ms) saat menghubungi ${host}:${port}.`,
            ),
          );
        }, sendTimeoutMs);
      }),
    ]);
    transporter.close();
    return { sent: true };
  } catch (e) {
    try {
      transporter.close();
    } catch {
      /* ignore */
    }
    const msg = e instanceof Error ? e.message : String(e);
    return { sent: false, errorText: appendRenderSmtpHint(msg) };
  }
}

/**
 * Kirim email HTML.
 * - `MAIL_TRANSPORT=smtp` → hanya SMTP.
 * - `MAIL_TRANSPORT=resend` → hanya Resend.
 * - Selain itu: Resend dulu; bila gagal dan SMTP terset, coba SMTP (berguna saat migrasi).
 */
export async function dispatchHtmlEmail(params: {
  to: string;
  subject: string;
  html: string;
}): Promise<{ sent: boolean; errorText?: string }> {
  const mode = mailTransportMode();

  if (mode === "smtp") {
    if (!hasSmtpConfigured()) {
      return {
        sent: false,
        errorText:
          "MAIL_TRANSPORT=smtp tetapi SMTP_HOST / SMTP_USER / SMTP_PASS belum lengkap di environment.",
      };
    }
    return sendViaSmtp(params);
  }

  if (mode === "resend") {
    if (!hasResendConfigured()) {
      return {
        sent: false,
        errorText: "MAIL_TRANSPORT=resend tetapi RESEND_API_KEY kosong.",
      };
    }
    return sendViaResend(params);
  }

  if (hasResendConfigured()) {
    const r = await sendViaResend(params);
    if (r.sent) return r;
    if (hasSmtpConfigured()) {
      const s = await sendViaSmtp(params);
      if (s.sent) return s;
      const parts = [`Resend: ${r.errorText?.trim() || "gagal"}.`, `SMTP: ${s.errorText?.trim() || "gagal"}.`];
      return { sent: false, errorText: parts.join(" ") };
    }
    return r;
  }

  if (hasSmtpConfigured()) return sendViaSmtp(params);
  return { sent: false };
}
