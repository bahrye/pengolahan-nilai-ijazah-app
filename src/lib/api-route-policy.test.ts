import { describe, expect, it } from "vitest";

import {
  evaluateApiRouteAccess,
  isPublicApiPath,
} from "./api-route-policy";

describe("api-route-policy", () => {
  it("isPublicApiPath", () => {
    expect(isPublicApiPath("/api/auth/signin")).toBe(true);
    expect(isPublicApiPath("/api/auth/guru-login-contexts")).toBe(true);
    expect(isPublicApiPath("/api/system/maintenance-status")).toBe(true);
    expect(isPublicApiPath("/api/keep-alive")).toBe(true);
    expect(isPublicApiPath("/api/admin/skl-preview")).toBe(false);
  });

  it("blocks unauthenticated protected API", () => {
    const d = evaluateApiRouteAccess("/api/students/export", {
      loggedIn: false,
      schoolId: null,
    });
    expect(d).toEqual({ allow: false, status: 401, error: "Unauthorized" });
  });

  it("blocks siswa from admin API", () => {
    const d = evaluateApiRouteAccess("/api/students/template", {
      loggedIn: true,
      role: "SISWA",
      schoolId: "sch1",
    });
    expect(d).toEqual({ allow: false, status: 403, error: "Forbidden" });
  });

  it("allows tenant admin", () => {
    const d = evaluateApiRouteAccess("/api/admin/skl-preview", {
      loggedIn: true,
      role: "ADMIN_SEKOLAH",
      schoolId: "sch1",
    });
    expect(d).toEqual({ allow: true });
  });

  it("allows siswa skl download path", () => {
    const d = evaluateApiRouteAccess("/api/siswa/skl-download", {
      loggedIn: true,
      role: "SISWA",
      schoolId: "sch1",
    });
    expect(d).toEqual({ allow: true });
  });

  it("blocks guru from siswa API", () => {
    const d = evaluateApiRouteAccess("/api/siswa/skl-download", {
      loggedIn: true,
      role: "GURU",
      schoolId: "sch1",
    });
    expect(d).toEqual({ allow: false, status: 403, error: "Forbidden" });
  });
});
