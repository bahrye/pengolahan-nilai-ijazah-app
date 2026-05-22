import { appBaseUrl } from "@/server/app-url";
import { dispatchHtmlEmail } from "@/server/email/dispatch-html-email";

/** Kirim tautan reset sandi (Resend atau SMTP). */
export async function sendPasswordResetEmail(
  toEmail: string,
  tokenPlain: string,
): Promise<{ sent: boolean; errorText?: string }> {
  const url = `${appBaseUrl()}/login/setel-ulang?token=${encodeURIComponent(tokenPlain)}`;
  const html = `<p>Halo,</p><p>Klik tautan berikut untuk membuat sandi baru (berlaku 60 menit):</p><p><a href="${url}">${url}</a></p><p>Jika Anda tidak meminta pengaturan ini, abaikan email ini.</p>`;

  return dispatchHtmlEmail({
    to: toEmail,
    subject: "Setel ulang sandi — Sistem Nilai Ijazah",
    html,
  });
}
