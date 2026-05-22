import { dispatchHtmlEmail, hasMailOutgoingConfigured } from "@/server/email/dispatch-html-email";

export { hasMailOutgoingConfigured };

/** Kirim kode OTP registrasi admin sekolah (Resend atau SMTP — lihat `dispatchHtmlEmail`). */
export async function sendRegistrationOtpEmail(
  toEmail: string,
  otpPlain: string,
): Promise<{ sent: boolean; errorText?: string }> {
  const html = `<p>Halo,</p><p>Gunakan kode berikut untuk menyelesaikan pendaftaran akun <strong>Administrator Sekolah</strong> (berlaku 15 menit):</p><p style="font-size:28px;font-weight:bold;letter-spacing:0.2em;">${otpPlain}</p><p>Jika Anda tidak meminta pendaftaran ini, abaikan email ini.</p>`;

  return dispatchHtmlEmail({
    to: toEmail,
    subject: "Kode konfirmasi registrasi — Sistem Nilai Ijazah",
    html,
  });
}
