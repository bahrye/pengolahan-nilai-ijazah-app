"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { useToast } from "@/components/ToastProvider";
import { downloadExamNilaiHtml, downloadExamNilaiPdf } from "@/lib/exam-nilai-export";
import { EXAM_NILAI_TEACHER_PRINT_BLOCKED_MSG } from "@/lib/exam-nilai-print-messages";
import {
  getExamNilaiPrintPreviewAction,
  getExamNilaiPrintPreviewTeacherAction,
  listExamNilaiRuangOptionsAction,
  listExamNilaiRuangOptionsTeacherAction,
  type ExamNilaiPrintPreview,
  type ExamNilaiRuangOption,
} from "@/server/actions/exam-nilai-print";

import { ExamNilaiPreview } from "./ExamNilaiPreview";

type MapelOpt = { id: string; code: string; name: string };

function readClientDisplayTimeZone(): string | undefined {
  if (typeof Intl === "undefined" || typeof Intl.DateTimeFormat !== "function") return undefined;
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch {
    return undefined;
  }
}

function exportFilenameBase(data: ExamNilaiPrintPreview): string {
  const ruang = data.ruangUjianLabel.replace(/[^\w.-]+/g, "_").slice(0, 40);
  const kelas = data.kelasLabel.replace(/[^\w.-]+/g, "_").slice(0, 32);
  return `Nilai-Ujian_${data.subjectCode}_${kelas}_${ruang}`;
}

export type CetakNilaiClientProps = {
  classRooms: { id: string; name: string }[];
  subjects: MapelOpt[];
  subjectIdsByClassRoomId: Record<string, string[]>;
  /** Guru: mapel & ruang dibatasi penugasan; pratinjau hanya jika nilai ujian sudah dikirim. */
  variant?: "admin" | "teacher";
  lockedSubjectIds?: string[];
  isHomeroomTeacher?: boolean;
};

