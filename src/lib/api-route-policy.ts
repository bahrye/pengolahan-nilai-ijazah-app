import type { AppUserRole } from "@/auth.config";

/** API yang boleh diakses tanpa sesi (handler tetap memvalidasi token/secret sendiri). */
export const API_PUBLIC_PATHS = new Set([
  "/api/system/maintenance-status",
  "/api/keep-alive",
]);

export function isPublicApiPath(pathname: string): boolean {
  if (API_PUBLIC_PATHS.has(pathname)) return true;
  if (pathname === "/api/system/maintenance-kick") return true;
  if (pathname === "/api/auth" || pathname.startsWith("/api/auth/")) return true;
  return false;
}

export type ApiRouteDecision =
  | { allow: true }
  | { allow: false; status: 401 | 403; error: string };

/**
 * Kebijakan akses API di edge (proxy). Handler route tetap wajib memverifikasi tenant/role.
 */
export function evaluateApiRouteAccess(
  pathname: string,
  opts: {
    loggedIn: boolean;
    role?: AppUserRole;
    schoolId: string | null;
  },
): ApiRouteDecision {
  if (!pathname.startsWith("/api")) {
    return { allow: true };
  }

  if (isPublicApiPath(pathname)) {
    return { allow: true };
  }

  if (!opts.loggedIn) {
    return { allow: false, status: 401, error: "Unauthorized" };
  }

  const { role, schoolId } = opts;

  if (pathname.startsWith("/api/admin") || pathname.startsWith("/api/students")) {
    if (role !== "ADMIN_SEKOLAH" && role !== "SUPERADMIN") {
      return { allow: false, status: 403, error: "Forbidden" };
    }
    if (!schoolId) {
      return { allow: false, status: 403, error: "Forbidden" };
    }
    return { allow: true };
  }

  if (pathname.startsWith("/api/siswa")) {
    if (role !== "SISWA") {
      return { allow: false, status: 403, error: "Forbidden" };
    }
    return { allow: true };
  }

  return { allow: true };
}
