"use client";

import { motion } from "framer-motion";
import { ArrowLeft, Mail } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { requestPasswordResetAction } from "@/server/actions/credentials-auth";

export function ForgotPasswordForm() {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    const r = await requestPasswordResetAction(email.trim());
    setBusy(false);
    if (!r.ok) setError(r.message);
    else setDone(true);
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
        <div className="border-b border-slate-200/80 bg-gradient-to-r from-slate-800 via-indigo-800 to-teal-800 px-8 py-6 text-white">
          <Link
            href="/login"
            className="mb-5 inline-flex items-center gap-1.5 text-[13px] font-semibold text-white/90 hover:text-white"
          >
            <ArrowLeft className="size-4" /> Kembali ke login
          </Link>
          <h1 className="text-[1.35rem] font-bold tracking-tight">Lupa sandi</h1>
          <p className="mt-2 text-[13px] leading-relaxed text-teal-100/90">
            Kami mengirim tautan pemulihan bila akun memakai sandi email. Guru yang masih memakai{" "}
            <strong className="text-white">PIN dari admin</strong> tidak bisa reset lewat sini — masuk
            dulu dengan PIN, lalu ubah sandi di menu Ubah Password. Hubungi Administrator Sekolah untuk
            PIN. Akun hanya-Google meminta bantuan admin.
          </p>
        </div>

        <div className="px-8 py-8">
          {done ? (
            <div className="rounded-xl border border-emerald-200/90 bg-emerald-50 px-4 py-4 text-[13px] font-medium leading-relaxed text-emerald-950 dark:border-emerald-500/35 dark:bg-emerald-950 dark:text-emerald-50">
              Jika kombinasi email dan akun bermuatan sandi terdaftar, periksa kotak masuk Anda (dan folder spam).
              Tidak ada email? Hubungi admin untuk reset manual.
            </div>
          ) : (
            <form className="space-y-6" onSubmit={onSubmit}>
              {error ? (
                <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-[13px] text-rose-900 dark:border-rose-500/35 dark:bg-rose-950 dark:text-rose-100">
                  {error}
                </div>
              ) : null}
              <label className="space-y-2">
                <span className="text-[12px] font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  Email akun Anda
                </span>
                <div className="relative">
                  <Mail className="pointer-events-none absolute left-3 top-1/2 size-[18px] -translate-y-1/2 text-slate-400" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="contoh@email.com"
                    className="w-full rounded-xl border border-slate-200/95 bg-white/85 py-3 pl-11 pr-3 text-[15px] outline-none placeholder:text-slate-400 focus:border-indigo-400 focus:ring-4 focus:ring-indigo-500/18 dark:border-slate-600 dark:bg-slate-900 dark:text-white dark:placeholder:text-slate-500"
                  />
                </div>
              </label>
              <div className="pt-1">
                <button
                  type="submit"
                  disabled={busy}
                  className="w-full rounded-xl bg-slate-900 py-3.5 text-[15px] font-semibold text-white shadow-lg shadow-slate-900/35 transition hover:brightness-105 disabled:opacity-55 dark:bg-indigo-600"
                >
                  {busy ? "Memproses…" : "Kirim tautan reset"}
                </button>
              </div>
            </form>
          )}
        </div>
      </motion.div>
    </div>
  );
}
