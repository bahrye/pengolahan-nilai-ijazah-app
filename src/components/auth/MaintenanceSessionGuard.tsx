"use client";

import { useEffect } from "react";

import { performAppSignOut } from "@/lib/auth-sign-out";
import { MAINTENANCE_SIGN_OUT_PATH } from "@/lib/auth-sign-out-path";

const POLL_MS = 300_000; // 5 menit

/**
 * Memutus sesi jika maintenance diaktifkan saat pengguna masih di dashboard
 * (tanpa harus pindah halaman / reload manual).
 */
export function MaintenanceSessionGuard() {
  useEffect(() => {
    let cancelled = false;

    const check = async () => {
      try {
        const res = await fetch("/api/system/maintenance-status", {
          cache: "no-store",
        });
        if (!res.ok || cancelled) return;
        const data = (await res.json()) as { active?: boolean };
        if (data.active === true) {
          await performAppSignOut(MAINTENANCE_SIGN_OUT_PATH);
        }
      } catch {
        /* jaringan / sesi habis */
      }
    };

    void check();
    const id = window.setInterval(() => void check(), POLL_MS);
    const onVis = () => {
      if (document.visibilityState === "visible") void check();
    };
    document.addEventListener("visibilitychange", onVis);

    return () => {
      cancelled = true;
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, []);

  return null;
}
