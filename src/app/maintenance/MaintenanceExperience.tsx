"use client";

import { motion } from "framer-motion";
import { Cog, Sparkles, Wrench } from "lucide-react";

export function MaintenanceExperience({ endsAtLabelWib }: { endsAtLabelWib: string }) {
  return (
    <motion.div className="relative isolate flex min-h-[100dvh] flex-col items-center justify-center overflow-hidden px-4 py-16">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_50%_-10%,rgb(99_102_241/0.35),transparent),radial-gradient(ellipse_60%_50%_at_100%_80%,rgb(20_184_166/0.22),transparent),linear-gradient(165deg,#0f172a_0%,#1e1b4b_45%,#0c4a6e_100%)]"
      />

      {[0, 1, 2, 3, 4].map((i) => (
        <motion.span
          key={i}
          aria-hidden
          className="absolute size-2 rounded-full bg-indigo-300/40"
          style={{
            left: `${12 + i * 18}%`,
            top: `${20 + (i % 3) * 22}%`,
          }}
          animate={{
            y: [0, -28, 0],
            opacity: [0.25, 0.85, 0.25],
            scale: [1, 1.35, 1],
          }}
          transition={{
            duration: 4 + i * 0.6,
            repeat: Infinity,
            ease: "easeInOut",
            delay: i * 0.4,
          }}
        />
      ))}

      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.55, ease: "easeOut" }}
        className="relative z-10 w-full max-w-lg text-center"
      >
        <div className="relative mx-auto mb-8 flex size-28 items-center justify-center">
          <motion.div
            className="absolute inset-0 rounded-full bg-indigo-500/20 blur-2xl"
            animate={{ scale: [1, 1.15, 1], opacity: [0.5, 0.85, 0.5] }}
            transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
          />
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 14, repeat: Infinity, ease: "linear" }}
            className="absolute inset-2 rounded-full border border-dashed border-indigo-400/50"
          />
          <motion.div
            animate={{ rotate: -360 }}
            transition={{ duration: 9, repeat: Infinity, ease: "linear" }}
            className="flex size-20 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 shadow-lg shadow-indigo-900/50"
          >
            <Cog className="size-10 text-white" aria-hidden />
          </motion.div>
          <motion.div
            className="absolute -right-1 -top-1 flex size-9 items-center justify-center rounded-xl bg-teal-500 shadow-md"
            animate={{ y: [0, -6, 0] }}
            transition={{ duration: 2.2, repeat: Infinity, ease: "easeInOut" }}
          >
            <Wrench className="size-4 text-white" aria-hidden />
          </motion.div>
        </div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.15 }}
          className="mb-3 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-4 py-1.5 text-[11px] font-bold uppercase tracking-[0.2em] text-indigo-100"
        >
          <Sparkles className="size-3.5 text-amber-300" aria-hidden />
          Pembaruan sistem
        </motion.div>

        <h1 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">
          Aplikasi sedang dalam pembaruan
        </h1>
        <p className="mx-auto mt-4 max-w-md text-pretty text-[15px] leading-relaxed text-indigo-100/90">
          Kami sedang meningkatkan Sistem Nilai Ijazah agar lebih stabil dan nyaman
          digunakan. Silakan kembali lagi nanti — terima kasih atas kesabaran Anda.
        </p>

        <motion.div
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.25, duration: 0.4 }}
          className="mt-8 rounded-2xl border border-white/15 bg-white/10 px-5 py-4 backdrop-blur-md"
        >
          <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-teal-200/95">
            Perkiraan selesai
          </p>
          <p className="mt-2 text-lg font-semibold text-white">{endsAtLabelWib} WIB</p>
        </motion.div>

        <motion.p
          className="mt-8 text-xs text-indigo-200/70"
          animate={{ opacity: [0.5, 1, 0.5] }}
          transition={{ duration: 2.5, repeat: Infinity }}
        >
          Halaman login sementara tidak tersedia selama maintenance berlangsung.
        </motion.p>
      </motion.div>
    </motion.div>
  );
}
