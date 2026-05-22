import { prisma } from "@/lib/prisma";

/** Parse daftar email dari env (koma atau titik koma). */
export function parseEmailList(raw: string): string[] {
  return [
    ...new Set(
      raw
        .split(/[,;]/)
        .map((e) => e.trim().toLowerCase())
        .filter((e) => e.includes("@")),
    ),
  ];
}

/** Email superadmin dari env `SUPERADMIN_EMAILS` (sama sumber dengan login Google). */
export function getSuperadminEmailsFromEnv(): string[] {
  return parseEmailList(process.env.SUPERADMIN_EMAILS ?? "");
}

/** Env + akun aktif berperan SUPERADMIN di database. */
export async function getSuperadminEmails(): Promise<string[]> {
  const fromEnv = getSuperadminEmailsFromEnv();
  const fromDb = await prisma.user.findMany({
    where: { role: "SUPERADMIN", isActive: true },
    select: { email: true },
  });
  const dbEmails = fromDb
    .map((u) => u.email.trim().toLowerCase())
    .filter((e) => e.includes("@"));
  return [...new Set([...fromEnv, ...dbEmails])];
}

export async function getSchoolAdminEmails(
  schoolId: string,
  extraUserId?: string,
): Promise<string[]> {
  const [admins, extra] = await Promise.all([
    prisma.user.findMany({
      where: {
        schoolId,
        role: "ADMIN_SEKOLAH",
        isActive: true,
      },
      select: { email: true },
    }),
    extraUserId
      ? prisma.user.findUnique({
          where: { id: extraUserId },
          select: { email: true },
        })
      : Promise.resolve(null),
  ]);

  const emails = admins.map((u) => u.email.trim().toLowerCase());
  if (extra?.email) {
    emails.push(extra.email.trim().toLowerCase());
  }
  return [...new Set(emails.filter((e) => e.includes("@")))];
}
