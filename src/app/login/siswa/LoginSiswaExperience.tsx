"use client";

import { motion } from "framer-motion";
import { ArrowLeft, ArrowRight, Calendar } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import { useCallback, useMemo, useRef, useState } from "react";

import {
  CREDENTIALS_ERROR_SCHOOL_DEACTIVATED,
  SCHOOL_DEACTIVATED_MESSAGE,
} from "@/lib/school-active";

function digitsOnly(s: string, max: number): string {
  return s.replace(/\D/g, "").slice(0, max);
}

/** 8 digit → `DD-MM-YYYY` untuk verifikasi & login. */
function formatBirthDigits(d: string): string {
  const x = d.slice(0, 8);
  if (x.length <= 2) return x;
  if (x.length <= 4) return `${x.slice(0, 2)}-${x.slice(2)}`;
  return `${x.slice(0, 2)}-${x.slice(2, 4)}-${x.slice(4)}`;
}

/** Validasi DDMMYYYY: rentang + keberadaan tanggal di kalender (bukan 41, 13, 30-02, dll.). */
function validateBirthDigitsStrict(d: string): { ok: true } | { ok: false; message: string } {
  if (d.length !== 8) {
    return { ok: false, message: "Lengkapi 8 digit tanggal lahir (DD MM YYYY)." };
  }

  const dd = Number(d.slice(0, 2));
  const mm = Number(d.slice(2, 4));
  const yyyy = Number(d.slice(4, 8));

  if (![dd, mm, yyyy].every((n) => Number.isFinite(n))) {
    return { ok: false, message: "Format angka tidak valid." };
  }

  if (yyyy < 1900 || yyyy > 2100) {
    return { ok: false, message: "Tahun harus antara 1900 dan 2100." };
  }

  if (mm < 1 || mm > 12) {
    return { ok: false, message: "Bulan harus antara 01 dan 12 (bulan 13 atau 00 tidak valid)." };
  }

  if (dd < 1 || dd > 31) {
    return { ok: false, message: "Tanggal harus antara 01 dan 31 (tanggal 41 atau 00 tidak valid)." };
  }

  const dt = new Date(yyyy, mm - 1, dd);
  if (dt.getFullYear() !== yyyy || dt.getMonth() !== mm - 1 || dt.getDate() !== dd) {
    return {
      ok: false,
      message:
        "Tanggal ini tidak ada di kalender. Periksa hari dan bulan (misalnya 30 Februari, 31 April, atau 29 Februari di tahun yang bukan kabisat).",
    };
  }

  return { ok: true };
}

const NISN_LEN = 10;
const BIRTH_LEN = 8;
const BIRTH_PH = ["D", "D", "M", "M", "Y", "Y", "Y", "Y"] as const;

const cellInputClass =
  "box-border size-full min-h-0 min-w-0 border-0 bg-transparent p-0 text-center font-mono text-[0.95rem] font-semibold leading-none text-slate-900 caret-indigo-600 outline-none focus:ring-0 sm:text-[1.05rem] dark:text-white dark:caret-indigo-400";

const cellBoxClass =
  "relative box-border flex h-9 w-6 shrink-0 items-center justify-center overflow-hidden rounded-md border border-slate-200/95 bg-white/95 shadow-sm transition-[box-shadow,border-color] focus-within:z-[1] focus-within:border-indigo-400 focus-within:ring-2 focus-within:ring-indigo-500/35 dark:border-slate-600 dark:bg-slate-800/95 sm:h-11 sm:w-8 sm:rounded-lg";

