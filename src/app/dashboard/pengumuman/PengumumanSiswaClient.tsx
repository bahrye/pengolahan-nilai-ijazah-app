"use client";

import confetti from "canvas-confetti";
import { AnimatePresence, motion } from "framer-motion";
import Link from "next/link";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";

import { useToast } from "@/components/ToastProvider";
import { formatKelulusanTanggalWaktuLokal } from "@/lib/format-kelulusan-wita";
import {
  FREE_PENGUMUMAN_HOUR,
  getBrowserTimeZone,
  indonesiaTzAbbrevForTimeZone,
} from "@/lib/indonesia-timezone";
import {
  pengumumanAdminPreviewSyncAction,
  pengumumanSiswaAmbilStatusKelulusanAction,
  pengumumanSiswaSelesaiCekKelulusanAction,
  pengumumanSiswaSyncAction,
} from "@/server/actions/pengumuman-siswa";

export type PengumumanPageMode = "siswa" | "admin-preview";

const SYNC_MS = 300000; // 5 menit
const LIVE_MS = 100;

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

function formatCountdownParts(msUntil: number) {
  const totalSec = Math.max(0, Math.floor(msUntil / 1000));
  const days = Math.floor(totalSec / 86400);
  const hours = Math.floor((totalSec % 86400) / 3600);
  const minutes = Math.floor((totalSec % 3600) / 60);
  const seconds = totalSec % 60;
  return { days, hours, minutes, seconds };
}

function fireLulusConfetti() {
  const colors = ["#22c55e", "#4ade80", "#a7f3d0", "#6366f1", "#818cf8", "#fbbf24"];
  const end = Date.now() + 2600;
  const tick = () => {
    void confetti({
      particleCount: 2,
      angle: 60,
      spread: 55,
      origin: { x: 0, y: 0.72 },
      colors,
      ticks: 220,
      gravity: 1.05,
      scalar: 0.9,
    });
    void confetti({
      particleCount: 2,
      angle: 120,
      spread: 55,
      origin: { x: 1, y: 0.72 },
      colors,
      ticks: 220,
      gravity: 1.05,
      scalar: 0.9,
    });
    if (Date.now() < end) requestAnimationFrame(tick);
  };
  tick();
  void confetti({
    particleCount: 90,
    spread: 88,
    startVelocity: 38,
    origin: { y: 0.58 },
    colors,
    ticks: 260,
    scalar: 1.05,
  });
}

function fireTidakLulusEffect() {
  const colors = ["#64748b", "#94a3b8", "#475569", "#334155"];
  void confetti({
    particleCount: 55,
    spread: 70,
    startVelocity: 18,
    gravity: 1.35,
    ticks: 90,
    decay: 0.9,
    scalar: 0.75,
    origin: { y: 0.55 },
    colors,
    shapes: ["circle"],
  });
}

