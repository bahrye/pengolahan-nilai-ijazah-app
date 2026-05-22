"use client";

import { LogOut } from "lucide-react";
import { useState } from "react";

import { performAppSignOut } from "@/lib/auth-sign-out";

export function SignOutButton({ className }: { className?: string }) {
  const [busy, setBusy] = useState(false);

  return (
    <button
      type="button"
      disabled={busy}
      aria-busy={busy}
      onClick={() => {
        if (busy) return;
        setBusy(true);
        void performAppSignOut();
      }}
      className={
        className ??
        "ui-btn ui-btn-primary ui-btn-sm shrink-0 whitespace-nowrap disabled:opacity-70"
      }
    >
      <LogOut className="size-4 shrink-0" aria-hidden />
      {busy ? "Keluar…" : "Keluar"}
    </button>
  );
}
