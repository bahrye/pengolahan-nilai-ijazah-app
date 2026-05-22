/** URL publik aplikasi untuk tautan email (reset sandi, dll.). */
export function appBaseUrl(): string {
  const u =
    process.env.NEXTAUTH_URL?.trim() ??
    process.env.AUTH_URL?.trim() ??
    process.env.VERCEL_URL?.trim();
  if (!u) return "http://localhost:3000";
  if (u.startsWith("http://") || u.startsWith("https://")) return u.replace(/\/+$/, "");
  return `https://${u}`.replace(/\/+$/, "");
}
