"use client";

import { Check, Copy } from "lucide-react";
import { useState } from "react";

export function CopyPaymentNumberButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard tidak tersedia */
    }
  }

  return (
    <button
      type="button"
      onClick={() => void handleCopy()}
      className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 shadow-sm transition hover:border-indigo-300 hover:text-indigo-700 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:border-indigo-500"
      aria-label={copied ? "Tersalin" : "Salin nomor"}
    >
      {copied ? (
        <>
          <Check className="size-3.5 text-emerald-600" aria-hidden />
          Tersalin
        </>
      ) : (
        <>
          <Copy className="size-3.5" aria-hidden />
          Salin
        </>
      )}
    </button>
  );
}