export function LoginSiswaExperience({ callbackUrl }: { callbackUrl: string }) {
  const router = useRouter();
  const nisnRefs = useRef<(HTMLInputElement | null)[]>([]);
  const birthRefs = useRef<(HTMLInputElement | null)[]>([]);

  const [nisnCells, setNisnCells] = useState<string[]>(() => Array.from({ length: NISN_LEN }, () => ""));
  const [birthCells, setBirthCells] = useState<string[]>(() => Array.from({ length: BIRTH_LEN }, () => ""));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const nisnJoined = useMemo(() => nisnCells.join(""), [nisnCells]);
  const birthDigitsJoined = useMemo(() => birthCells.join(""), [birthCells]);

  const birthDateFieldError = useMemo(() => {
    if (birthDigitsJoined.length !== 8) return null;
    const r = validateBirthDigitsStrict(birthDigitsJoined);
    return r.ok ? null : r.message;
  }, [birthDigitsJoined]);

  const canSubmit =
    nisnJoined.length === NISN_LEN && birthDigitsJoined.length === BIRTH_LEN && validateBirthDigitsStrict(birthDigitsJoined).ok;

  const focusNisn = useCallback((i: number) => {
    const t = Math.max(0, Math.min(NISN_LEN - 1, i));
    requestAnimationFrame(() => {
      const el = nisnRefs.current[t];
      el?.focus();
      el?.select();
    });
  }, []);

  const focusBirth = useCallback((i: number) => {
    const t = Math.max(0, Math.min(BIRTH_LEN - 1, i));
    requestAnimationFrame(() => {
      const el = birthRefs.current[t];
      el?.focus();
      el?.select();
    });
  }, []);

  const handleNisnChange = useCallback((i: number, e: React.ChangeEvent<HTMLInputElement>) => {
    const v = digitsOnly(e.target.value, 99);
    setNisnCells((prev) => {
      const next = [...prev];
      if (v.length === 0) {
        next[i] = "";
        return next;
      }
      if (v.length === 1) {
        next[i] = v;
        return next;
      }
      let j = i;
      for (const ch of v) {
        if (j >= NISN_LEN) break;
        next[j] = ch;
        j++;
      }
      return next;
    });
    if (v.length === 1) focusNisn(i + 1);
    else if (v.length > 1) focusNisn(i + v.length);
  }, [focusNisn]);

  const handleNisnKeyDown = useCallback(
    (i: number, e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Backspace") {
        e.preventDefault();
        setNisnCells((prev) => {
          if (prev[i]) {
            const n = [...prev];
            n[i] = "";
            return n;
          }
          if (i > 0) {
            const n = [...prev];
            n[i - 1] = "";
            focusNisn(i - 1);
            return n;
          }
          return prev;
        });
        return;
      }
      if (e.key === "ArrowLeft" && i > 0) {
        e.preventDefault();
        focusNisn(i - 1);
      }
      if (e.key === "ArrowRight" && i < NISN_LEN - 1) {
        e.preventDefault();
        focusNisn(i + 1);
      }
    },
    [focusNisn],
  );

  const handleNisnPaste = useCallback(
    (i: number, e: React.ClipboardEvent<HTMLInputElement>) => {
      e.preventDefault();
      const d = digitsOnly(e.clipboardData.getData("text"), NISN_LEN);
      if (!d) return;
      setNisnCells((prev) => {
        const next = [...prev];
        let j = i;
        for (const ch of d) {
          if (j >= NISN_LEN) break;
          next[j] = ch;
          j++;
        }
        return next;
      });
      focusNisn(i + d.length);
    },
    [focusNisn],
  );

  const handleBirthChange = useCallback((i: number, e: React.ChangeEvent<HTMLInputElement>) => {
    const v = digitsOnly(e.target.value, 99);
    setBirthCells((prev) => {
      const next = [...prev];
      if (v.length === 0) {
        next[i] = "";
        return next;
      }
      if (v.length === 1) {
        next[i] = v;
        return next;
      }
      let j = i;
      for (const ch of v) {
        if (j >= BIRTH_LEN) break;
        next[j] = ch;
        j++;
      }
      return next;
    });
    if (v.length === 1) focusBirth(i + 1);
    else if (v.length > 1) focusBirth(i + v.length);
  }, [focusBirth]);

  const handleBirthKeyDown = useCallback(
    (i: number, e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Backspace") {
        e.preventDefault();
        setBirthCells((prev) => {
          if (prev[i]) {
            const n = [...prev];
            n[i] = "";
            return n;
          }
          if (i > 0) {
            const n = [...prev];
            n[i - 1] = "";
            focusBirth(i - 1);
            return n;
          }
          return prev;
        });
        return;
      }
      if (e.key === "ArrowLeft" && i > 0) {
        e.preventDefault();
        focusBirth(i - 1);
      }
      if (e.key === "ArrowRight" && i < BIRTH_LEN - 1) {
        e.preventDefault();
        focusBirth(i + 1);
      }
    },
    [focusBirth],
  );

  const handleBirthPaste = useCallback(
    (i: number, e: React.ClipboardEvent<HTMLInputElement>) => {
      e.preventDefault();
      const d = digitsOnly(e.clipboardData.getData("text"), BIRTH_LEN);
      if (!d) return;
      setBirthCells((prev) => {
        const next = [...prev];
        let j = i;
        for (const ch of d) {
          if (j >= BIRTH_LEN) break;
          next[j] = ch;
          j++;
        }
        return next;
      });
      focusBirth(i + d.length);
    },
    [focusBirth],
  );

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const nisn = nisnCells.join("");
    const birthDigits = birthCells.join("");
    if (nisn.length !== NISN_LEN) {
      setError("Lengkapi NISN 10 digit.");
      return;
    }
    const birthRes = validateBirthDigitsStrict(birthDigits);
    if (!birthRes.ok) {
      setError(birthRes.message);
      return;
    }
    const tanggalLahir = formatBirthDigits(birthDigits);
    setBusy(true);
    try {
      const checkRes = await fetch("/api/auth/siswa-login-check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nisn, tanggalLahir }),
      });
      const checkBody = (await checkRes.json()) as { ok?: boolean; message?: string };
      if (!checkBody.ok) {
        setError(
          typeof checkBody.message === "string"
            ? checkBody.message
            : checkRes.status === 429
              ? "Terlalu banyak percobaan. Tunggu sebentar lalu coba lagi."
              : "NISN atau tanggal lahir tidak cocok, atau akun belum diaktifkan oleh sekolah.",
        );
        return;
      }

      const res = await signIn("siswa-credentials", {
        nisn,
        tanggalLahir,
        redirect: false,
        callbackUrl,
      });
      if (res?.error) {
        const code = (res as { code?: string }).code;
        if (code === CREDENTIALS_ERROR_SCHOOL_DEACTIVATED) {
          setError(SCHOOL_DEACTIVATED_MESSAGE);
          return;
        }
        setError(
          "NISN atau tanggal lahir tidak cocok, atau akun belum diaktifkan. Login siswa memerlukan langganan aktif di sekolah Anda.",
        );
        return;
      }
      if (res?.url) {
        router.push(res.url);
        router.refresh();
        return;
      }
      router.push(callbackUrl);
      router.refresh();
    } catch {
      setError("Terjadi kesalahan saat masuk. Coba lagi.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="relative isolate w-full overflow-hidden px-3 py-8 sm:px-8 sm:py-10 md:py-14">
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
        <div className="overflow-hidden rounded-[1.35rem] border border-white/65 bg-[rgb(255_255_255/0.45)] shadow-[0_32px_80px_-42px_rgb(15_23_42/0.45)] backdrop-blur-2xl dark:border-slate-700/50 dark:bg-[rgb(15_23_42/0.95)] sm:rounded-[1.6rem] md:grid md:grid-cols-[minmax(0,42%)_minmax(0,1fr)]">
          <div className="relative flex flex-col justify-between gap-6 bg-gradient-to-br from-[#312e81] via-indigo-600 to-[#134e4a] p-7 text-white sm:gap-8 sm:p-9 md:min-h-[520px] md:p-11">
            <div
              aria-hidden
              className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgb(255_255_255/0.22),transparent_55%)] dark:bg-[radial-gradient(circle_at_75%_0%,rgb(99_102_241/0.5),transparent_50%)]"
            />
            <div className="relative">
              <div className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.2em] text-indigo-100 sm:text-[11px]">
                Nilai ijazah
              </div>
              <p className="mt-6 text-[1.35rem] font-bold leading-snug tracking-tight text-white sm:mt-8 sm:text-[1.75rem] md:text-[1.92rem]">
                Masuk sebagai <span className="text-teal-200">siswa</span>
              </p>
              <p className="mt-3 max-w-sm text-[13px] leading-relaxed text-indigo-100/90 sm:mt-4 sm:text-[14px]">
                Gunakan NISN dan tanggal lahir sesuai data di sekolah. Sandi login mengikuti tanggal lahir saat akun
                diaktifkan.
              </p>
            </div>
            <div className="relative text-[11px] text-indigo-200/95 sm:text-[12px]">
              © {new Date().getFullYear()} Syamsul Bahri · Crafted with purpose
            </div>
          </div>

          <div className="relative min-w-0 max-w-full px-5 py-7 sm:px-9 sm:py-10 md:p-11">
            <div className="mb-6 md:hidden">
              <div className="mx-auto mb-2 flex size-11 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 to-teal-500 text-[16px] font-black text-white shadow-lg sm:size-12 sm:text-[18px]">
                SI
              </div>
            </div>

            <h2 className="text-center text-lg font-bold tracking-tight text-slate-900 dark:text-white sm:text-xl md:text-left">
              Login siswa
            </h2>
            <p className="mt-1.5 text-center text-[12px] text-slate-600 dark:text-slate-400 sm:text-[13px] md:text-left">
              NISN 10 digit dan tanggal lahir (format DD-MM-YYYY). Satu angka per kotak — gunakan panah atau tab untuk
              berpindah, Backspace untuk hapus.
            </p>

            <form className="mx-auto mt-6 w-full min-w-0 max-w-md space-y-5 sm:mt-8 sm:space-y-6 md:mx-0" onSubmit={onSubmit}>
              {error ? (
                <div
                  role="alert"
                  className="rounded-xl border border-rose-200/95 bg-rose-50 px-3 py-2.5 text-[12px] font-medium leading-snug text-rose-900 dark:border-rose-500/45 dark:bg-rose-950 dark:text-rose-100 sm:px-4 sm:text-[13px]"
                >
                  {error}
                </div>
              ) : null}

              <div className="space-y-1.5">
                <p
                  id="label-nisn-siswa"
                  className="text-[11px] font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400 sm:text-[12px]"
                >
                  NISN (10 digit)
                </p>
                <div
                  role="group"
                  aria-labelledby="label-nisn-siswa"
                  className="flex min-w-0 flex-nowrap items-stretch justify-center gap-[3px] overflow-x-auto overflow-y-visible rounded-xl border border-slate-200/95 bg-[rgb(255_255_255/0.9)] px-2 py-2 shadow-inner shadow-slate-900/5 [-webkit-overflow-scrolling:touch] dark:border-slate-600/95 dark:bg-slate-900/95 sm:gap-1 sm:px-2.5 sm:py-2.5"
                >
                  {Array.from({ length: NISN_LEN }, (_, i) => (
                    <div key={i} className={cellBoxClass}>
                      {!nisnCells[i] ? (
                        <span
                          className="pointer-events-none absolute inset-0 flex items-center justify-center font-mono text-[0.85rem] font-semibold text-slate-400 sm:text-[0.95rem] dark:text-slate-500"
                          aria-hidden
                        >
                          _
                        </span>
                      ) : null}
                      <input
                        ref={(el) => {
                          nisnRefs.current[i] = el;
                        }}
                        type="text"
                        inputMode="numeric"
                        autoComplete={i === 0 ? "username" : "off"}
                        name={`nisn-${i}`}
                        id={i === 0 ? "siswa-nisn-0" : undefined}
                        maxLength={1}
                        value={nisnCells[i] ?? ""}
                        onChange={(e) => handleNisnChange(i, e)}
                        onKeyDown={(e) => handleNisnKeyDown(i, e)}
                        onPaste={(e) => handleNisnPaste(i, e)}
                        onFocus={(e) => e.target.select()}
                        className={cellInputClass}
                        aria-label={`NISN digit ${i + 1} dari ${NISN_LEN}`}
                      />
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-1.5">
                <p
                  id="label-birth-siswa"
                  className="text-[11px] font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400 sm:text-[12px]"
                >
                  Tanggal lahir
                </p>
                <div className="relative min-w-0 rounded-xl border border-slate-200/95 bg-[rgb(255_255_255/0.9)] px-1.5 py-2 shadow-inner shadow-slate-900/5 dark:border-slate-600/95 dark:bg-slate-900/95 sm:px-2 sm:py-2.5">
                  <Calendar className="pointer-events-none absolute left-2 top-1/2 z-[2] size-[0.95rem] -translate-y-1/2 text-slate-400 dark:text-slate-500 sm:left-2.5 sm:size-[1.05rem]" />
                  <div
                    role="group"
                    aria-labelledby="label-birth-siswa"
                    className={`flex min-w-0 flex-nowrap items-center justify-center gap-x-0.5 overflow-x-auto overflow-y-hidden pl-7 pr-0.5 [-webkit-overflow-scrolling:touch] sm:justify-center sm:gap-x-1 sm:pl-8 sm:pr-1 ${birthDateFieldError ? "rounded-md ring-2 ring-amber-500/40" : ""}`}
                  >
                    <div className="flex shrink-0 flex-nowrap items-center gap-[3px] sm:gap-1">
                      {[0, 1].map((i) => (
                        <div key={i} className={cellBoxClass}>
                          {!birthCells[i] ? (
                            <span
                              className="pointer-events-none absolute inset-0 flex items-center justify-center font-mono text-[0.8rem] font-semibold text-slate-400 sm:text-[0.9rem] dark:text-slate-500"
                              aria-hidden
                            >
                              {BIRTH_PH[i]}
                            </span>
                          ) : null}
                          <input
                            ref={(el) => {
                              birthRefs.current[i] = el;
                            }}
                            type="text"
                            inputMode="numeric"
                            autoComplete="off"
                            name={`birth-${i}`}
                            id={i === 0 ? "siswa-birth-0" : undefined}
                            maxLength={1}
                            value={birthCells[i] ?? ""}
                            onChange={(e) => handleBirthChange(i, e)}
                            onKeyDown={(e) => handleBirthKeyDown(i, e)}
                            onPaste={(e) => handleBirthPaste(i, e)}
                            onFocus={(e) => e.target.select()}
                            className={cellInputClass}
                            aria-label={`Tanggal digit ${i + 1}: ${i < 2 ? "tanggal" : i < 4 ? "bulan" : "tahun"}`}
                          />
                        </div>
                      ))}
                    </div>
                    <span className="shrink-0 select-none px-0.5 text-xs text-slate-400 sm:text-sm" aria-hidden>
                      -
                    </span>
                    <div className="flex shrink-0 flex-nowrap items-center gap-[3px] sm:gap-1">
                      {[2, 3].map((i) => (
                        <div key={i} className={cellBoxClass}>
                          {!birthCells[i] ? (
                            <span
                              className="pointer-events-none absolute inset-0 flex items-center justify-center font-mono text-[0.8rem] font-semibold text-slate-400 sm:text-[0.9rem] dark:text-slate-500"
                              aria-hidden
                            >
                              {BIRTH_PH[i]}
                            </span>
                          ) : null}
                          <input
                            ref={(el) => {
                              birthRefs.current[i] = el;
                            }}
                            type="text"
                            inputMode="numeric"
                            autoComplete="off"
                            name={`birth-${i}`}
                            maxLength={1}
                            value={birthCells[i] ?? ""}
                            onChange={(e) => handleBirthChange(i, e)}
                            onKeyDown={(e) => handleBirthKeyDown(i, e)}
                            onPaste={(e) => handleBirthPaste(i, e)}
                            onFocus={(e) => e.target.select()}
                            className={cellInputClass}
                            aria-label={`Tanggal digit ${i + 1}: bulan`}
                          />
                        </div>
                      ))}
                    </div>
                    <span className="shrink-0 select-none px-0.5 text-xs text-slate-400 sm:text-sm" aria-hidden>
                      -
                    </span>
                    <div className="flex shrink-0 flex-nowrap items-center gap-[3px] sm:gap-1">
                      {[4, 5, 6, 7].map((i) => (
                        <div key={i} className={cellBoxClass}>
                          {!birthCells[i] ? (
                            <span
                              className="pointer-events-none absolute inset-0 flex items-center justify-center font-mono text-[0.8rem] font-semibold text-slate-400 sm:text-[0.9rem] dark:text-slate-500"
                              aria-hidden
                            >
                              {BIRTH_PH[i]}
                            </span>
                          ) : null}
                          <input
                            ref={(el) => {
                              birthRefs.current[i] = el;
                            }}
                            type="text"
                            inputMode="numeric"
                            autoComplete="off"
                            name={`birth-${i}`}
                            maxLength={1}
                            value={birthCells[i] ?? ""}
                            onChange={(e) => handleBirthChange(i, e)}
                            onKeyDown={(e) => handleBirthKeyDown(i, e)}
                            onPaste={(e) => handleBirthPaste(i, e)}
                            onFocus={(e) => e.target.select()}
                            className={cellInputClass}
                            aria-label={`Tanggal digit ${i + 1}: tahun`}
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
                {birthDateFieldError ? (
                  <p
                    id="birth-date-inline-error"
                    role="alert"
                    className="rounded-lg border border-amber-200/95 bg-amber-50/95 px-2.5 py-1.5 text-[11px] font-medium leading-snug text-amber-950 dark:border-amber-800/60 dark:bg-amber-950/40 dark:text-amber-100 sm:text-[12px]"
                  >
                    {birthDateFieldError}
                  </p>
                ) : null}
                <p className="text-[11px] leading-relaxed text-slate-500 dark:text-slate-400 sm:text-[12px]">
                  <span className="font-semibold text-slate-600 dark:text-slate-300">Petunjuk:</span> kotak{" "}
                  <span className="font-mono">D</span> = tanggal, <span className="font-mono">M</span> = bulan,{" "}
                  <span className="font-mono">Y</span> = tahun. Tempel 8 digit sekaligus (mis.{" "}
                  <span className="font-mono font-semibold">19062019</span>) akan terisi per kotak. Login memakai format{" "}
                  <span className="font-mono font-semibold">19-06-2019</span>.
                </p>
              </div>

              <button
                type="submit"
                title={
                  !busy && !canSubmit
                    ? nisnJoined.length < NISN_LEN
                      ? "Lengkapi NISN 10 digit."
                      : "Perbaiki tanggal lahir hingga tanggalnya valid di kalender."
                    : undefined
                }
                disabled={busy || !canSubmit}
                className="group flex min-h-[3rem] w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 via-violet-600 to-indigo-600 py-3.5 text-[15px] font-semibold text-white shadow-[0_18px_40px_-20px_rgb(79_70_229/0.85)] transition enabled:hover:brightness-105 disabled:opacity-55 sm:py-[0.92rem]"
              >
                {busy ? "Memproses…" : "Masuk"}
                <ArrowRight className="size-[18px] transition group-enabled:translate-x-0.5" />
              </button>
            </form>

            <p className="mt-8 text-center text-[12px] text-slate-600 dark:text-slate-400 sm:mt-10 sm:text-[13px]">
              <Link
                href={`/login${callbackUrl && callbackUrl !== "/" ? `?callbackUrl=${encodeURIComponent(callbackUrl)}` : ""}`}
                className="inline-flex items-center justify-center gap-2 font-bold text-indigo-600 underline-offset-2 hover:underline dark:text-indigo-300"
              >
                <ArrowLeft className="size-4 shrink-0" />
                Login admin &amp; guru
              </Link>
            </p>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
