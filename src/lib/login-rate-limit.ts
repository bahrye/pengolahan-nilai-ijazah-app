

import { NextResponse } from "next/server";

import { clientIpFromRequest } from "@/lib/http/client-ip";
import {
  consumeRateLimit,
  peekRateLimit,
  resetRateLimit,
  type RateLimitResult,
} from "@/lib/rate-limit";

const FIFTEEN_MIN = 15 * 60 * 1000;
const ONE_HOUR = 60 * 60 * 1000;

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function hashKey(str: string): string {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) + hash) + str.charCodeAt(i);
  }
  return (hash >>> 0).toString(16);
}

export function rateLimit429Response(retryAfterSec: number): NextResponse {
  return NextResponse.json(
    {
      ok: false,
      message: `Terlalu banyak percobaan. Coba lagi dalam ${retryAfterSec} detik.`,
    },
    {
      status: 429,
      headers: { "Retry-After": String(retryAfterSec) },
    },
  );
}

function firstBlocked(results: RateLimitResult[]): RateLimitResult | null {
  for (const r of results) {
    if (!r.ok) return r;
  }
  return null;
}

/** Pratinjau login (guru/siswa) — batasi per IP dan per identitas. */
export function enforceLoginPreviewRateLimit(
  req: Request,
  identity?: string,
): NextResponse | null {
  const ip = clientIpFromRequest(req);
  const checks: RateLimitResult[] = [
    consumeRateLimit(`login-preview:ip:${ip}`, 30, FIFTEEN_MIN),
  ];
  if (identity) {
    checks.push(
      consumeRateLimit(`login-preview:id:${hashKey(identity)}`, 12, FIFTEEN_MIN),
    );
  }
  const blocked = firstBlocked(checks);
  if (!blocked || blocked.ok) return null;
  return rateLimit429Response(blocked.retryAfterSec);
}

const CREDENTIAL_FAIL_WINDOW = FIFTEEN_MIN;
const CREDENTIAL_FAIL_MAX = 12;
const STUDENT_CREDENTIAL_FAIL_MAX = 8;

function credentialFailKey(identifier: string): string {
  return `cred-fail:${hashKey(normalizeEmail(identifier))}`;
}

function studentCredentialFailKey(identifier: string): string {
  return `cred-fail-siswa:${hashKey(normalizeEmail(identifier))}`;
}

/** Blokir percobaan sandi berulang (credentials / siswa). */
export function assertCredentialLoginAllowed(identifier: string): boolean {
  return peekRateLimit(credentialFailKey(identifier), CREDENTIAL_FAIL_MAX).ok;
}

export function recordCredentialLoginFailure(identifier: string) {
  consumeRateLimit(credentialFailKey(identifier), CREDENTIAL_FAIL_MAX, CREDENTIAL_FAIL_WINDOW);
}

export function clearCredentialLoginFailures(identifier: string) {
  resetRateLimit(credentialFailKey(identifier));
}

/** Pratinjau / login siswa (NISN) — lebih ketat dari login guru umum. */
export function enforceStudentLoginRateLimit(
  req: Request,
  nisn: string,
): NextResponse | null {
  const ip = clientIpFromRequest(req);
  const nisnKey = hashKey(nisn.replace(/\D/g, "").slice(0, 10));
  const checks: RateLimitResult[] = [
    consumeRateLimit(`student-login:ip:${ip}`, 20, FIFTEEN_MIN),
    consumeRateLimit(`student-login:nisn:${nisnKey}`, 5, FIFTEEN_MIN),
  ];
  const blocked = firstBlocked(checks);
  if (!blocked || blocked.ok) return null;
  return rateLimit429Response(blocked.retryAfterSec);
}

export function assertStudentCredentialLoginAllowed(identifier: string): boolean {
  return peekRateLimit(
    studentCredentialFailKey(identifier),
    STUDENT_CREDENTIAL_FAIL_MAX,
  ).ok;
}

export function recordStudentCredentialLoginFailure(identifier: string) {
  consumeRateLimit(
    studentCredentialFailKey(identifier),
    STUDENT_CREDENTIAL_FAIL_MAX,
    CREDENTIAL_FAIL_WINDOW,
  );
}

export function clearStudentCredentialLoginFailures(identifier: string) {
  resetRateLimit(studentCredentialFailKey(identifier));
}

/** Pendaftaran admin sekolah baru — per email dan per IP. */
export function enforceAdminRegistrationRateLimit(
  email: string,
  ip: string,
): { ok: true } | { ok: false; message: string } {
  const checks: RateLimitResult[] = [
    consumeRateLimit(`admin-reg:ip:${ip}`, 6, ONE_HOUR),
    consumeRateLimit(`admin-reg:email:${hashKey(normalizeEmail(email))}`, 2, ONE_HOUR),
  ];
  const blocked = firstBlocked(checks);
  if (!blocked || blocked.ok) return { ok: true };
  return {
    ok: false,
    message: `Terlalu banyak percobaan pendaftaran. Coba lagi dalam ${blocked.retryAfterSec} detik.`,
  };
}

/** Permintaan reset sandi — per email dan per IP. */
export function enforcePasswordResetRateLimit(
  email: string,
  ip: string,
): { ok: true } | { ok: false; message: string } {
  const checks: RateLimitResult[] = [
    consumeRateLimit(`pwd-reset:ip:${ip}`, 8, ONE_HOUR),
    consumeRateLimit(`pwd-reset:email:${hashKey(normalizeEmail(email))}`, 3, ONE_HOUR),
  ];
  const blocked = firstBlocked(checks);
  if (!blocked || blocked.ok) return { ok: true };
  return {
    ok: false,
    message: `Terlalu banyak permintaan reset sandi. Coba lagi dalam ${blocked.retryAfterSec} detik.`,
  };
}
