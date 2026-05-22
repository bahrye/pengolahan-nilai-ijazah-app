"use client";

import { motion } from "framer-motion";
import { ArrowLeft, Eye, EyeOff, Lock } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { resetPasswordWithTokenAction } from "@/server/actions/credentials-auth";

export function ResetPasswordForm({ token }: { token: string }) {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password !== confirm) {
      setError("Konfirmasi sandi tidak cocok.");
      return;
    }
    setBusy(true);
    const r = await resetPasswordWithTokenAction(token, password);
    setBusy(false);
    if (!r.ok) {
      setError(r.message);
      return;
    }
    router.push("/login?reset=1");
    router.refresh();
  }

  return (
    <div className="relative isolate min-h-[100dvh] w-full overflow-hidden px-4 py-12 sm:px-8">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 bg-[linear-gradient(160deg,var(--mesh-a)_0%,transparent_45%),linear-gradient(-40deg,var(--mesh-b)_0%,transparent_44%)] opacity-95 dark:opacity-[0.45]"
      />
      <style>{`
        :root { --mesh-a: rgb(226 232 255 / 0.85); --mesh-b: rgb(204 251 241 / 0.75); }
        .dark { --mesh-a: rgb(67 56 202 / 0.35); --mesh-b: rgb(14 116 144 / 0.28); }
      `}</style>

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="mx-auto w-full max-w-[440px] overflow-hidden rounded-[1.4rem] border border-white/60 bg-[rgb(255_255_255/0.5)] shadow-[0_28px_70px_-40px_rgb(15_23_42/0.5)] backdrop-blur-2xl dark:border-slate-700/50 dark:bg-[rgb(15_23_42/0.95)]"
      >
        <div className="border-b border-white/10 bg-gradient-to-br from-violet-700 to-indigo-800 px-8 py-6 text-white">
          <Link
            href="/login"
            className="mb-5 inline-flex items-center gap-1.5 text-[13px] font-semibold text-white/90 hover:text-white"
          >
            <ArrowLeft className="size-4" /> Ke login
          </Link>
          <h1 className="text-[1.35rem] font-bold">Sandi baru</h1>
          <p className="mt-2 text-[13px] text-violet-100/95">Tautan satu kali — pilih sandi yang kuat.</p>
        </div>

        <form className="space-y-6 px-8 py-8" onSubmit={onSubmit}>
          {error ? (
            <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-[13px] font-medium text-rose-900 dark:border-rose-500/35 dark:bg-rose-950 dark:text-rose-100">
              {error}
            </div>
          ) : null}

          <label className="block space-y-2">
            <span className="text-[12px] font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
              Sandi baru
            </span>
            <div className="relative">
              <Lock className="pointer-events-none absolute left-3 top-1/2 size-[18px] -translate-y-1/2 text-slate-400" />
              <input
                type={showPw ? "text" : "password"}
                required
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-xl border border-slate-200/95 bg-white/85 py-3 pl-11 pr-12 text-[15px] outline-none focus:border-indigo-400 focus:ring-4 focus:ring-indigo-500/18 dark:border-slate-600 dark:bg-slate-900 dark:text-white"
              />
              <button
                type="button"
                className="absolute right-3 top-1/2 flex size-8 -translate-y-1/2 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-white/10"
                onClick={() => setShowPw(!showPw)}
              >
                {showPw ? <EyeOff className="size-[18px]" /> : <Eye className="size-[18px]" />}
              </button>
            </div>
          </label>

          <label className="block space-y-2">
            <span className="text-[12px] font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
              Konfirmasi
            </span>
            <input
              type={showPw ? "text" : "password"}
              required
              minLength={8}
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              className="w-full rounded-xl border border-slate-200/95 bg-white/85 px-3 py-3 text-[15px] outline-none focus:border-indigo-400 focus:ring-4 focus:ring-indigo-500/18 dark:border-slate-600 dark:bg-slate-900 dark:text-white"
            />
          </label>

          <div className="pt-2">
            <button
              type="submit"
              disabled={busy}
              className="w-full rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 py-[0.9rem] text-[15px] font-semibold text-white shadow-lg shadow-violet-800/35 disabled:opacity-55"
            >
              {busy ? "Menyimpan…" : "Simpan sandi baru"}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}
