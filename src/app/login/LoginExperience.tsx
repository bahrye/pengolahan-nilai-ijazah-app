"use client";

import { motion } from "framer-motion";
import {
  ArrowLeft,
  ArrowRight,
  Building2,
  Eye,
  EyeOff,
  Lock,
  Mail,
  ShieldCheck,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import { useMemo, useState } from "react";

import {
  ADMIN_ACCOUNT_DEACTIVATED_MESSAGE,
  CREDENTIALS_ERROR_ACCOUNT_DEACTIVATED,
} from "@/lib/admin-account-status";
import {
  CREDENTIALS_ERROR_SCHOOL_DEACTIVATED,
  SCHOOL_DEACTIVATED_MESSAGE,
} from "@/lib/school-active";
import { SUPERADMIN_SUPPORT_WHATSAPP_URL } from "@/lib/superadmin-support";
import { SCHOOL_LOGIN_SUBSCRIPTION_BLOCKED_MESSAGE } from "@/lib/subscription/constants";

function GoogleLogo({ className }: { className?: string }) {
  return (
    <svg className={className ?? "size-5"} viewBox="0 0 24 24" aria-hidden>
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
      />
    </svg>
  );
}

type GuruLoginContextRow = {
  schoolId: string;
  namaSekolah: string | null;
  isSatminkal: boolean;
  isHome: boolean;
};

type GuruContextsPreview = {
  ok: true;
  needSchoolPicker: boolean;
  role?: string;
  schools?: GuruLoginContextRow[];
};

export function LoginExperience({
  callbackUrl,
  signedOut,
  passwordResetDone,
  googleNotRegistered,
  googleSubscriptionRequired,
  googleAccountNotLinked,
  accountDeactivated,
  schoolDeactivated,
}: {
  callbackUrl: string;
  signedOut?: boolean;
  passwordResetDone?: boolean;
  googleNotRegistered?: boolean;
  googleSubscriptionRequired?: boolean;
  googleAccountNotLinked?: boolean;
  accountDeactivated?: boolean;
  schoolDeactivated?: boolean;
}) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState<"credentials" | "pick-school">("credentials");
  const [schoolContexts, setSchoolContexts] = useState<GuruLoginContextRow[]>([]);
  const [selectedContextSchoolId, setSelectedContextSchoolId] = useState<string | null>(
    null,
  );

  const sortedSchoolContexts = useMemo(() => {
    return [...schoolContexts].sort((a, b) => {
      if (a.isHome !== b.isHome) return a.isHome ? -1 : 1;
      return (a.namaSekolah ?? "").localeCompare(b.namaSekolah ?? "", "id");
    });
  }, [schoolContexts]);

  async function finishCredentialSignIn(contextSchoolId?: string) {
    const res = await signIn("credentials", {
      email: email.trim(),
      password,
      ...(contextSchoolId ? { contextSchoolId } : {}),
      redirect: false,
      callbackUrl,
    });
    if (res?.error) {
      const code = (res as { code?: string }).code;
      if (code === CREDENTIALS_ERROR_ACCOUNT_DEACTIVATED) {
        setError(ADMIN_ACCOUNT_DEACTIVATED_MESSAGE);
        return false;
      }
      if (code === CREDENTIALS_ERROR_SCHOOL_DEACTIVATED) {
        setError(SCHOOL_DEACTIVATED_MESSAGE);
        return false;
      }
      if (contextSchoolId) {
        const recheck = await fetch("/api/auth/guru-login-contexts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: email.trim(),
            password,
            contextSchoolId,
          }),
        });
        const recheckBody = (await recheck.json()) as { ok?: boolean; message?: string };
        if (!recheckBody.ok && recheck.status === 403 && recheckBody.message) {
          setError(recheckBody.message);
          return false;
        }
      }
      setError(
        "Email atau sandi salah, atau akun ini belum aktif. Jika Anda guru, pastikan sekolah sudah berlangganan aktif.",
      );
      return false;
    }
    if (res?.url) {
      router.push(res.url);
      router.refresh();
      return true;
    }
    router.push(callbackUrl);
    router.refresh();
    return true;
  }

  async function onCredentialSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const previewRes = await fetch("/api/auth/guru-login-contexts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), password }),
      });
      const preview = (await previewRes.json()) as
        | GuruContextsPreview
        | { ok: false; message?: string; code?: string };

      if (!preview.ok) {
        setBusy(false);
        if (preview.code === CREDENTIALS_ERROR_ACCOUNT_DEACTIVATED) {
          setError(
            typeof preview.message === "string"
              ? preview.message
              : ADMIN_ACCOUNT_DEACTIVATED_MESSAGE,
          );
          return;
        }
        if (preview.code === CREDENTIALS_ERROR_SCHOOL_DEACTIVATED) {
          setError(
            typeof preview.message === "string"
              ? preview.message
              : SCHOOL_DEACTIVATED_MESSAGE,
          );
          return;
        }
        if (previewRes.status === 429) {
          setError(
            typeof preview.message === "string"
              ? preview.message
              : "Terlalu banyak percobaan. Tunggu sebentar lalu coba lagi.",
          );
          return;
        }
        setError(
          typeof preview.message === "string"
            ? preview.message
            : "Email atau sandi salah, atau akun ini belum aktif.",
        );
        return;
      }

      if (preview.needSchoolPicker && preview.schools && preview.schools.length > 1) {
        const sorted = [...preview.schools].sort((a, b) => {
          if (a.isHome !== b.isHome) return a.isHome ? -1 : 1;
          return (a.namaSekolah ?? "").localeCompare(b.namaSekolah ?? "", "id");
        });
        setSchoolContexts(preview.schools);
        setSelectedContextSchoolId(
          sorted.find((s) => s.isHome)?.schoolId ?? sorted[0]?.schoolId ?? null,
        );
        setStep("pick-school");
        setBusy(false);
        return;
      }

      const singleContextId =
        preview.schools?.length === 1 ? preview.schools[0]?.schoolId : undefined;

      const ok = await finishCredentialSignIn(singleContextId);
      setBusy(false);
      if (!ok) return;
    } catch {
      setBusy(false);
      setError("Terjadi kesalahan saat masuk. Coba lagi.");
    }
  }

  async function onPickSchoolSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedContextSchoolId) {
      setError("Pilih sekolah tujuan masuk terlebih dahulu.");
      return;
    }
    setError(null);
    setBusy(true);
    try {
      const recheck = await fetch("/api/auth/guru-login-contexts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim(),
          password,
          contextSchoolId: selectedContextSchoolId,
        }),
      });
      const recheckBody = (await recheck.json()) as { ok?: boolean; message?: string };
      if (!recheckBody.ok) {
        setBusy(false);
        setError(
          typeof recheckBody.message === "string"
            ? recheckBody.message
            : SCHOOL_LOGIN_SUBSCRIPTION_BLOCKED_MESSAGE,
        );
        return;
      }
      const ok = await finishCredentialSignIn(selectedContextSchoolId);
      setBusy(false);
      if (!ok) return;
    } catch {
      setBusy(false);
      setError("Terjadi kesalahan saat masuk. Coba lagi.");
    }
  }

  function backToCredentials() {
    setStep("credentials");
    setSchoolContexts([]);
    setSelectedContextSchoolId(null);
    setError(null);
  }

  return (
    <div className="relative isolate w-full overflow-hidden px-4 py-10 sm:px-8 md:py-14">
      {/* mesh */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 bg-[linear-gradient(160deg,var(--mesh-a)_0%,transparent_45%),linear-gradient(-40deg,var(--mesh-b)_0%,transparent_44%)] opacity-95 dark:opacity-[0.45]"
      />
      <style>{`
        :root { --mesh-a: rgb(226 232 255 / 0.85); --mesh-b: rgb(204 251 241 / 0.75); }
        .dark { --mesh-a: rgb(67 56 202 / 0.35); --mesh-b: rgb(14 116 144 / 0.28); }
      `}</style>

      <motion.div
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45 }}
        className="mx-auto w-full max-w-[960px]"
      >
        <div className="overflow-hidden rounded-[1.6rem] border border-white/65 bg-[rgb(255_255_255/0.45)] shadow-[0_32px_80px_-42px_rgb(15_23_42/0.45)] backdrop-blur-2xl dark:border-slate-700/50 dark:bg-[rgb(15_23_42/0.95)] md:grid md:grid-cols-[minmax(0,42%)_minmax(0,1fr)]"
        >
          {/* Brand */}
          <div className="relative flex flex-col justify-between gap-8 bg-gradient-to-br from-[#312e81] via-indigo-600 to-[#134e4a] p-9 text-white md:min-h-[520px] md:p-11">
            <div
              aria-hidden
              className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgb(255_255_255/0.22),transparent_55%)] dark:bg-[radial-gradient(circle_at_75%_0%,rgb(99_102_241/0.5),transparent_50%)]"
            />
            <div className="relative">
              <div className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.2em] text-indigo-100">
                Nilai ijazah
              </div>
              <p className="mt-8 text-[1.58rem] font-bold leading-snug tracking-tight text-white sm:text-[1.75rem] md:text-[1.92rem]">
                Satu akses untuk <span className="text-teal-200">admin</span>
                {" "}
                <span className="text-emerald-200">guru,</span>
                {" "}
                <span className="text-yellow-100/95">dan siswa madrasah</span>.
              </p>
              <p className="mt-4 max-w-sm text-[14px] leading-relaxed text-indigo-100/90">
                Admin dan guru: masuk dengan <strong className="text-white">email</strong> dan sandi (atau Google). Siswa memakai tombol{" "}
                <strong className="text-white">Login Siswa</strong> di halaman ini.
              </p>
              <div className="mt-10 flex flex-wrap gap-5 text-[13px] text-teal-100/90">
                <div className="flex items-start gap-2">
                  <ShieldCheck className="size-5 shrink-0 opacity-95" /> <span>Lindungi data nilai ijazah</span>
                </div>
              </div>
            </div>
            <div className="relative text-[12px] text-indigo-200/95">
              © {new Date().getFullYear()} Syamsul Bahri · Crafted with purpose
            </div>
          </div>

          {/* Form */}
          <div className="relative p-9 sm:p-11">
            <div className="mb-8 md:hidden">
              <div className="mx-auto mb-3 flex size-12 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 to-teal-500 text-[18px] font-black text-white shadow-lg">
                SI
              </div>
            </div>

            {passwordResetDone ? (
              <div className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-[13px] font-medium leading-relaxed text-emerald-950 dark:border-emerald-500/35 dark:bg-emerald-950 dark:text-emerald-50">
                Sandi berhasil diatur ulang. Silakan masuk dengan email dan sandi baru Anda.
              </div>
            ) : null}

            {accountDeactivated ? (
              <div
                role="alert"
                className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-[13px] font-medium leading-relaxed text-amber-950 dark:border-amber-500/35 dark:bg-amber-950 dark:text-amber-100"
              >
                {ADMIN_ACCOUNT_DEACTIVATED_MESSAGE}
              </div>
            ) : null}

            {schoolDeactivated ? (
              <div
                role="alert"
                className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-[13px] font-medium leading-relaxed text-amber-950 dark:border-amber-500/35 dark:bg-amber-950 dark:text-amber-100"
              >
                {SCHOOL_DEACTIVATED_MESSAGE}
              </div>
            ) : null}

            {googleSubscriptionRequired ? (
              <div
                role="alert"
                className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-[13px] font-medium leading-relaxed text-amber-950 dark:border-amber-500/35 dark:bg-amber-950 dark:text-amber-100"
              >
                {SCHOOL_LOGIN_SUBSCRIPTION_BLOCKED_MESSAGE}
              </div>
            ) : null}

            {googleAccountNotLinked ? (
              <div
                role="alert"
                className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-[13px] font-medium leading-relaxed text-rose-900 dark:border-rose-500/35 dark:bg-rose-950 dark:text-rose-100"
              >
                Akun Google belum ditautkan. Masuk sekali dengan email dan sandi Anda, lalu coba
                Google lagi — atau hubungi admin sekolah jika masalah berlanjut.
              </div>
            ) : null}

            {googleNotRegistered &&
            !googleSubscriptionRequired &&
            !googleAccountNotLinked &&
            !accountDeactivated ? (
              <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-[13px] font-medium leading-relaxed text-rose-900 dark:border-rose-500/35 dark:bg-rose-950 dark:text-rose-100">
                Akun Google belum terdaftar di sistem. Silakan{" "}
                <Link href="/login/daftar" className="font-bold underline">
                  registrasi
                </Link>{" "}
                terlebih dahulu, atau hubungi admin sekolah Anda.
              </div>
            ) : null}

            <h2 className="text-center text-xl font-bold tracking-tight text-slate-900 dark:text-white md:text-left">
              {step === "pick-school" ? "Pilih sekolah" : "Selamat datang kembali"}
            </h2>
            <p className="mt-2 text-center text-[13px] text-slate-600 dark:text-slate-400 md:text-left">
              {step === "pick-school" ? (
                <>
                  Akun guru Anda terhubung ke lebih dari satu sekolah. Tetap memakai{" "}
                  <span className="font-semibold text-slate-800 dark:text-slate-200">
                    email dan sandi induk
                  </span>
                  {" "}
                  (satminkal); pilih sekolah yang ingin Anda buka kali ini.
                </>
              ) : (
                "Masuk untuk melanjutkan ke panel nilai ijazah"
              )}
            </p>

            {step === "pick-school" ? (
              <form className="mt-8 space-y-4" onSubmit={onPickSchoolSubmit}>
                {error ? (
                  <div
                    role="alert"
                    className="rounded-xl border border-rose-200/95 bg-rose-50 px-4 py-3 text-[13px] font-medium text-rose-900 dark:border-rose-500/45 dark:bg-rose-950 dark:text-rose-100"
                  >
                    {error}
                  </div>
                ) : null}

                <div className="rounded-xl border border-slate-200/90 bg-white/60 px-4 py-3 text-[13px] text-slate-700 dark:border-slate-600/80 dark:bg-slate-900/60 dark:text-slate-200">
                  <span className="font-semibold text-slate-900 dark:text-white">Akun:</span>{" "}
                  <span className="break-all">{email.trim()}</span>
                </div>

                <fieldset className="space-y-3">
                  <legend className="sr-only">Sekolah tujuan</legend>
                  {sortedSchoolContexts.map((s) => {
                    const label = s.namaSekolah?.trim() || s.schoolId;
                    const tier = s.isHome
                      ? "Sekolah induk (satminkal)"
                      : "Tugas tambahan (non-satminkal)";
                    return (
                      <label
                        key={s.schoolId}
                        className={`flex cursor-pointer gap-3 rounded-xl border px-4 py-3 transition has-[:focus-visible]:ring-4 has-[:focus-visible]:ring-indigo-500/25 ${
                          selectedContextSchoolId === s.schoolId
                            ? "border-indigo-400 bg-indigo-50/90 dark:border-indigo-500/60 dark:bg-indigo-950/40"
                            : "border-slate-200/95 bg-[rgb(255_255_255/0.75)] hover:border-slate-300 dark:border-slate-600/90 dark:bg-slate-900/50 dark:hover:border-slate-500"
                        }`}
                      >
                        <input
                          type="radio"
                          name="guru-school-context"
                          className="mt-1 size-4 shrink-0 accent-indigo-600"
                          checked={selectedContextSchoolId === s.schoolId}
                          onChange={() => setSelectedContextSchoolId(s.schoolId)}
                        />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-start gap-2">
                            <Building2 className="mt-0.5 size-4 shrink-0 text-indigo-600 dark:text-indigo-400" />
                            <div className="min-w-0">
                              <div className="text-[15px] font-semibold leading-snug text-slate-900 dark:text-white">
                                {label}
                              </div>
                              <div className="mt-1 flex flex-wrap items-center gap-2">
                                <span
                                  className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide ${
                                    s.isHome
                                      ? "bg-emerald-100 text-emerald-900 dark:bg-emerald-900/50 dark:text-emerald-100"
                                      : "bg-amber-100 text-amber-950 dark:bg-amber-900/45 dark:text-amber-100"
                                  }`}
                                >
                                  {tier}
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>
                      </label>
                    );
                  })}
                </fieldset>

                <div className="flex flex-col gap-3 pt-2 sm:flex-row sm:items-center">
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => backToCredentials()}
                    className="ui-btn ui-btn-ghost order-2 flex w-full items-center justify-center gap-2 sm:order-1 sm:w-auto"
                  >
                    <ArrowLeft className="size-4" />
                    Kembali
                  </button>
                  <button
                    type="submit"
                    disabled={busy || !selectedContextSchoolId}
                    className="order-1 flex w-full flex-1 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 via-violet-600 to-indigo-600 py-[0.92rem] text-[15px] font-semibold text-white shadow-[0_18px_40px_-20px_rgb(79_70_229/0.85)] transition enabled:hover:brightness-105 disabled:opacity-55 sm:order-2"
                  >
                    {busy ? "Memproses…" : "Masuk ke sekolah ini"}
                    <ArrowRight className="size-[18px]" />
                  </button>
                </div>
              </form>
            ) : (
              <>
                {signedOut ? (
                  <motion.div
                    role="status"
                    className="mt-8 rounded-xl border border-emerald-200/95 bg-emerald-50 px-4 py-3 text-[13px] leading-relaxed text-emerald-950 dark:border-emerald-500/40 dark:bg-emerald-950/45 dark:text-emerald-100"
                  >
                    Anda telah keluar dari akun. Masuk lagi dengan email &amp; sandi, atau pilih
                    akun Google jika memakai login Google.
                  </motion.div>
                ) : null}

                <form className={`space-y-4 ${signedOut ? "mt-4" : "mt-8"}`} onSubmit={onCredentialSubmit}>
                  {error ? (
                    <div
                      role="alert"
                      className="rounded-xl border border-rose-200/95 bg-rose-50 px-4 py-3 text-[13px] font-medium text-rose-900 dark:border-rose-500/45 dark:bg-rose-950 dark:text-rose-100"
                    >
                      {error}
                    </div>
                  ) : null}

                  <div className="space-y-1.5">
                    <label className="block text-[12px] font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                      Email
                    </label>
                    <div className="relative">
                      <Mail className="pointer-events-none absolute left-3 top-1/2 size-[18px] -translate-y-1/2 text-slate-400 dark:text-slate-500" />
                      <input
                        name="email"
                        type="text"
                        autoComplete="username"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="contoh: nama@madrasah.sch.id"
                        required
                        className="w-full rounded-xl border border-slate-200/95 bg-[rgb(255_255_255/0.85)] py-3 pl-11 pr-3 text-[15px] text-slate-900 shadow-inner shadow-slate-900/5 outline-none ring-indigo-500/0 transition placeholder:text-slate-400 focus:border-indigo-400 focus:ring-4 focus:ring-indigo-500/20 dark:border-slate-600/95 dark:bg-slate-900 dark:text-slate-100 dark:placeholder:text-slate-500"
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="block text-[12px] font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                      Sandi
                    </label>
                    <div className="relative">
                      <Lock className="pointer-events-none absolute left-3 top-1/2 size-[18px] -translate-y-1/2 text-slate-400 dark:text-slate-500" />
                      <input
                        name="password"
                        type={showPw ? "text" : "password"}
                        autoComplete="current-password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="••••••••"
                        required
                        minLength={8}
                        className="w-full rounded-xl border border-slate-200/95 bg-[rgb(255_255_255/0.85)] py-3 pl-11 pr-12 text-[15px] text-slate-900 shadow-inner shadow-slate-900/5 outline-none ring-indigo-500/0 transition placeholder:text-slate-400 focus:border-indigo-400 focus:ring-4 focus:ring-indigo-500/20 dark:border-slate-600/95 dark:bg-slate-900 dark:text-slate-100"
                      />
                      <button
                        type="button"
                        aria-label={showPw ? "Sembunyikan sandi" : "Tampilkan sandi"}
                        className="absolute right-3 top-1/2 flex size-8 -translate-y-1/2 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-white/10"
                        onClick={() => setShowPw(!showPw)}
                      >
                        {showPw ? <EyeOff className="size-[18px]" /> : <Eye className="size-[18px]" />}
                      </button>
                    </div>
                  </div>

                  <p className="text-[12px] leading-relaxed text-slate-500 dark:text-slate-400">
                    Guru dengan tugas di lebih dari satu sekolah akan diminta memilih sekolah setelah
                    sandi benar — login tetap memakai akun sekolah induk (satminkal).
                  </p>

                  <div className="flex justify-end">
                    <Link
                      href="/login/lupa-sandi"
                      className="text-[13px] font-semibold text-indigo-600 decoration-indigo-300 underline-offset-2 hover:underline dark:text-indigo-300"
                    >
                      Lupa sandi?
                    </Link>
                  </div>

                  <button
                    type="submit"
                    disabled={busy}
                    className="group flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 via-violet-600 to-indigo-600 py-[0.92rem] text-[15px] font-semibold text-white shadow-[0_18px_40px_-20px_rgb(79_70_229/0.85)] transition enabled:hover:brightness-105 disabled:opacity-55"
                  >
                    {busy ? "Memproses…" : "Masuk"}
                    <ArrowRight className="size-[18px] transition group-enabled:translate-x-0.5" />
                  </button>
                  <Link
                    href={
                      callbackUrl !== "/"
                        ? `/login/siswa?callbackUrl=${encodeURIComponent(callbackUrl)}`
                        : "/login/siswa"
                    }
                    className="flex w-full items-center justify-center rounded-xl border border-slate-200/95 bg-[rgb(255_255_255/0.75)] py-3 text-[15px] font-semibold text-slate-800 shadow-sm transition hover:bg-white dark:border-slate-600/90 dark:bg-slate-800/80 dark:text-slate-100 dark:hover:bg-slate-700"
                  >
                    Login Siswa
                  </Link>
                </form>

                <div className="relative my-8">
                  <div className="absolute inset-x-0 top-1/2 h-px -translate-y-1/2 bg-gradient-to-r from-transparent via-slate-200 to-transparent dark:via-slate-600" />
                  <span className="relative mx-auto block w-fit bg-white px-3 text-center text-[11px] font-bold uppercase tracking-[0.28em] text-slate-400 dark:bg-[#0f172a] dark:text-slate-500 md:bg-transparent md:dark:bg-transparent">
                    atau lanjutkan dengan
                  </span>
                </div>

                <button
                  type="button"
                  disabled={busy}
                  onClick={() =>
                    signIn(
                      "google",
                      { callbackUrl, redirect: true },
                      signedOut ? { prompt: "select_account" } : undefined,
                    )
                  }
                  className="flex w-full items-center justify-center gap-3 rounded-xl border border-slate-200/98 bg-[rgb(255_255_255/0.92)] py-3.5 text-[15px] font-semibold text-slate-800 shadow-sm transition hover:bg-white disabled:opacity-60 dark:border-slate-600/90 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700"
                >
                  <GoogleLogo />
                  Login dengan Google
                </button>
              </>
            )}

            <div className="mt-10 space-y-2 text-center text-[13px] text-slate-600 dark:text-slate-400">
              <p>
                Belum punya akun?{" "}
                <Link
                  href="/login/daftar"
                  className="font-bold text-indigo-600 underline-offset-2 hover:underline dark:text-indigo-300"
                >
                  Registrasi admin sekolah
                </Link>
              </p>
              <p>
                Butuh bantuan?{" "}
                <a
                  href={SUPERADMIN_SUPPORT_WHATSAPP_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-bold text-indigo-600 underline-offset-2 hover:underline dark:text-indigo-300"
                >
                  Hubungi Superadmin
                </a>
              </p>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
