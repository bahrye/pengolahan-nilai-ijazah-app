"use client";

import { ArrowLeft, Shield } from "lucide-react";
import { useSession } from "next-auth/react";
import { useState } from "react";

import { exitSuperadminSchoolAction } from "@/server/actions/superadmin-impersonation";

export function SuperadminImpersonationBanner({
  schoolName,
}: {
  schoolName: string;
}) {
  const { update } = useSession();
  const [busy, setBusy] = useState(false);

  async function handleExit() {
    if (busy) return;
    setBusy(true);
    try {
      const res = await exitSuperadminSchoolAction();
      if (!res.ok) return;
      await update({ impersonatingSchoolId: null });
      window.location.assign("/superadmin");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className="flex flex-col gap-3 border-b border-indigo-200/80 bg-indigo-50 px-4 py-3 text-sm dark:border-indigo-900/60 dark:bg-indigo-950/50 sm:flex-row sm:items-center sm:justify-between lg:px-8"
      role="status"
    >
      <div className="flex min-w-0 items-start gap-2.5 text-indigo-950 dark:text-indigo-100">
        <Shield className="mt-0.5 size-4 shrink-0 text-indigo-600 dark:text-indigo-400" aria-hidden />
        <p className="min-w-0 text-pretty">
          Anda masuk sebagai admin sekolah{" "}
          <strong className="font-semibold">{schoolName}</strong>.
        </p>
      </div>
      <button
        type="button"
        disabled={busy}
        onClick={() => void handleExit()}
        className="ui-btn ui-btn-primary ui-btn-sm inline-flex shrink-0 items-center gap-1.5 self-start sm:self-center"
      >
        <ArrowLeft className="size-3.5" aria-hidden />
        {busy ? "Memuat…" : "Kembali ke akun superadmin"}
      </button>
    </div>
  );
}
