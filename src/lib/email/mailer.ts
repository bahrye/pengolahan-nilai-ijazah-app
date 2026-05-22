import { Resend } from "resend";

export type EmailAttachment = {
  filename: string;
  content: Buffer;
  contentType: string;
};

export function isEmailConfigured(): boolean {
  return Boolean(
    process.env.RESEND_API_KEY?.trim() && process.env.RESEND_FROM?.trim(),
  );
}

function getResend(): Resend {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  if (!apiKey) {
    throw new Error("RESEND_API_KEY belum dikonfigurasi.");
  }
  return new Resend(apiKey);
}

export async function sendEmail(opts: {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
  attachments?: EmailAttachment[];
}): Promise<void> {
  if (!isEmailConfigured()) {
    console.warn(
      "[email] Resend tidak dikonfigurasi (RESEND_API_KEY, RESEND_FROM) — email tidak dikirim.",
    );
    return;
  }

  const from = process.env.RESEND_FROM!.trim();
  const to = Array.isArray(opts.to) ? opts.to : [opts.to];

  const { error } = await getResend().emails.send({
    from,
    to,
    subject: opts.subject,
    html: opts.html,
    text: opts.text ?? opts.html.replace(/<[^>]+>/g, " "),
    attachments: opts.attachments?.map((a) => ({
      filename: a.filename,
      content: a.content,
    })),
  });

  if (error) {
    throw new Error(error.message);
  }
}
