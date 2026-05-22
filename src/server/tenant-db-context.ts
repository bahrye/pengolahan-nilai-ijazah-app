import type { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";

/** Klien Prisma dalam transaksi tenant (sama bentuk dengan `prisma.*`). */
export type TenantDb = Prisma.TransactionClient;

/** Aktifkan isolasi RLS di Postgres (set_config per transaksi). Lihat migrasi tenant_rls. */
export function isTenantRlsEnabled(): boolean {
  return process.env.DATABASE_TENANT_RLS === "1";
}

export function defaultTenantDb(): TenantDb {
  return prisma as unknown as TenantDb;
}

async function setTenantSchoolId(
  tx: Prisma.TransactionClient,
  schoolId: string,
): Promise<void> {
  await tx.$executeRaw`SELECT set_config('app.current_school_id', ${schoolId}, true)`;
}

async function setRlsBypass(
  tx: Prisma.TransactionClient,
  on: boolean,
): Promise<void> {
  await tx.$executeRaw`SELECT set_config('app.rls_bypass', ${on ? "on" : "off"}, true)`;
}

/**
 * Jalankan callback dalam transaksi dengan konteks sekolah untuk kebijakan RLS.
 * Tanpa `DATABASE_TENANT_RLS=1`, memakai klien global (tanpa transaksi tambahan).
 */
export async function runInTenantTransaction<T>(
  schoolId: string,
  fn: (db: TenantDb) => Promise<T>,
): Promise<T> {
  return prisma.$transaction(async (tx) => {
    if (isTenantRlsEnabled()) {
      await setRlsBypass(tx, false);
      await setTenantSchoolId(tx, schoolId);
    }
    return fn(tx);
  });
}

/** Operasi lintas tenant (superadmin) — hanya saat RLS aktif. */
export async function runWithRlsBypass<T>(
  fn: (db: TenantDb) => Promise<T>,
): Promise<T> {
  return prisma.$transaction(async (tx) => {
    if (isTenantRlsEnabled()) {
      await setRlsBypass(tx, true);
      await tx.$executeRaw`SELECT set_config('app.current_school_id', '', true)`;
    }
    return fn(tx);
  });
}

/**
 * Semua query tenant dalam satu konteks RLS (jika aktif).
 * Tanpa RLS: callback memakai `prisma` langsung tanpa overhead transaksi.
 */
export async function withTenantDb<T>(
  schoolId: string,
  fn: (db: TenantDb) => Promise<T>,
): Promise<T> {
  if (!isTenantRlsEnabled()) {
    return fn(defaultTenantDb());
  }
  return runInTenantTransaction(schoolId, fn);
}
