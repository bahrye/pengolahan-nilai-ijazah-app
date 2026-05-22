"use client";

import { signOut } from "next-auth/react";

import { LOGIN_SIGNED_OUT_PATH } from "@/lib/auth-sign-out-path";

export { LOGIN_SIGNED_OUT_PATH } from "@/lib/auth-sign-out-path";

/**
 * Keluar aplikasi: hapus sesi JWT lewat API Auth.js, lalu navigasi penuh (bukan SPA saja)
 * agar cookie benar-benar ter-reset dan halaman login tidak mengira masih masuk.
 */
export async function performAppSignOut(
  redirectTo: string = LOGIN_SIGNED_OUT_PATH,
): Promise<void> {
  try {
    const result = await signOut({
      redirectTo,
      redirect: false,
    });
    const url =
      result && typeof result === "object" && "url" in result && result.url
        ? String(result.url)
        : redirectTo;
    window.location.assign(url);
  } catch {
    window.location.assign(redirectTo);
  }
}
