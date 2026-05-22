"use client";

import { CheckCircle2, Minus, XCircle } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

import {
  studentClassLabel,
  uniqueClassLabelsSorted,
} from "@/lib/class-name-sort";
import {
  buildSubjectGroups,
  gradeValidationCellKey,
  type GradeValidationBoard,
  type GradeValidationStatus,
} from "@/lib/grade-validation-board";
import { ujianTertulisAspectHint } from "@/lib/school-terminology";
import { getGradeValidationBoardAction } from "@/server/actions/grade-validation";

import type { SchoolLevel } from "@prisma/client";

function ValidationIcon({ status }: { status: GradeValidationStatus }) {
  if (status === "filled") {
    return (
      <span
        className="inline-flex items-center justify-center"
        title="Nilai terisi"
      >
        <CheckCircle2
          className="size-5 text-emerald-600 dark:text-emerald-400"
          aria-hidden
        />
        <span className="sr-only">Terisi</span>
      </span>
    );
  }
  if (status === "ignored") {
    return (
      <span
        className="inline-flex items-center justify-center"
        title="Diabaikan — semester/mapel tidak dipakai, atau aspek lain sudah terisi (mode pengetahuan & keterampilan)"
      >
        <Minus
          className="size-5 text-amber-500 dark:text-amber-400"
          aria-hidden
        />
        <span className="sr-only">Diabaikan</span>
      </span>
    );
  }
  return (
    <span className="inline-flex items-center justify-center" title="Nilai kosong">
      <XCircle className="size-5 text-red-600 dark:text-red-400" aria-hidden />
      <span className="sr-only">Kosong</span>
    </span>
  );
}

const STICKY_SHADOW =
  "shadow-[5px_0_10px_-3px_rgba(15,23,42,0.14)] dark:shadow-[5px_0_10px_-3px_rgba(0,0,0,0.45)]";

const MAPEL_DIVIDER = "validation-mapel-divider";

const HEADER_BTN =
  "cursor-pointer rounded px-0.5 transition-colors hover:bg-indigo-100/80 dark:hover:bg-indigo-900/40";

type HeaderDetail =
  | { type: "subject"; code: string; name: string }
  | { type: "aspect"; short: string; full: string };

function aspectModeLabel(mode: GradeValidationBoard["raporAspectMode"]): string {
  if (mode === "PENGETAHUAN_ONLY") return "Pengetahuan";
  if (mode === "KETERAMPILAN_ONLY") return "Keterampilan";
  return "Pengetahuan & Keterampilan";
}

