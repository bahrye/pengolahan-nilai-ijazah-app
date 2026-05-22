"use client";

import { motion } from "framer-motion";
import { Headphones, Mail, MessageCircle, ShieldCheck, Sparkles } from "lucide-react";
import Link from "next/link";

import {
  SUPERADMIN_SUPPORT_EMAIL,
  SUPERADMIN_SUPPORT_WHATSAPP_LABEL,
  SUPERADMIN_SUPPORT_WHATSAPP_URL,
} from "@/lib/superadmin-support";

const fadeUp = {
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0 },
};

function FloatingIcon({
  children,
  className,
  delay = 0,
}: {
  children: React.ReactNode;
  className: string;
  delay?: number;
}) {
  return (
    <motion.span
      className={`inline-flex items-center justify-center rounded-2xl shadow-lg ${className}`}
      animate={{ y: [0, -6, 0] }}
      transition={{ duration: 3.2, repeat: Infinity, ease: "easeInOut", delay }}
    >
      {children}
    </motion.span>
  );
}

export function BantuanSuperadminClient() {
  return (
    <div className="mx-auto max-w-3xl space-y-8 pb-10">
      <motion.header
        {...fadeUp}
        transition={{ duration: 0.45 }}
        className="relative overflow-hidden rounded-2xl border border-indigo-200/80 bg-gradient-to-br from-indigo-50 via-white to-violet-50 px-6 py-8 shadow-sm dark:border-indigo-500/25 dark:from-indigo-950/50 dark:via-slate-900 dark:to-violet-950/40"
      >
        <motion.div
          aria-hidden
          className="pointer-events-none absolute -right-8 -top-8 size-40 rounded-full bg-indigo-400/15 blur-2xl"
          animate={{ scale: [1, 1.12, 1], opacity: [0.5, 0.75, 0.5] }}
          transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
        />
        <motion.div
          aria-hidden
          className="pointer-events-none absolute -bottom-10 -left-6 size-32 rounded-full bg-violet-400/15 blur-2xl"
          animate={{ scale: [1, 1.08, 1], opacity: [0.4, 0.65, 0.4] }}
          transition={{ duration: 4.5, repeat: Infinity, ease: "easeInOut", delay: 0.6 }}
        />

        <motion.div className="relative flex flex-col items-center gap-5 text-center sm:flex-row sm:text-left">
          <FloatingIcon
            className="size-16 bg-gradient-to-br from-indigo-600 to-violet-600 text-white ring-4 ring-white/80 dark:ring-slate-800/80"
            delay={0}
          >
            <Headphones className="size-8" aria-hidden />
          </FloatingIcon>
          <div className="min-w-0 flex-1">
            <p className="inline-flex items-center gap-1.5 rounded-full bg-indigo-100 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.16em] text-indigo-800 dark:bg-indigo-500/20 dark:text-indigo-200">
              <Sparkles className="size-3.5" aria-hidden />
              Dukungan resmi
            </p>
            <h1 className="ui-page-title mt-3">Bantuan Superadmin</h1>
            <p className="ui-muted mt-2 max-w-xl text-pretty text-sm leading-relaxed">
              Tim pengelola sistem siap membantu pertanyaan teknis, kendala login, langganan, dan
              konfigurasi data madrasah Anda. Sampaikan NPSN / nama sekolah agar penanganan lebih
              cepat.
            </p>
          </div>
        </motion.div>
      </motion.header>

      <motion.div
        {...fadeUp}
        transition={{ duration: 0.45, delay: 0.08 }}
        className="flex items-start gap-3 rounded-xl border border-emerald-200/80 bg-emerald-50/80 px-4 py-3 text-[13px] leading-relaxed text-emerald-950 dark:border-emerald-800/50 dark:bg-emerald-950/30 dark:text-emerald-100"
      >
        <ShieldCheck className="mt-0.5 size-5 shrink-0 text-emerald-600 dark:text-emerald-400" aria-hidden />
        <span>
          Gunakan saluran resmi di bawah ini saja. Jangan bagikan sandi login kepada siapa pun —
          superadmin tidak akan pernah meminta sandi Anda.
        </span>
      </motion.div>

      <div className="grid gap-4 sm:grid-cols-2">
        <motion.article
          {...fadeUp}
          transition={{ duration: 0.45, delay: 0.12 }}
          className="group relative overflow-hidden rounded-2xl border border-slate-200/90 bg-white p-6 shadow-sm transition hover:border-indigo-300 hover:shadow-md dark:border-slate-700 dark:bg-slate-900/70 dark:hover:border-indigo-500/40"
        >
          <FloatingIcon
            className="mb-4 size-12 bg-sky-100 text-sky-700 dark:bg-sky-950/60 dark:text-sky-300"
            delay={0.2}
          >
            <Mail className="size-6" aria-hidden />
          </FloatingIcon>
          <h2 className="text-base font-bold text-slate-900 dark:text-white">Email dukungan</h2>
          <p className="mt-2 text-[13px] leading-relaxed text-slate-600 dark:text-slate-400">
            Cocok untuk lampiran bukti, pertanyaan detail, atau permintaan yang perlu jejak tertulis.
          </p>
          <a
            href={`mailto:${SUPERADMIN_SUPPORT_EMAIL}?subject=${encodeURIComponent("Bantuan Sistem Nilai Ijazah")}`}
            className="mt-4 inline-flex break-all text-[14px] font-semibold text-indigo-700 underline-offset-2 hover:underline dark:text-indigo-300"
          >
            {SUPERADMIN_SUPPORT_EMAIL}
          </a>
        </motion.article>

        <motion.article
          {...fadeUp}
          transition={{ duration: 0.45, delay: 0.18 }}
          className="group relative overflow-hidden rounded-2xl border border-slate-200/90 bg-white p-6 shadow-sm transition hover:border-emerald-300 hover:shadow-md dark:border-slate-700 dark:bg-slate-900/70 dark:hover:border-emerald-500/40"
        >
          <FloatingIcon
            className="mb-4 size-12 bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300"
            delay={0.35}
          >
            <MessageCircle className="size-6" aria-hidden />
          </FloatingIcon>
          <h2 className="text-base font-bold text-slate-900 dark:text-white">WhatsApp</h2>
          <p className="mt-2 text-[13px] leading-relaxed text-slate-600 dark:text-slate-400">
            Respon lebih cepat pada jam kerja. Kirim pesan singkat beserta nama madrasah Anda.
          </p>
          <a
            href={SUPERADMIN_SUPPORT_WHATSAPP_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="ui-btn ui-btn-primary mt-4 inline-flex w-full justify-center gap-2 sm:w-auto"
          >
            <MessageCircle className="size-4" aria-hidden />
            Buka {SUPERADMIN_SUPPORT_WHATSAPP_LABEL}
          </a>
        </motion.article>
      </div>

      <motion.div
        {...fadeUp}
        transition={{ duration: 0.45, delay: 0.24 }}
        className="rounded-2xl border border-dashed border-slate-300/90 bg-slate-50/80 px-5 py-4 text-[13px] leading-relaxed text-slate-600 dark:border-slate-600 dark:bg-slate-900/40 dark:text-slate-400"
      >
        <p className="font-semibold text-slate-800 dark:text-slate-200">Tips sebelum menghubungi</p>
        <ul className="mt-2 list-inside list-disc space-y-1">
          <li>Sertakan NPSN, nama madrasah, dan ringkasan kendala.</li>
          <li>Untuk masalah login, sebutkan email admin yang dipakai.</li>
          <li>Akun yang dinonaktifkan superadmin hanya dapat diaktifkan kembali oleh superadmin.</li>
        </ul>
        <p className="mt-3">
          Kembali ke{" "}
          <Link href="/dashboard/sekolah" className="font-semibold text-indigo-700 dark:text-indigo-300">
            Data Sekolah
          </Link>
          .
        </p>
      </motion.div>
    </div>
  );
}
