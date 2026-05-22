import type { Account } from "next-auth";

import { prisma } from "@/lib/prisma";

type GoogleAccountFields = Pick<
  Account,
  | "type"
  | "provider"
  | "providerAccountId"
  | "access_token"
  | "expires_at"
  | "token_type"
  | "scope"
  | "id_token"
>;

/**
 * Tautkan akun Google ke pengguna terdaftar tanpa `allowDangerousEmailAccountLinking`.
 * Dipanggil dari callback `signIn` setelah email diverifikasi ada di database.
 */
export async function ensureGoogleAccountLinked(
  userId: string,
  account: GoogleAccountFields,
): Promise<void> {
  if (account.provider !== "google") return;

  await prisma.account.upsert({
    where: {
      provider_providerAccountId: {
        provider: account.provider,
        providerAccountId: account.providerAccountId,
      },
    },
    create: {
      userId,
      type: account.type,
      provider: account.provider,
      providerAccountId: account.providerAccountId,
      access_token: account.access_token ?? null,
      expires_at: account.expires_at ?? null,
      token_type: account.token_type ?? null,
      scope: account.scope ?? null,
      id_token: account.id_token ?? null,
    },
    update: {
      userId,
      access_token: account.access_token ?? null,
      expires_at: account.expires_at ?? null,
      token_type: account.token_type ?? null,
      scope: account.scope ?? null,
      id_token: account.id_token ?? null,
    },
  });
}
