"use client";

import { motion } from "framer-motion";
import {
  ArrowLeft,
  Building2,
  Eye,
  EyeOff,
  Hash,
  Lock,
  Mail,
  Search,
  User,
} from "lucide-react";
import Link from "next/link";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import {
  lookupNpsnAction,
  registerAdminSchoolAction,
  searchSchoolAction,
} from "@/server/actions/admin-registration";
import type { NpsnSekolahPreview } from "@/server/npsn/types";

type Step = "npsn" | "form" | "done";

function SchoolPreviewDetails({
  preview,
  wilayahText,
}: {
  preview: NpsnSekolahPreview;
  wilayahText: string;
}) {
  const rows: { label: string; value: React.ReactNode }[] = [
    {
      label: "NPSN",
      value: (
        <span className="font-mono font-bold text-slate-900 dark:text-white">{preview.npsn}</span>
      ),
    },
    {
      label: "Nama Sekolah",
      value: (
        <span className="font-bold leading-tight text-slate-900 dark:text-white">{preview.nama}</span>
      ),
    },
    {
      label: "Tingkat",
      value: (
        <span className="font-medium text-slate-900 dark:text-white">
          {preview.bentukPendidikan || "\u2014"}
        </span>
      ),
    },
  ];

  if (wilayahText !== "\u2014") {
    rows.push({
      label: "Wilayah",
      value: <span className="font-medium text-slate-900 dark:text-white">{wilayahText}</span>,
    });
  }

  rows.push({
    label: "Sumber data",
    value: <span className="font-medium text-slate-900 dark:text-white">{preview.sumberData}</span>,
  });

  return (
    <dl className="grid grid-cols-[auto_1.125rem_minmax(0,1fr)] items-start gap-x-2 gap-y-2.5 text-[13px] leading-snug">
      {rows.map((row) => (
        <div key={row.label} className="contents">
          <dt className="text-left font-semibold tracking-tight text-slate-600 dark:text-slate-300">
            {row.label}
          </dt>
          <span
            aria-hidden
            className="shrink-0 text-center font-medium text-slate-400 dark:text-slate-500"
          >
            :
          </span>
          <dd className="m-0 min-w-0 text-slate-800 dark:text-slate-100">{row.value}</dd>
        </div>
      ))}
    </dl>
  );
}