export function CetakNilaiClient(props: CetakNilaiClientProps) {
  const variant = props.variant ?? "admin";
  const { toast } = useToast();

  const showClassPicker = props.classRooms.length > 1;
  const onlyClassRoomId = props.classRooms.length === 1 ? (props.classRooms[0]?.id ?? "") : "";
  const [classRoomPick, setClassRoomPick] = useState("");

  const classRoomId = showClassPicker
    ? classRoomPick && props.classRooms.some((c) => c.id === classRoomPick)
      ? classRoomPick
      : ""
    : onlyClassRoomId;

  const [subjectId, setSubjectId] = useState("");
  const [roomKey, setRoomKey] = useState("");
  const [roomOpts, setRoomOpts] = useState<ExamNilaiRuangOption[]>([]);
  const [roomsLoading, setRoomsLoading] = useState(false);
  /** Guru: null = belum tahu; true/false setelah muat ruang. */
  const [nilaiSudahDikirim, setNilaiSudahDikirim] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const [pdfBusy, setPdfBusy] = useState(false);
  const [preview, setPreview] = useState<ExamNilaiPrintPreview | null>(null);

  const subjectsForClass = useMemo(() => {
    if (!classRoomId) return [];
    const allowed = new Set(props.subjectIdsByClassRoomId[classRoomId] ?? []);
    return props.subjects.filter((s) => allowed.has(s.id));
  }, [classRoomId, props.subjectIdsByClassRoomId, props.subjects]);

  useEffect(() => {
    if (!classRoomId || !subjectId) {
      setRoomOpts([]);
      setRoomKey("");
      setNilaiSudahDikirim(null);
      return;
    }
    let cancelled = false;
    setRoomsLoading(true);
    setRoomKey("");
    setPreview(null);
    setNilaiSudahDikirim(null);

    const payload = { subjectId, classRoomId };

    if (variant === "teacher") {
      void listExamNilaiRuangOptionsTeacherAction(payload).then((res) => {
        if (cancelled) return;
        setRoomsLoading(false);
        if (!res.ok) {
          toast(res.message, "error");
          setRoomOpts([]);
          setNilaiSudahDikirim(false);
          return;
        }
        setRoomOpts(res.options);
        setNilaiSudahDikirim(res.nilaiSudahDikirim);
      });
    } else {
      void listExamNilaiRuangOptionsAction(payload).then((res) => {
        if (cancelled) return;
        setRoomsLoading(false);
        if (!res.ok) {
          toast(res.message, "error");
          setRoomOpts([]);
          return;
        }
        setRoomOpts(res.options);
        setNilaiSudahDikirim(null);
      });
    }
    return () => {
      cancelled = true;
    };
  }, [classRoomId, subjectId, toast, variant]);

  const runPreview = useCallback(async () => {
    if (showClassPicker && !classRoomId) {
      toast("Pilih kelas terlebih dahulu.", "error");
      return;
    }
    if (!classRoomId) {
      toast("Kelas tidak tersedia.", "error");
      return;
    }
    if (!subjectId) {
      toast("Pilih mata pelajaran terlebih dahulu.", "error");
      return;
    }
    if (!roomKey) {
      toast("Pilih ruang ujian terlebih dahulu.", "error");
      return;
    }
    if (variant === "teacher" && nilaiSudahDikirim !== true) {
      toast(EXAM_NILAI_TEACHER_PRINT_BLOCKED_MSG, "error");
      return;
    }
    setBusy(true);
    setPreview(null);
    const displayTimeZone = readClientDisplayTimeZone();
    const payload = { subjectId, classRoomId, ruangKey: roomKey, displayTimeZone };
    const res =
      variant === "teacher"
        ? await getExamNilaiPrintPreviewTeacherAction(payload)
        : await getExamNilaiPrintPreviewAction(payload);
    setBusy(false);
    if (!res.ok) {
      toast(res.message, "error");
      return;
    }
    setPreview(res.data);
    toast("Pratinjau siap.", "success");
  }, [
    classRoomId,
    subjectId,
    roomKey,
    toast,
    variant,
    nilaiSudahDikirim,
    showClassPicker,
  ]);

  const onDownloadHtml = useCallback(() => {
    if (!preview) return;
    downloadExamNilaiHtml(preview, exportFilenameBase(preview));
    toast("Unduhan HTML dimulai.", "success");
  }, [preview, toast]);

  const onDownloadPdf = useCallback(async () => {
    if (!preview) return;
    setPdfBusy(true);
    try {
      await downloadExamNilaiPdf(preview, exportFilenameBase(preview));
      toast("Unduhan PDF selesai.", "success");
    } catch (e) {
      toast((e as Error).message || "Gagal membuat PDF.", "error");
    } finally {
      setPdfBusy(false);
    }
  }, [preview, toast]);

  const teacherGateOk = variant !== "teacher" || nilaiSudahDikirim === true;
  const canPreview = Boolean(
    classRoomId &&
      subjectId &&
      roomKey &&
      !busy &&
      !roomsLoading &&
      teacherGateOk,
  );
  const paperHint = preview
    ? preview.paperSize === "LEGAL"
      ? "Pratinjau memakai ukuran kertas Legal (satu halaman)."
      : "Pratinjau memakai ukuran kertas A4 (satu halaman)."
    : null;

  const showTeacherBlocked =
    variant === "teacher" && Boolean(subjectId) && Boolean(classRoomId) && !roomsLoading && nilaiSudahDikirim === false;

  const subjectSelectDisabled = !classRoomId || subjectsForClass.length === 0;

  return (
    <div className="space-y-8">
      <div className="no-print max-w-3xl space-y-1">
        <h1 className="ui-page-title">Cetak nilai</h1>
        {variant === "teacher" ? (
          <p className="ui-muted text-pretty">
            {props.isHomeroomTeacher
              ? "Sebagai Wali Kelas, Anda dapat mencetak mapel di kelas Anda yang nilainya sudah dikirim (terkunci) oleh guru pengampu. Untuk mapel yang Anda ampu, Anda juga perlu mengirim nilainya melalui menu Input Nilai Ujian terlebih dahulu."
              : "Pilih kelas dan mapel yang Anda ampu, lalu ruang ujian. Pratinjau, cetak, dan unduh dokumen tersedia setelah nilai ujian mapel tersebut sudah dikirim (terkunci). Jika belum, kirim nilai melalui menu Input Nilai Ujian terlebih dahulu."}
          </p>
        ) : (
          <p className="ui-muted text-pretty">
            Pilih kelas, mapel, dan ruang ujian (khusus tahun ajaran aktif), lalu buka pratinjau. Ukuran kertas cetak
            menyesuaikan banyak siswa (A4 atau Legal). Unduhan HTML/PDF memakai kop surat dan tanggal dari menu
            Pengaturan Cetak Nilai.
          </p>
        )}
      </div>

      <section className="ui-card ui-card-tight no-print max-w-2xl space-y-4">
        <h2 className="text-base font-semibold tracking-tight">Filter</h2>
        {props.classRooms.length === 0 && variant === "teacher" ? (
          <p className="text-sm text-amber-800 dark:text-amber-200">
            Belum ada penugasan mengajar. Hubungi administrator sekolah untuk menambahkan penugasan mapel–kelas.
          </p>
        ) : null}
        {props.classRooms.length === 0 && variant === "admin" ? (
          <p className="text-sm text-amber-800 dark:text-amber-200">
            Belum ada kelas pada tahun ajaran aktif, atau belum ada penugasan mapel pada kelas tersebut.
          </p>
        ) : null}
        <div className={`grid gap-4 ${showClassPicker ? "sm:grid-cols-2 lg:grid-cols-3" : "sm:grid-cols-2"}`}>
          {showClassPicker ? (
            <label className="block space-y-1">
              <span className="text-sm font-medium">Kelas</span>
              <select
                className="ui-input w-full"
                value={classRoomPick}
                onChange={(e) => {
                  setClassRoomPick(e.target.value);
                  setSubjectId("");
                  setRoomKey("");
                  setPreview(null);
                }}
              >
                <option value="">— Pilih kelas —</option>
                {props.classRooms.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
          <label className="block space-y-1">
            <span className="text-sm font-medium">Mata pelajaran</span>
            <select
              className="ui-input w-full"
              disabled={subjectSelectDisabled}
              value={subjectId}
              onChange={(e) => {
                setSubjectId(e.target.value);
                setPreview(null);
              }}
            >
              <option value="">
                {!classRoomId && showClassPicker
                  ? "— Pilih kelas dulu —"
                  : !classRoomId
                    ? "— Pilih —"
                    : subjectsForClass.length === 0
                      ? "— Tidak ada mapel di kelas ini —"
                      : "— Pilih —"}
              </option>
              {subjectsForClass.map((s) => {
                const isSubmitted = props.lockedSubjectIds?.includes(s.id) ?? true;
                const isOptionDisabled = variant === "teacher" && !isSubmitted;
                return (
                  <option key={s.id} value={s.id} disabled={isOptionDisabled}>
                    {isOptionDisabled ? "🔒 " : ""}{s.name} ({s.code})
                  </option>
                );
              })}
            </select>
          </label>
          <label className="block space-y-1 sm:col-span-2 lg:col-span-1">
            <span className="text-sm font-medium">Ruang ujian</span>
            <select
              className="ui-input w-full"
              disabled={!subjectId || !classRoomId || roomsLoading}
              value={roomKey}
              onChange={(e) => {
                setRoomKey(e.target.value);
                setPreview(null);
              }}
            >
              <option value="">
                {roomsLoading ? "Memuat…" : subjectId && classRoomId ? "— Pilih —" : "Pilih mapel & kelas dulu"}
              </option>
              {roomOpts.map((o) => (
                <option key={o.key} value={o.key}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
        </div>
        {showTeacherBlocked ? (
          <div
            role="status"
            className="rounded-lg border border-amber-300/80 bg-amber-50 px-3 py-2.5 text-sm text-amber-950 dark:border-amber-600/60 dark:bg-amber-950/30 dark:text-amber-100"
          >
            {EXAM_NILAI_TEACHER_PRINT_BLOCKED_MSG}
          </div>
        ) : null}
        {subjectId &&
        classRoomId &&
        !roomsLoading &&
        roomOpts.length === 0 &&
        (variant === "admin" || nilaiSudahDikirim !== false) ? (
          <p className="text-sm text-amber-800 dark:text-amber-200">
            Belum ada siswa di kelas yang memiliki penugasan mapel ini, sehingga tidak ada pilihan ruang ujian.
          </p>
        ) : null}
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled={!canPreview}
            onClick={() => void runPreview()}
            className="ui-btn ui-btn-primary"
          >
            {busy ? "Memuat…" : "Pratinjau"}
          </button>
        </div>
      </section>

      {preview ? (
        <section className="space-y-3 rounded-2xl bg-slate-100/80 p-4 dark:bg-slate-900/50 print:bg-transparent print:p-0">
          <div className="no-print flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
            <div>
              <h2 className="text-base font-semibold tracking-tight text-slate-800 dark:text-slate-100">Pratinjau cetak</h2>
              {paperHint ? <p className="text-xs text-slate-600 dark:text-slate-400">{paperHint}</p> : null}
            </div>
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={() => window.print()} className="ui-btn ui-btn-ghost text-sm">
                Cetak (peramban)
              </button>
              <button type="button" onClick={onDownloadHtml} className="ui-btn ui-btn-ghost text-sm">
                Unduh HTML
              </button>
              <button
                type="button"
                disabled={pdfBusy}
                onClick={() => void onDownloadPdf()}
                className="ui-btn ui-btn-ghost text-sm"
              >
                {pdfBusy ? "PDF…" : "Unduh PDF"}
              </button>
            </div>
          </div>
          <ExamNilaiPreview data={preview} />
        </section>
      ) : null}
    </div>
  );
}
