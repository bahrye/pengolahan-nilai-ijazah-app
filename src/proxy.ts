import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import NextAuth from "next-auth";

import { authConfig, type AppUserRole } from "@/auth.config";
import { evaluateApiRouteAccess } from "@/lib/api-route-policy";

export const runtime = "edge";

/** Edge-only: jangan impor `@/auth` (Prisma/bcrypt) — batas bundle Vercel Edge ~1 MB. */
const { auth } = NextAuth(authConfig);

const LOGIN = "/login";
const MAINTENANCE = "/maintenance";
const SUPER = "/superadmin";

async function isMaintenanceBlocking(req: NextRequest): Promise<boolean> {
  try {
    const url = new URL("/api/system/maintenance-status", req.nextUrl.origin);
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) return false;
    const data = (await res.json()) as { active?: boolean };
    return data.active === true;
  } catch {
    return false;
  }
}
const ALLOWED_ADMIN_PATHS_PREFIX = "/dashboard";
const PETA_SITUS_PATH = "/dashboard/peta-situs";
const STUDENT_ALLOWED_PREFIXES = [
  PETA_SITUS_PATH,
  "/dashboard/rekap-nilai-ijazah",
  "/dashboard/pengumuman",
  "/dashboard/skl-unduh",
] as const;
const GURU_UJIAN_PATH = "/dashboard/input/nilai-ujian";
const GURU_RAPOR_PATH = "/dashboard/input/nilai-rapor";
const GURU_CEK_VALIDASI_PATH = "/dashboard/cek-validasi-nilai";
const GURU_STATUS_KIRIM_PATH = "/dashboard/status-kirim-nilai";
const GURU_CETAK_NILAI_PATH = "/dashboard/guru/cetak-nilai";
const GURU_UBAH_PASSWORD_PATH = "/dashboard/guru/ubah-password";
const GURU_REKAP_IJAZAH_PATH = "/dashboard/rekap-nilai-ijazah";

export default auth(async function proxy(req) {
  const { pathname } = req.nextUrl;
  const loggedIn = !!req.auth;
  const role = req.auth?.user?.role as AppUserRole | undefined;
  const impersonatingSchoolId = req.auth?.user?.impersonatingSchoolId ?? null;
  const schoolId = req.auth?.user?.schoolId ?? impersonatingSchoolId ?? null;

  function redirect(url: string) {
    const u = new URL(url, req.nextUrl.origin);
    return NextResponse.redirect(u);
  }

  if (pathname === MAINTENANCE || pathname.startsWith(`${MAINTENANCE}/`)) {
    return NextResponse.next();
  }

  /* Rute login — arahkan ke maintenance jika aktif */
  if (pathname.startsWith(LOGIN)) {
    if (await isMaintenanceBlocking(req)) {
      return redirect(MAINTENANCE);
    }
    return NextResponse.next();
  }

  const maintenanceOn = await isMaintenanceBlocking(req);

  /* Pengguna masih login di dashboard — putuskan sesi & ke halaman maintenance */
  if (maintenanceOn && loggedIn && pathname.startsWith("/dashboard")) {
    return redirect("/api/system/maintenance-kick");
  }

  if (pathname.startsWith("/api")) {
    const apiDecision = evaluateApiRouteAccess(pathname, {
      loggedIn,
      role,
      schoolId,
    });
    if (!apiDecision.allow) {
      return NextResponse.json(
        { error: apiDecision.error },
        { status: apiDecision.status, headers: { "Cache-Control": "no-store" } },
      );
    }
    return NextResponse.next();
  }

  if (!loggedIn && pathname.startsWith("/superadmin")) {
    const u = new URL(LOGIN, req.nextUrl.origin);
    u.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(u);
  }

  if (!loggedIn && pathname.startsWith("/dashboard")) {
    if (maintenanceOn) {
      return redirect(MAINTENANCE);
    }
    const u = new URL(LOGIN, req.nextUrl.origin);
    u.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(u);
  }

  /* Superadmin: dashboard hanya saat masuk sebagai admin sekolah (impersonasi). */
  if (role === "SUPERADMIN" && pathname.startsWith("/dashboard")) {
    if (!impersonatingSchoolId && !schoolId) return redirect(SUPER);
  }

  if (role !== "SUPERADMIN" && pathname.startsWith("/superadmin")) {
    return redirect(ALLOWED_ADMIN_PATHS_PREFIX);
  }

  if (pathname.startsWith("/dashboard") && loggedIn && role === "SISWA") {
    const allowed = STUDENT_ALLOWED_PREFIXES.some((prefix) => pathname.startsWith(prefix));
    if (!allowed) {
      return redirect(`${ALLOWED_ADMIN_PATHS_PREFIX}/pengumuman`);
    }
    return NextResponse.next();
  }

  if (pathname.startsWith("/dashboard") && loggedIn && role === "GURU") {
    const isInputUjian = pathname === GURU_UJIAN_PATH || pathname.startsWith(`${GURU_UJIAN_PATH}/`);
    const isInputRapor = pathname === GURU_RAPOR_PATH || pathname.startsWith(`${GURU_RAPOR_PATH}/`);
    const isCekValidasi =
      pathname === GURU_CEK_VALIDASI_PATH ||
      pathname.startsWith(`${GURU_CEK_VALIDASI_PATH}/`);
    const isStatusKirim =
      pathname === GURU_STATUS_KIRIM_PATH || pathname.startsWith(`${GURU_STATUS_KIRIM_PATH}/`);
    const isRekapIjazah =
      pathname === GURU_REKAP_IJAZAH_PATH || pathname.startsWith(`${GURU_REKAP_IJAZAH_PATH}/`);
    const isCetakNilai =
      pathname === GURU_CETAK_NILAI_PATH || pathname.startsWith(`${GURU_CETAK_NILAI_PATH}/`);
    const isUbahPassword =
      pathname === GURU_UBAH_PASSWORD_PATH || pathname.startsWith(`${GURU_UBAH_PASSWORD_PATH}/`);
    const isPetaSitus =
      pathname === PETA_SITUS_PATH || pathname.startsWith(`${PETA_SITUS_PATH}/`);

    if (
      !isInputUjian &&
      !isInputRapor &&
      !isCekValidasi &&
      !isStatusKirim &&
      !isRekapIjazah &&
      !isCetakNilai &&
      !isUbahPassword &&
      !isPetaSitus
    ) {
      return redirect(GURU_UJIAN_PATH);
    }
    return NextResponse.next();
  }

  return NextResponse.next();
});

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/superadmin",
    "/superadmin/:path*",
    "/login",
    "/login/:path*",
    "/maintenance",
    "/api/:path*",
  ],
};