export function RegisterForm({ callbackUrl }: { callbackUrl: string }) {
  const router = useRouter();
  const [step, setStep] = useState<Step>("npsn");
  const [searchInput, setSearchInput] = useState("");
  const [searchResults, setSearchResults] = useState<NpsnSekolahPreview[]>([]);
  const [searchTotal, setSearchTotal] = useState(0);
  const [preview, setPreview] = useState<NpsnSekolahPreview | null>(null);
  const [adminName, setAdminName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSearchSchool(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSearchResults([]);
    setSearchTotal(0);
    setBusy(true);
    const r = await searchSchoolAction(searchInput);
    setBusy(false);
    if (!r.ok) {
      setError(r.message);
      return;
    }
    setSearchResults(r.results);
    setSearchTotal(r.total);
  }

  async function onPickSchool(hit: NpsnSekolahPreview) {
    setError(null);
    setBusy(true);
    const r = await lookupNpsnAction(hit.npsn);
    setBusy(false);
    if (!r.ok) {
      setError(r.message);
      return;
    }
    setPreview(r.preview);
    setSearchResults([]);
    setStep("form");
  }

  function formatWilayah(hit: NpsnSekolahPreview): string {
    const parts = [
      hit.namaDesaDagri,
      hit.namaKecamatanDagri,
      hit.namaKabupatenDagri,
      hit.namaProvinsiDagri,
    ].filter(Boolean);
    return parts.length ? parts.join(" · ") : "—";
  }

  async function onRegister(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password !== confirm) {
      setError("Konfirmasi sandi tidak cocok.");
      return;
    }
    if (!preview) {
      setError("Pilih sekolah terlebih dahulu.");
      return;
    }
    setBusy(true);
    const r = await registerAdminSchoolAction({
      npsn: preview.npsn,
      adminName,
      email,
      password,
    });
    if (!r.ok) {
      setBusy(false);
      setError(r.message);
      return;
    }

    const sign = await signIn("credentials", {
      email: email.trim().toLowerCase(),
      password,
      redirect: false,
      callbackUrl,
    });
    setBusy(false);

    if (sign?.error) {
      setStep("done");
      return;
    }
    if (sign?.url) {
      router.push(sign.url);
      router.refresh();
      return;
    }
    router.push(callbackUrl);
    router.refresh();
  }

  return (
    <div className="relative isolate min-h-[100dvh] w-full overflow-hidden px-4 py-10 sm:px-8 sm:py-12">
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
        className="mx-auto w-full max-w-lg overflow-hidden rounded-[1.35rem] border border-white/60 bg-[rgb(255_255_255/0.52)] shadow-[0_28px_70px_-40px_rgb(15_23_42/0.5)] backdrop-blur-2xl dark:border-slate-700/50 dark:bg-[rgb(15_23_42/0.95)]"
      >
        <div className="border-b border-white/10 bg-gradient-to-r from-indigo-700 via-violet-700 to-teal-700 px-6 py-5 text-white sm:px-8 sm:py-6">
          <Link
            href="/login"
            className="mb-4 inline-flex items-center gap-1.5 text-[13px] font-semibold text-white/90 hover:text-white"
          >
            <ArrowLeft className="size-4" /> Kembali ke login
          </Link>
          <h1 className="text-xl font-bold tracking-tight sm:text-[1.35rem]">
            Registrasi Admin Sekolah
          </h1>
          <p className="mt-2 max-w-md text-[13px] leading-relaxed text-indigo-100/95">
            Cari sekolah dengan NPSN atau nama sekolah dari data resmi Kemendikdasmen, lalu lengkapi
            data Anda.
          </p>
        </div>

        <div className="space-y-6 px-6 py-7 sm:px-8 sm:py-8">
          {/* step indicator */}
          <div className="flex justify-center gap-2 text-[11px] font-bold uppercase tracking-wider text-slate-400">
            {(["Cari sekolah", "Data"] as const).map((label, i) => {
              const active =
                (step === "npsn" && i === 0) ||
                (step === "form" && i <= 1) ||
                step === "done";
              return (
                <span
                  key={label}
                  className={`rounded-full px-2.5 py-1 ${active ? "bg-indigo-100 text-indigo-900 dark:bg-indigo-500/30 dark:text-indigo-100" : ""}`}
                >
                  {label}
                </span>
              );
            })}
          </div>

          {error ? (
            <div
              role="alert"
              className="whitespace-pre-line rounded-xl border border-rose-200 bg-rose-50 px-3 py-2.5 text-[13px] font-medium text-rose-900 dark:border-rose-500/35 dark:bg-rose-950 dark:text-rose-100"
            >
              {error}
            </div>
          ) : null}

          {step === "npsn" ? (
            <div className="space-y-4">
            <form className="space-y-4" onSubmit={onSearchSchool}>
              <label className="space-y-1.5">
                <span className="text-[12px] font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  NPSN atau nama sekolah
                </span>
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 size-[18px] -translate-y-1/2 text-slate-400" />
                  <input
                    autoComplete="off"
                    maxLength={120}
                    value={searchInput}
                    onChange={(e) => setSearchInput(e.target.value)}
                    placeholder="Contoh: 12345678 atau SMA Negeri 1 Indonesia"
                    required
                    minLength={2}
                    className="w-full rounded-xl border border-slate-200/95 bg-white/90 py-3 pl-11 pr-3 text-[15px] outline-none focus:border-indigo-400 focus:ring-4 focus:ring-indigo-500/18 dark:border-slate-600 dark:bg-slate-900 dark:text-white"
                  />
                </div>
              </label>
              <p className="text-[12px] leading-relaxed text-slate-500 dark:text-slate-400">
                Sumber utama:{" "}
                <span className="font-semibold text-slate-600 dark:text-slate-300">
                  api.data.belajar.id
                </span>
                . Ketik NPSN 8 digit atau nama sekolah, lalu pilih baris yang sesuai dari hasil pencarian.
              </p>
              <button
                type="submit"
                disabled={busy || searchInput.trim().length < 2}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 py-3 text-[15px] font-semibold text-white shadow-lg shadow-indigo-800/30 disabled:opacity-50"
              >
                <Search className="size-4" />
                {busy ? "Mencari\u2026" : "Cari di data Kemendikdasmen"}
              </button>
            </form>

              {searchResults.length > 0 ? (
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="space-y-2"
                >
                  <p className="text-[12px] font-semibold text-slate-600 dark:text-slate-300">
                    {searchTotal > searchResults.length
                      ? `Menampilkan ${searchResults.length} dari ${searchTotal} hasil — pilih sekolah Anda:`
                      : `${searchResults.length} sekolah ditemukan — pilih yang sesuai:`}
                  </p>
                  <ul className="max-h-[min(320px,50vh)] space-y-2 overflow-y-auto pr-0.5">
                    {searchResults.map((hit) => (
                      <li key={hit.npsn}>
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => onPickSchool(hit)}
                          className="group w-full rounded-xl border border-slate-200/90 bg-white p-3.5 text-left transition hover:border-indigo-300 hover:bg-indigo-50/50 disabled:opacity-50 dark:border-slate-600 dark:bg-slate-900/80 dark:hover:border-indigo-500/40 dark:hover:bg-indigo-950/40"
                        >
                          <div className="flex items-start gap-3">
                            <Building2 className="mt-0.5 size-5 shrink-0 text-indigo-600 dark:text-indigo-300" />
                            <div className="min-w-0 flex-1">
                              <p className="text-[14px] font-bold leading-snug text-slate-900 dark:text-white">
                                {hit.nama}
                              </p>
                              <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[12px] text-slate-600 dark:text-slate-400">
                                <span className="inline-flex items-center gap-1 font-mono font-semibold text-slate-800 dark:text-slate-200">
                                  <Hash className="size-3.5 opacity-70" aria-hidden />
                                  {hit.npsn}
                                </span>
                                {hit.bentukPendidikan ? (
                                  <span className="rounded-md bg-slate-100 px-1.5 py-0.5 font-semibold text-slate-700 dark:bg-slate-800 dark:text-slate-200">
                                    {hit.bentukPendidikan}
                                  </span>
                                ) : null}
                              </p>
                              <p className="mt-1.5 text-[11px] leading-relaxed text-slate-500 dark:text-slate-400">
                                {formatWilayah(hit)}
                              </p>
                            </div>
                          </div>
                        </button>
                      </li>
                    ))}
                  </ul>
                </motion.div>
              ) : null}
            </div>
          ) : null}

          {step === "form" && preview ? (
            <form className="space-y-6" onSubmit={onRegister}>
              <div className="rounded-xl border border-indigo-200/80 bg-indigo-50/80 p-4 dark:border-indigo-500/25 dark:bg-indigo-950/85">
                <div className="flex items-start gap-3">
                  <Building2 className="mt-0.5 size-5 shrink-0 text-indigo-600 dark:text-indigo-300" />
                  <div className="min-w-0 flex-1 text-[13px] leading-snug text-slate-800 dark:text-slate-100">
                    <SchoolPreviewDetails
                      preview={preview}
                      wilayahText={formatWilayah(preview)}
                    />
                  </div>
                </div>
                <button
                  type="button"
                  className="mt-3 text-[12px] font-semibold text-indigo-700 underline dark:text-indigo-300"
                  onClick={() => {
                    setStep("npsn");
                    setPreview(null);
                    setSearchResults([]);
                    setSearchTotal(0);
                    setError(null);
                  }}
                >
                  Ganti pencarian
                </button>
              </div>

              <label className="space-y-2">
                <span className="text-[12px] font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  Nama lengkap kepala sekolah
                </span>
                <div className="relative">
                  <User className="pointer-events-none absolute left-3 top-1/2 size-[18px] -translate-y-1/2 text-slate-400" />
                  <input
                    required
                    value={adminName}
                    onChange={(e) => setAdminName(e.target.value)}
                    placeholder="Contoh: SYAMSUL BAHRI, S.Pd"
                    className="w-full rounded-xl border border-slate-200/95 bg-white/90 py-3 pl-11 pr-3 text-[15px] outline-none placeholder:text-slate-400 focus:border-indigo-400 focus:ring-4 focus:ring-indigo-500/18 dark:border-slate-600 dark:bg-slate-900 dark:text-white dark:placeholder:text-slate-500"
                  />
                </div>
              </label>

              <label className="space-y-2">
                <span className="text-[12px] font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  Email Aktif
                </span>
                <div className="relative">
                  <Mail className="pointer-events-none absolute left-3 top-1/2 size-[18px] -translate-y-1/2 text-slate-400" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="contoh@email.com"
                    className="w-full rounded-xl border border-slate-200/95 bg-white/90 py-3 pl-11 pr-3 text-[15px] outline-none placeholder:text-slate-400 focus:border-indigo-400 focus:ring-4 focus:ring-indigo-500/18 dark:border-slate-600 dark:bg-slate-900 dark:text-white dark:placeholder:text-slate-500"
                  />
                </div>
              </label>

              <label className="space-y-2">
                <span className="text-[12px] font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  Sandi
                </span>
                <div className="relative">
                  <Lock className="pointer-events-none absolute left-3 top-1/2 size-[18px] -translate-y-1/2 text-slate-400" />
                  <input
                    type={showPw ? "text" : "password"}
                    required
                    minLength={8}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Minimal 8 karakter"
                    className="w-full rounded-xl border border-slate-200/95 bg-white/90 py-3 pl-11 pr-12 text-[15px] outline-none placeholder:text-slate-400 focus:border-indigo-400 focus:ring-4 focus:ring-indigo-500/18 dark:border-slate-600 dark:bg-slate-900 dark:text-white dark:placeholder:text-slate-500"
                  />
                  <button
                    type="button"
                    className="absolute right-3 top-1/2 flex size-8 -translate-y-1/2 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-white/10"
                    onClick={() => setShowPw(!showPw)}
                    aria-label="Tampilkan sandi"
                  >
                    {showPw ? <EyeOff className="size-[18px]" /> : <Eye className="size-[18px]" />}
                  </button>
                </div>
              </label>

              <label className="space-y-2">
                <span className="text-[12px] font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  Konfirmasi sandi
                </span>
                <div className="relative">
                  <Lock className="pointer-events-none absolute left-3 top-1/2 size-[18px] -translate-y-1/2 text-slate-400" />
                  <input
                    type={showPw ? "text" : "password"}
                    required
                    minLength={8}
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                    placeholder="Ulangi sandi di atas"
                    className="w-full rounded-xl border border-slate-200/95 bg-white/90 py-3 pl-11 pr-3 text-[15px] outline-none placeholder:text-slate-400 focus:border-indigo-400 focus:ring-4 focus:ring-indigo-500/18 dark:border-slate-600 dark:bg-slate-900 dark:text-white dark:placeholder:text-slate-500"
                  />
                </div>
              </label>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={busy}
                  className="w-full rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 py-3 text-[15px] font-semibold text-white shadow-lg shadow-teal-900/25 disabled:opacity-55"
                >
                  {busy ? "Mendaftarkan\u2026" : "Daftar & Aktifkan Akun"}
                </button>
              </div>
            </form>
          ) : null}

          {step === "done" ? (
            <div className="space-y-4 text-center">
              <p className="text-[15px] font-semibold text-emerald-800 dark:text-emerald-200">
                Akun berhasil dibuat.
              </p>
              <p className="text-[13px] text-slate-600 dark:text-slate-400">
                Silakan login dengan email dan sandi yang sudah didaftarkan.
              </p>
              <Link
                href="/login"
                className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-2.5 text-[14px] font-semibold text-white shadow-lg hover:bg-indigo-700"
              >
                Ke halaman Login
              </Link>
            </div>
          ) : null}

          <p className="text-center text-[12px] text-slate-500">
            Sudah punya akun?{" "}
            <Link href="/login" className="font-semibold text-indigo-600 dark:text-indigo-300">
              Login
            </Link>
          </p>
        </div>
      </motion.div>
    </div>
  );
}