export function CekValidasiNilaiClient({
  homeroomOnly = false,
  schoolJenjang = null,
}: {
  /** Guru wali kelas: hanya siswa di kelas homeroom. */
  homeroomOnly?: boolean;
  schoolJenjang?: SchoolLevel | null;
}) {
  const [kind, setKind] = useState<"ujian" | "rapor">("ujian");
  const [semesterKey, setSemesterKey] = useState("");
  const [board, setBoard] = useState<GradeValidationBoard | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [headerDetail, setHeaderDetail] = useState<HeaderDetail | null>(null);
  const [selectedClass, setSelectedClass] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setMsg(null);
    try {
      const payload =
        kind === "rapor"
          ? { kind, ...(semesterKey ? { semesterKey } : {}) }
          : { kind };
      const res = await getGradeValidationBoardAction(payload);
      if (!res.ok) {
        setMsg(res.message);
        setBoard(null);
        return;
      }
      setBoard(res.board);
      if (
        kind === "rapor" &&
        res.board.semesterKey &&
        res.board.semesterKey !== semesterKey
      ) {
        setSemesterKey(res.board.semesterKey);
      }
    } catch (e) {
      setMsg(
        e instanceof Error
          ? e.message
          : "Gagal memuat validasi nilai. Periksa koneksi lalu muat ulang.",
      );
      setBoard(null);
    } finally {
      setLoading(false);
    }
  }, [kind, semesterKey]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    setHeaderDetail(null);
  }, [kind, semesterKey, board?.semesterKey]);

  /** Hanya kelas yang punya siswa di TA aktif (kelas kosong tidak ditampilkan). */
  const classOptions = useMemo(() => {
    if (!board) return [];
    return uniqueClassLabelsSorted(board.students);
  }, [board]);

  const classSelectLocked = classOptions.length <= 1;

  useEffect(() => {
    if (classOptions.length === 0) {
      setSelectedClass("");
      return;
    }
    setSelectedClass((prev) =>
      prev && classOptions.includes(prev) ? prev : classOptions[0]!,
    );
  }, [classOptions]);

  const activeClass =
    selectedClass && classOptions.includes(selectedClass)
      ? selectedClass
      : (classOptions[0] ?? "");

  const filteredStudents = useMemo(() => {
    if (!board || !activeClass) return [];
    return board.students.filter(
      (st) => studentClassLabel(st.classLabel) === activeClass,
    );
  }, [board, activeClass]);

  const summary = useMemo(() => {
    if (!board || filteredStudents.length === 0) return null;
    let filled = 0;
    let empty = 0;
    let ignored = 0;
    for (const st of filteredStudents) {
      const groups =
        board.subjectGroups?.length
          ? board.subjectGroups
          : buildSubjectGroups(board.kind, board.subjects);
      for (const group of groups) {
        for (const col of group.columns) {
          const key = gradeValidationCellKey(group.code, col.aspect);
          const s = board.cells[st.nisn]?.[key] ?? "empty";
          if (s === "filled") filled += 1;
          else if (s === "ignored") ignored += 1;
          else empty += 1;
        }
      }
    }
    return { filled, empty, ignored, total: filled + empty + ignored };
  }, [board, filteredStudents]);

  const subjectGroups = useMemo(() => {
    if (!board) return [];
    return board.subjectGroups?.length
      ? board.subjectGroups
      : buildSubjectGroups(board.kind, board.subjects);
  }, [board]);

  const hasAspectSubRow = subjectGroups.some((g) => g.columns.length > 0);

  const semesterOptions = board?.semesterOptions ?? [];

  return (
    <div className="space-y-8">
      <div className="max-w-3xl space-y-1">
        <h1 className="ui-page-title">Cek Validasi Nilai</h1>
        <p className="ui-muted text-pretty">
          Pantau kelengkapan input per siswa, mapel, dan aspek nilai (ujian: tertulis &amp;
          praktik; rapor: pengetahuan &amp; keterampilan). Hijau = terisi, merah = kosong, kuning
          = diabaikan.
        </p>
        {homeroomOnly ? (
          <p className="rounded-lg border border-indigo-200/90 bg-indigo-50/80 px-3 py-2 text-sm text-indigo-950 dark:border-indigo-500/35 dark:bg-indigo-950/40 dark:text-indigo-100">
            Tampilan ini hanya memuat siswa di kelas tempat Anda bertugas sebagai wali kelas,
            untuk memantau kelengkapan nilai dari semua guru mapel.
          </p>
        ) : null}
      </div>

      <section className="ui-card ui-card-tight space-y-4">
        <div className="flex flex-wrap items-end gap-4">
          <div className="space-y-1.5">
            <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
              Sumber nilai
            </p>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => {
                  setKind("ujian");
                  setSemesterKey("");
                }}
                className={`ui-btn ui-btn-sm ${kind === "ujian" ? "ui-btn-primary" : "ui-btn-ghost"}`}
              >
                Ujian
              </button>
              <button
                type="button"
                onClick={() => setKind("rapor")}
                className={`ui-btn ui-btn-sm ${kind === "rapor" ? "ui-btn-primary" : "ui-btn-ghost"}`}
              >
                Rapor
              </button>
            </div>
          </div>

          {kind === "rapor" ? (
            <label className="ui-label min-w-[14rem]">
              Semester
              <select
                value={semesterKey || board?.semesterKey || ""}
                onChange={(e) => setSemesterKey(e.target.value)}
                className="ui-select mt-1.5"
                disabled={loading || semesterOptions.length === 0}
              >
                {semesterOptions.length === 0 ? (
                  <option value="">Belum ada semester</option>
                ) : (
                  semesterOptions.map((o) => (
                    <option key={o.key} value={o.key}>
                      {o.label}
                    </option>
                  ))
                )}
              </select>
            </label>
          ) : null}

          <button
            type="button"
            disabled={loading}
            onClick={() => void load()}
            className="ui-btn ui-btn-ghost ui-btn-sm"
          >
            {loading ? "Memuat…" : "Muat ulang"}
          </button>
        </div>

        {kind === "rapor" && board ? (
          <p className="text-xs text-slate-600 dark:text-slate-400">
            Aspek rapor sekolah: <strong>{aspectModeLabel(board.raporAspectMode)}</strong>
            {" · "}
            Jumlah semester default: <strong>{board.defaultSemesterCount}</strong>{" "}
            (kolom Smt di Mapel dihitung otomatis dari semester yang punya nilai rapor).
          </p>
        ) : null}

        <div className="flex flex-wrap items-center gap-x-6 gap-y-2 rounded-xl border border-slate-200/90 bg-white/60 px-4 py-3 text-xs font-medium text-slate-600 dark:border-slate-700/80 dark:bg-slate-900/40 dark:text-slate-300">
          <span className="inline-flex items-center gap-2">
            <CheckCircle2 className="size-4 text-emerald-600" aria-hidden />
            Terisi
          </span>
          <span className="inline-flex items-center gap-2">
            <XCircle className="size-4 text-red-600" aria-hidden />
            Kosong
          </span>
          <span className="inline-flex items-center gap-2">
            <Minus className="size-4 text-amber-500" aria-hidden />
            Diabaikan
          </span>
          {summary ? (
            <span className="ml-auto tabular-nums text-slate-500 dark:text-slate-400">
              {summary.filled} terisi · {summary.empty} kosong
              {summary.ignored > 0 ? ` · ${summary.ignored} diabaikan` : ""}
              {summary.total > 0 ? ` · ${summary.total} sel` : ""}
            </span>
          ) : null}
        </div>
      </section>

      {msg ? (
        <div className="ui-alert ui-alert-error font-medium">{msg}</div>
      ) : null}

      {loading && !board ? (
        <p className="ui-muted text-sm">Memuat matriks validasi…</p>
      ) : null}

      {board && board.students.length > 0 && board.subjects.length > 0 ? (
        <section className="min-w-0 space-y-3">
          <h2 className="text-base font-semibold tracking-tight">
            {kind === "ujian" ? "Validasi nilai ujian" : "Validasi nilai rapor"}
          </h2>
          <p className="ui-muted text-xs">
            {kind === "ujian"
              ? ujianTertulisAspectHint(schoolJenjang)
              : "Kolom aspek: P = pengetahuan, K = keterampilan. Jika salah satu aspek sudah terisi, aspek lain yang kosong ditandai diabaikan (bukan silang merah)."}
            {" "}
            <span className="md:hidden">
              Geser tabel ke kanan untuk mapel. Hanya kolom Siswa yang menempel; NISN dan Kelas
              disembunyikan di layar kecil.
            </span>
          </p>

          {classOptions.length > 0 ? (
            <label className="ui-label block max-w-xs">
              Kelas
              <select
                value={activeClass}
                onChange={(e) => setSelectedClass(e.target.value)}
                className="ui-select mt-1.5"
                disabled={classSelectLocked || loading}
                aria-label="Pilih kelas untuk ditampilkan"
              >
                {classOptions.map((label) => (
                  <option key={label} value={label}>
                    {label}
                  </option>
                ))}
              </select>
              {classSelectLocked ? (
                <span className="mt-1 block text-[11px] text-slate-500 dark:text-slate-400">
                  Hanya satu kelas memiliki siswa di tahun ajaran aktif.
                </span>
              ) : (
                <span className="mt-1 block text-[11px] text-slate-500 dark:text-slate-400">
                  Pilih kelas yang akan ditampilkan (hanya kelas dengan siswa).
                </span>
              )}
            </label>
          ) : null}

          <div
            role="status"
            aria-live="polite"
            className="min-h-[2.75rem] rounded-xl border border-indigo-200/90 bg-indigo-50/90 px-3 py-2 text-sm text-indigo-950 dark:border-indigo-500/35 dark:bg-indigo-950/50 dark:text-indigo-100"
          >
            {headerDetail ? (
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <span className="text-[10px] font-bold uppercase tracking-wide text-indigo-600 dark:text-indigo-300">
                  {headerDetail.type === "subject" ? "Mapel" : "Aspek nilai"}
                </span>
                {headerDetail.type === "subject" ? (
                  <>
                    <span className="font-mono text-base font-bold">{headerDetail.code}</span>
                    <span className="text-indigo-400 dark:text-indigo-500">—</span>
                    <span className="font-medium">{headerDetail.name}</span>
                  </>
                ) : (
                  <>
                    <span className="text-base font-bold">{headerDetail.short}</span>
                    <span className="text-indigo-400 dark:text-indigo-500">—</span>
                    <span className="font-medium">{headerDetail.full}</span>
                  </>
                )}
                <button
                  type="button"
                  onClick={() => setHeaderDetail(null)}
                  className="ml-auto text-xs font-semibold text-indigo-700 underline-offset-2 hover:underline dark:text-indigo-300"
                >
                  Tutup
                </button>
              </div>
            ) : (
              <p className="text-xs text-indigo-800/85 dark:text-indigo-200/80">
                Ketuk <strong className="font-semibold">kode mapel</strong> atau label aspek{" "}
                <strong className="font-semibold">
                  {kind === "ujian" ? "(T / P)" : "(P / K)"}
                </strong>{" "}
                di header tabel untuk menampilkan nama lengkap di sini.
              </p>
            )}
          </div>

          {filteredStudents.length === 0 ? (
            <p className="ui-muted text-sm">Tidak ada siswa di kelas yang dipilih.</p>
          ) : (
          <div className="overflow-x-auto rounded-xl border border-slate-200/80 dark:border-slate-700/60">
            <table className="rekap-table grade-validation-table w-full min-w-max border-collapse text-left text-sm">
              <thead className="sticky top-0 z-10">
                <tr className="border-b border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-800">
                  <th
                    rowSpan={hasAspectSubRow ? 2 : 1}
                    className={`rekap-sticky-cell sticky left-0 z-[40] min-w-[10rem] max-w-[14rem] border-r border-slate-200 px-3 py-2.5 text-left font-semibold dark:border-slate-600 ${STICKY_SHADOW}`}
                  >
                    Siswa
                  </th>
                  <th
                    rowSpan={hasAspectSubRow ? 2 : 1}
                    className={`rekap-sticky-cell hidden min-w-[7.5rem] border-r border-slate-200 px-3 py-2.5 text-left font-semibold dark:border-slate-600 md:table-cell md:sticky md:left-[10rem] md:z-[25]`}
                  >
                    NISN
                  </th>
                  <th
                    rowSpan={hasAspectSubRow ? 2 : 1}
                    className={`rekap-sticky-cell hidden min-w-[5.5rem] border-r border-slate-200 px-3 py-2.5 text-left font-semibold dark:border-slate-600 md:table-cell md:sticky md:left-[17.5rem] md:z-[25] ${STICKY_SHADOW}`}
                  >
                    Kelas
                  </th>
                  {subjectGroups.map((group) => (
                    <th
                      key={group.code}
                      colSpan={group.columns.length}
                      className={`exam-subj-header validation-header-btn ${MAPEL_DIVIDER} bg-slate-50 px-2 py-2.5 text-center font-semibold dark:bg-slate-800`}
                    >
                      <button
                        type="button"
                        className={`${HEADER_BTN} border-b border-dashed border-indigo-400/80 font-mono dark:border-indigo-300/80`}
                        onClick={() =>
                          setHeaderDetail({
                            type: "subject",
                            code: group.code,
                            name: group.name,
                          })
                        }
                        aria-pressed={
                          headerDetail?.type === "subject" &&
                          headerDetail.code === group.code
                        }
                      >
                        {group.code}
                      </button>
                    </th>
                  ))}
                </tr>
                {hasAspectSubRow ? (
                  <tr className="border-b border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-800">
                    {subjectGroups.flatMap((group) =>
                      group.columns.map((col, colIdx) => (
                        <th
                          key={`${group.code}-${col.aspect}`}
                          className={`validation-header-btn bg-slate-50 px-1.5 py-2 text-center text-[10px] font-semibold uppercase tracking-wide text-slate-600 dark:bg-slate-800 dark:text-slate-300${
                            colIdx === 0 ? ` ${MAPEL_DIVIDER}` : ""
                          }`}
                        >
                          <button
                            type="button"
                            className={`${HEADER_BTN} border-b border-dotted border-slate-400 dark:border-slate-500`}
                            onClick={() =>
                              setHeaderDetail({
                                type: "aspect",
                                short: col.shortLabel,
                                full: col.fullLabel,
                              })
                            }
                            aria-pressed={
                              headerDetail?.type === "aspect" &&
                              headerDetail.short === col.shortLabel &&
                              headerDetail.full === col.fullLabel
                            }
                          >
                            {col.shortLabel}
                          </button>
                        </th>
                      )),
                    )}
                  </tr>
                ) : null}
              </thead>
              <tbody>
                {filteredStudents.map((st) => (
                  <tr
                    key={st.nisn}
                    className="border-b border-slate-100 dark:border-slate-800"
                  >
                    <td
                      className={`rekap-sticky-cell sticky left-0 z-[40] max-w-[14rem] truncate border-r border-slate-200 px-3 py-2 font-medium dark:border-slate-700 ${STICKY_SHADOW}`}
                    >
                      {st.name}
                    </td>
                    <td className="rekap-sticky-cell hidden border-r border-slate-200 px-3 py-2 font-mono text-[13px] dark:border-slate-700 md:table-cell md:sticky md:left-[10rem] md:z-[25]">
                      {st.nisn}
                    </td>
                    <td
                      className={`rekap-sticky-cell hidden whitespace-nowrap border-r border-slate-200 px-3 py-2 dark:border-slate-700 md:table-cell md:sticky md:left-[17.5rem] md:z-[25] ${STICKY_SHADOW}`}
                    >
                      {st.classLabel ?? "—"}
                    </td>
                    {subjectGroups.flatMap((group) =>
                      group.columns.map((col, colIdx) => {
                        const key = gradeValidationCellKey(group.code, col.aspect);
                        return (
                          <td
                            key={key}
                            className={`px-1.5 py-2 text-center${
                              colIdx === 0 ? ` ${MAPEL_DIVIDER}` : ""
                            }`}
                            title={`${group.name} — ${col.fullLabel}`}
                          >
                            <ValidationIcon
                              status={board.cells[st.nisn]?.[key] ?? "empty"}
                            />
                          </td>
                        );
                      }),
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          )}
        </section>
      ) : null}

      {board && !loading && board.students.length === 0 ? (
        <p className="ui-muted text-sm">
          Belum ada siswa aktif di tahun ajaran berjalan. Tambahkan siswa di menu Data Siswa.
        </p>
      ) : null}

      {board && !loading && board.subjects.length === 0 ? (
        <p className="ui-muted text-sm">Belum ada mapel. Tambahkan mapel di menu Mapel.</p>
      ) : null}
    </div>
  );
}