export function PengumumanSiswaClient({
  mode = "siswa",
}: {
  mode?: PengumumanPageMode;
}) {
  const isAdminPreview = mode === "admin-preview";
  const { toast } = useToast();
  const [liveTick, setLiveTick] = useState(0);
  const [serverOffsetMs, setServerOffsetMs] = useState(0);
  const [announcementAtIso, setAnnouncementAtIso] = useState<string | null>(null);
  const [isDummySchedule, setIsDummySchedule] = useState(false);
  const [hasAck, setHasAck] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [cekReady, setCekReady] = useState(false);
  const cekTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cekScheduledForPastRef = useRef(false);

  const [result, setResult] = useState<{
    kelulusan: "LULUS" | "TIDAK LULUS";
    rataRataDisplay: string;
  } | null>(null);
  const [checking, setChecking] = useState(false);
  const [statusLoading, setStatusLoading] = useState(false);
  const [scheduleDisplay, setScheduleDisplay] = useState("");
  const clientTimeZone = useMemo(() => getBrowserTimeZone(), []);
  const [scheduleTimeZone, setScheduleTimeZone] = useState(clientTimeZone);

  const localTzAbbrev = useMemo(
    () => indonesiaTzAbbrevForTimeZone(scheduleTimeZone),
    [scheduleTimeZone],
  );

  const announcementAtMs = useMemo(
    () => (announcementAtIso ? Date.parse(announcementAtIso) : null),
    [announcementAtIso],
  );

  const effectiveNowMs = Date.now() + serverOffsetMs + liveTick * 0;
  const msUntil =
    announcementAtMs != null ? announcementAtMs - effectiveNowMs : null;

  const doSync = useCallback(async () => {
    if (isAdminPreview) {
      const r = await pengumumanAdminPreviewSyncAction({ clientTimeZone });
      if (!r.ok) {
        setSyncError(r.message);
        return;
      }
      setSyncError(null);
      const serverMs = Date.parse(r.serverNowIso);
      setServerOffsetMs(serverMs - Date.now());
      setAnnouncementAtIso(r.announcementAtIso);
      setIsDummySchedule(Boolean(r.isDummySchedule));
      if (r.scheduleTimeZone) setScheduleTimeZone(r.scheduleTimeZone);
      setHasAck(false);
      return;
    }

    const r = await pengumumanSiswaSyncAction();
    if (!r.ok) {
      setSyncError(r.message);
      return;
    }
    setSyncError(null);
    const serverMs = Date.parse(r.serverNowIso);
    setServerOffsetMs(serverMs - Date.now());
    setAnnouncementAtIso(r.announcementAtIso);
    setHasAck(r.hasAck);
  }, [isAdminPreview, clientTimeZone]);

  useLayoutEffect(() => {
    if (!announcementAtIso) {
      setScheduleDisplay("");
      return;
    }
    const update = () => setScheduleDisplay(formatKelulusanTanggalWaktuLokal(announcementAtIso));
    update();
    window.addEventListener("timezonechange", update);
    return () => window.removeEventListener("timezonechange", update);
  }, [announcementAtIso]);

  useEffect(() => {
    void doSync();
  }, [doSync]);

  useEffect(() => {
    const id = setInterval(() => setLiveTick((x) => x + 1), LIVE_MS);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    const id = setInterval(() => void doSync(), SYNC_MS);
    const onFocus = () => void doSync();
    const onVis = () => {
      if (document.visibilityState === "visible") void doSync();
    };
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVis);
    return () => {
      clearInterval(id);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [doSync]);

  useEffect(() => {
    if (isAdminPreview || !hasAck || !announcementAtIso || result) return;
    let cancelled = false;
    setStatusLoading(true);
    void (async () => {
      const r = await pengumumanSiswaAmbilStatusKelulusanAction();
      if (cancelled) return;
      setStatusLoading(false);
      if (r.ok) {
        setResult({ kelulusan: r.kelulusan, rataRataDisplay: r.rataRataDisplay });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isAdminPreview, hasAck, announcementAtIso, result]);

  useEffect(() => {
    if (isAdminPreview || result || announcementAtMs == null) {
      setCekReady(false);
      cekScheduledForPastRef.current = false;
      if (cekTimerRef.current) {
        clearTimeout(cekTimerRef.current);
        cekTimerRef.current = null;
      }
      return;
    }

    const tick = () => {
      const eff = Date.now() + serverOffsetMs;
      const until = announcementAtMs - eff;
      if (until > 0) {
        setCekReady(false);
        cekScheduledForPastRef.current = false;
        if (cekTimerRef.current) {
          clearTimeout(cekTimerRef.current);
          cekTimerRef.current = null;
        }
        return;
      }
      const lateMs = -until;
      if (lateMs >= 900) {
        setCekReady(true);
        return;
      }
      if (!cekScheduledForPastRef.current) {
        cekScheduledForPastRef.current = true;
        const wait = Math.max(0, 900 - lateMs);
        cekTimerRef.current = setTimeout(() => {
          setCekReady(true);
          cekTimerRef.current = null;
        }, wait);
      }
    };

    tick();
    const iv = setInterval(tick, 150);
    return () => {
      clearInterval(iv);
      if (cekTimerRef.current) {
        clearTimeout(cekTimerRef.current);
        cekTimerRef.current = null;
      }
    };
  }, [isAdminPreview, announcementAtMs, serverOffsetMs, result]);

  useEffect(() => {
    if (isAdminPreview) return;
    if (result?.kelulusan === "LULUS") {
      fireLulusConfetti();
    } else if (result?.kelulusan === "TIDAK LULUS") {
      fireTidakLulusEffect();
    }
  }, [isAdminPreview, result?.kelulusan]);

  async function onCekKelulusan() {
    if (isAdminPreview) return;
    setChecking(true);
    const r = await pengumumanSiswaSelesaiCekKelulusanAction();
    setChecking(false);
    if (!r.ok) {
      toast(r.message, "error");
      return;
    }
    setHasAck(true);
    setResult({ kelulusan: r.kelulusan, rataRataDisplay: r.rataRataDisplay });
  }

  const parts =
    msUntil != null && msUntil > 10000 ? formatCountdownParts(msUntil) : null;
  const finalSecond =
    msUntil != null && msUntil > 0 && msUntil <= 10000
      ? Math.min(10, Math.max(1, Math.ceil(msUntil / 1000)))
      : msUntil != null && msUntil <= 0
        ? 0
        : null;

  const showFarCountdown = msUntil != null && msUntil > 10000;
  const showFinalTick = msUntil != null && msUntil > 0 && msUntil <= 10000;
  const showZeroWait =
    !isAdminPreview && msUntil != null && msUntil <= 0 && !cekReady && !result;
  const showCekButton =
    !isAdminPreview && msUntil != null && msUntil <= 0 && cekReady && !result;
  const showAdminPreviewCekHint = isAdminPreview && msUntil != null && msUntil <= 0;

  return (
    <div className="relative mx-auto max-w-3xl space-y-8 pb-16">
      <div className="space-y-1 text-center sm:text-left">
        <h1 className="ui-page-title">
          {isAdminPreview ? "Pratinjau pengumuman siswa" : "Pengumuman kelulusan"}
        </h1>
        <p className="ui-muted text-pretty">
          {isAdminPreview
            ? "Tampilan ini sama dengan portal siswa (hitungan mundur). Tombol cek kelulusan dan hasil hanya aktif di akun siswa."
            : "Hitungan mundur disinkronkan dengan server dan diperbarui secara berkala agar waktu pengumuman tidak terlewat."}
        </p>
      </div>

      {isAdminPreview ? (
        <div
          className={`ui-alert flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between ${
            isDummySchedule
              ? "border-amber-200/90 bg-amber-50/90 text-amber-950 dark:border-amber-500/35 dark:bg-amber-950/40 dark:text-amber-100"
              : "border-sky-200/90 bg-sky-50/90 text-sky-950 dark:border-sky-500/35 dark:bg-sky-950/40 dark:text-sky-100"
          }`}
        >
          <div className="min-w-0 space-y-1">
            <p className="text-sm font-semibold">Mode pratinjau administrator</p>
            {isDummySchedule ? (
              <p className="text-[13px] leading-relaxed opacity-90">
                Akun <strong>free</strong> memakai jadwal <strong>contoh</strong>: besok pukul{" "}
                <strong>
                  {FREE_PENGUMUMAN_HOUR}:00 {localTzAbbrev}
                </strong>{" "}
                (sesuai waktu di perangkat Anda). Setelah lewat jam {FREE_PENGUMUMAN_HOUR}:00{" "}
                {localTzAbbrev}, tanggal contoh otomatis bergeser ke besok berikutnya (hitungan
                mundur di-reset setiap hari). Untuk jadwal resmi per sekolah, berlangganan lalu
                atur di pengaturan kelulusan.
              </p>
            ) : (
              <p className="text-[13px] leading-relaxed opacity-90">
                Siswa membuka menu <strong>Pengumuman</strong> di akun mereka. Atur jadwal di
                pengaturan kelulusan.
              </p>
            )}
          </div>
          {isDummySchedule ? (
            <Link
              href="/dashboard/langganan"
              className="ui-btn ui-btn-sm shrink-0 border-amber-300/80 bg-white text-amber-900 hover:bg-amber-100 dark:border-amber-600 dark:bg-amber-900/50 dark:text-amber-100 dark:hover:bg-amber-900"
            >
              Berlangganan
            </Link>
          ) : (
            <Link
              href="/dashboard/pengaturan-kelulusan"
              className="ui-btn ui-btn-sm shrink-0 border-sky-300/80 bg-white text-sky-900 hover:bg-sky-100 dark:border-sky-600 dark:bg-sky-900/50 dark:text-sky-100 dark:hover:bg-sky-900"
            >
              Pengaturan kelulusan
            </Link>
          )}
        </div>
      ) : null}

      {syncError ? (
        <div className="ui-alert ui-alert-error flex flex-col items-stretch gap-3 sm:flex-row sm:items-center sm:justify-between">
          <span className="font-medium">{syncError}</span>
          <button type="button" className="ui-btn ui-btn-primary ui-btn-sm shrink-0" onClick={() => void doSync()}>
            Coba lagi
          </button>
        </div>
      ) : null}

      {!syncError && !announcementAtIso ? (
        <div className="ui-card ui-card-tight text-center">
          <p className="text-base font-medium">Jadwal pengumuman belum diatur</p>
          <p className="ui-muted mt-2 text-pretty text-sm">
            {isAdminPreview
              ? "Tetapkan tanggal dan waktu pengumuman kelulusan agar siswa melihat hitungan mundur di portal mereka."
              : "Administrator sekolah belum menetapkan tanggal dan waktu pengumuman kelulusan. Silakan cek kembali nanti."}
          </p>
          {isAdminPreview ? (
            <Link
              href="/dashboard/pengaturan-kelulusan"
              className="ui-btn ui-btn-primary ui-btn-sm mt-4 inline-flex"
            >
              Atur jadwal pengumuman
            </Link>
          ) : null}
        </div>
      ) : null}

      {!isAdminPreview && !syncError && announcementAtIso && statusLoading && !result ? (
        <p className="ui-muted text-center text-sm">Memuat status pengumuman…</p>
      ) : null}

      {!syncError && announcementAtIso && !result && !(hasAck && statusLoading) ? (
        <div className="relative flex min-h-[280px] flex-col items-center justify-center gap-8 px-2 py-10 sm:min-h-[320px]">
          <div className="w-full max-w-xl space-y-1 text-center">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
              Menuju pengumuman kelulusan
            </p>
            <p className="text-lg font-bold text-black dark:text-white sm:text-xl">
              {scheduleDisplay || (
                <span className="text-base font-normal text-slate-400">Menyesuaikan zona waktu…</span>
              )}
            </p>
            {isAdminPreview && isDummySchedule ? (
              <p className="mx-auto mt-2 max-w-md text-[13px] font-medium text-amber-800 dark:text-amber-200/95">
                Tanggal di atas adalah contoh (besok {FREE_PENGUMUMAN_HOUR}:00 {localTzAbbrev}) —
                bukan jadwal resmi sekolah.
              </p>
            ) : null}
          </div>

          {showFarCountdown && parts ? (
            <motion.div
              key="far"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              className="relative z-10 w-full max-w-xl space-y-4 text-center"
            >
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {[
                  { v: parts.days, l: "Hari" },
                  { v: parts.hours, l: "Jam" },
                  { v: parts.minutes, l: "Menit" },
                  { v: parts.seconds, l: "Detik" },
                ].map((cell) => (
                  <div
                    key={cell.l}
                    className="rounded-2xl border border-slate-200 bg-white px-3 py-5 shadow-sm dark:border-slate-600 dark:bg-slate-800/90"
                  >
                    <div className="font-mono text-4xl font-bold tabular-nums tracking-tight text-slate-900 dark:text-white sm:text-5xl">
                      {pad2(cell.v)}
                    </div>
                    <div className="mt-1 text-xs font-medium text-slate-500 dark:text-slate-400">{cell.l}</div>
                  </div>
                ))}
              </div>
            </motion.div>
          ) : null}

          {showFinalTick && finalSecond != null && finalSecond >= 1 ? (
            <motion.div
              key="tick"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="relative z-10 flex flex-col items-center"
            >
              <p className="mb-6 text-sm font-semibold text-slate-700 dark:text-slate-200">
                Hitungan mundur pengumuman
              </p>
              <AnimatePresence mode="popLayout">
                <motion.div
                  key={finalSecond}
                  initial={{ scale: 0.35, opacity: 0, rotate: -8 }}
                  animate={{
                    scale: 1,
                    opacity: 1,
                    rotate: 0,
                    transition: { type: "spring", stiffness: 420, damping: 22 },
                  }}
                  exit={{ scale: 1.35, opacity: 0, y: -28, transition: { duration: 0.22 } }}
                  className="select-none font-black tabular-nums text-indigo-700 drop-shadow-sm dark:text-amber-200"
                  style={{ fontSize: "clamp(5rem, 22vw, 11rem)", lineHeight: 1 }}
                >
                  {finalSecond}
                </motion.div>
              </AnimatePresence>
            </motion.div>
          ) : null}

          {showZeroWait ? (
            <motion.div
              key="zero-wait"
              initial={{ scale: 0.4, opacity: 0 }}
              animate={{
                scale: [0.4, 1.08, 1],
                opacity: 1,
                transition: { duration: 0.55, ease: "easeOut" },
              }}
              className="relative z-10 flex flex-col items-center"
            >
              <p className="mb-4 text-sm font-semibold text-slate-700 dark:text-slate-200">Waktu pengumuman tiba</p>
              <motion.div
                animate={{
                  textShadow: [
                    "0 0 0px rgba(99,102,241,0)",
                    "0 0 36px rgba(99,102,241,0.35)",
                    "0 0 0px rgba(99,102,241,0)",
                  ],
                  transition: { duration: 1.1, repeat: Infinity, ease: "easeInOut" },
                }}
                className="font-black tabular-nums text-emerald-700 dark:text-emerald-300"
                style={{ fontSize: "clamp(5rem, 22vw, 11rem)", lineHeight: 1 }}
              >
                0
              </motion.div>
            </motion.div>
          ) : null}

          {showCekButton ? (
            <motion.div
              key="cek"
              initial={{ opacity: 0, y: 16, scale: 0.92 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ type: "spring", stiffness: 280, damping: 22 }}
              className="relative z-10 flex flex-col items-center gap-3"
            >
              <p className="max-w-sm text-center text-sm text-slate-600 dark:text-slate-300">
                Tekan tombol di bawah untuk membuka pengumuman resmi Anda.
              </p>
              <button
                type="button"
                disabled={checking}
                onClick={() => void onCekKelulusan()}
                className="ui-btn ui-btn-primary min-w-[220px] px-8 py-3 text-base font-semibold shadow-md shadow-indigo-900/25 dark:shadow-indigo-950/40"
              >
                {checking ? "Memproses…" : "Cek kelulusan"}
              </button>
            </motion.div>
          ) : null}

          {showAdminPreviewCekHint ? (
            <motion.div
              key="admin-cek-hint"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              className="relative z-10 max-w-md rounded-2xl border border-dashed border-slate-300 bg-slate-50/90 px-5 py-4 text-center dark:border-slate-600 dark:bg-slate-800/60"
            >
              <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                Pratinjau tombol siswa
              </p>
              <p className="mt-2 text-[13px] leading-relaxed text-slate-600 dark:text-slate-300">
                Di sini siswa akan melihat tombol <strong>Cek kelulusan</strong> setelah waktu pengumuman tiba.
                Hasil kelulusan hanya ditampilkan di akun siswa masing-masing.
              </p>
              <span
                className="ui-btn ui-btn-primary mt-4 inline-flex min-w-[220px] cursor-not-allowed justify-center px-8 py-3 text-base font-semibold opacity-50"
                aria-disabled
              >
                Cek kelulusan
              </span>
            </motion.div>
          ) : null}
        </div>
      ) : null}

      {!isAdminPreview && result ? (
        <motion.div
          key="outcome"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className={`relative overflow-hidden rounded-2xl border px-5 py-6 sm:px-6 ${
            result.kelulusan === "LULUS"
              ? "border-emerald-200 bg-emerald-50/50 dark:border-emerald-800/80 dark:bg-emerald-950/25"
              : "border-slate-200 bg-slate-50 dark:border-slate-600 dark:bg-slate-900/70"
          }`}
        >
          {result.kelulusan === "TIDAK LULUS" ? (
            <motion.div
              aria-hidden
              className="pointer-events-none absolute inset-0 z-0"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
            >
              {[...Array(12)].map((_, i) => (
                <motion.span
                  key={i}
                  className="absolute rounded-full bg-slate-400/40 dark:bg-slate-500/30"
                  style={{
                    width: 6 + (i % 4) * 4,
                    height: 6 + (i % 4) * 4,
                    left: `${(i * 7.5) % 100}%`,
                    top: "-10%",
                  }}
                  animate={{
                    y: ["0vh", "120vh"],
                    opacity: [0.15, 0.45, 0],
                    x: [0, (i % 2 === 0 ? 1 : -1) * 18],
                  }}
                  transition={{
                    duration: 2.4 + (i % 5) * 0.25,
                    repeat: Infinity,
                    delay: i * 0.12,
                    ease: "linear",
                  }}
                />
              ))}
            </motion.div>
          ) : null}

          <motion.div
            animate={
              result.kelulusan === "TIDAK LULUS"
                ? { x: [0, -7, 7, -5, 5, 0] }
                : { x: 0 }
            }
            transition={
              result.kelulusan === "TIDAK LULUS"
                ? { duration: 0.55, ease: "easeInOut" }
                : undefined
            }
            className="relative z-10 space-y-4 text-center sm:text-left"
          >
            <div>
              <h2 className="text-xl font-bold tracking-tight text-black dark:text-white">
                {result.kelulusan === "LULUS" ? "Selamat, Anda dinyatakan lulus" : "Anda dinyatakan belum lulus"}
              </h2>
              <p className="mt-2 text-sm text-black dark:text-slate-100">
                Nilai rata-rata ijazah (tampilan):{" "}
                <span className="font-mono font-semibold text-black dark:text-white">
                  {result.rataRataDisplay}
                </span>
              </p>
            </div>

            {result.kelulusan === "LULUS" ? (
              <p className="text-pretty text-sm text-black dark:text-slate-100">
                Silakan buka menu{" "}
                <strong className="font-semibold text-black dark:text-white">Rekap Nilai Ijazah</strong> untuk melihat
                rincian nilai ijazah per mata pelajaran.
              </p>
            ) : (
              <p className="text-pretty text-sm text-black dark:text-slate-100">
                Anda tetap dapat melihat rincian nilai di rekap ijazah untuk mengetahui komposisi nilai Anda.
              </p>
            )}

            <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
              <Link
                href="/dashboard/rekap-nilai-ijazah"
                className="ui-btn ui-btn-primary inline-flex justify-center text-center"
              >
                Buka Rekap Nilai Ijazah
              </Link>
            </div>
          </motion.div>
        </motion.div>
      ) : null}
    </div>
  );
}
