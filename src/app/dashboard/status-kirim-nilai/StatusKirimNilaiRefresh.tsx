"use client";

import { RefreshCw } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";

export function StatusKirimNilaiRefresh() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => startTransition(() => router.refresh())}
      className="ui-btn ui-btn-ghost inline-flex shrink-0 items-center gap-2"
      title="Muat ulang data dari server"
    >
      <RefreshCw className={`size-4 ${pending ? "animate-spin" : ""}`} aria-hidden />
      {pending ? "Memuat…" : "Segarkan"}
    </button>
  );
}
