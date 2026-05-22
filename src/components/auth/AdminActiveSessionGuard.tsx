"use client";

import { useEffect } from "react";

import { LOGIN_QUERY_ACCOUNT_DEACTIVATED } from "@/lib/admin-account-status";
import { performAppSignOut } from "@/lib/auth-sign-out";
import { verifyAdminSessionActiveAction } from "@/server/actions/session-active";

const POLL_MS = 300_000; // 5 menit

export function AdminActiveSessionGuard() {
  useEffect(() => {
    let cancelled = false;

    const check = async () => {
      try {
        const r = await verifyAdminSessionActiveAction();
        if (cancelled || r.ok) return;
        if (r.reason === "deactivated") {
          await performAppSignOut(
            `/login?error=${LOGIN_QUERY_ACCOUNT_DEACTIVATED}`,
          );
        }
      } catch {
        /* sesi habis — biarkan alur auth normal */
      }
    };

    void check();
    const id = window.setInterval(() => void check(), POLL_MS);
    const onFocus = () => void check();
    const onVis = () => {
      if (document.visibilityState === "visible") void check();
    };
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVis);

    return () => {
      cancelled = true;
      window.clearInterval(id);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, []);

  return null;
}
