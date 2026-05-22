import type { UserRole } from "@prisma/client";

/** Nama akun di header (setelah nama sekolah), khusus layar besar. */
export function headerAccountDisplayLabel(
  role: UserRole,
  name: string | null | undefined,
): string | null {
  if (role === "ADMIN_SEKOLAH") return "Administrator";
  if (role === "SUPERADMIN") return "Superadmin";

  const trimmed = name?.trim();
  if (trimmed) return trimmed;

  if (role === "GURU") return "Guru";
  if (role === "SISWA") return "Siswa";
  return null;
}
