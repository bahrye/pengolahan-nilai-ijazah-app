"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";

import {
  getExamScoreMatrixAction,
  saveExamScoresAction,
  getExamLocksAction,
  submitExamScoresAction,
  unsubmitExamScoresAction,
  type ScoreGrid,
} from "@/server/actions/grades";
import { useToast } from "@/components/ToastProvider";
import type { ExamInputPolicy, UserRole } from "@prisma/client";

import { resolveTeacherExamInputGate } from "@/lib/exam-input-gate";
import { isUjianTertulisJenis } from "@/lib/school-terminology";
import { formatKelulusanTanggalWaktuLokal } from "@/lib/format-kelulusan-wita";
import { ExamImportModal, type ImportedExamData } from "./ExamImportModal";

type Subj = {
  id: string;
  kode: string;
  nama: string;
  jenisUjian: string;
};

type Student = { nisn: string; name: string; classRoomId?: string };

type Aspect = "tertulis" | "praktek" | "both";

function kindForSubject(j: string): "madrasah" | "praktek" | "both" {
  if (j === "Ujian Praktek") return "praktek";
  if (j === "Keduanya") return "both";
  return "madrasah";
}

function rowAvg(
  nisn: string,
  kode: string,
  madrasah: Record<string, Record<string, string>>,
  praktek: Record<string, Record<string, string>>,
): string {
  const t = madrasah[nisn]?.[kode] ?? "";
  const p = praktek[nisn]?.[kode] ?? "";
  const nT = Number(t);
  const nP = Number(p);
  if (t.trim() !== "" && p.trim() !== "" && Number.isFinite(nT + nP)) {
    return ((nT + nP) / 2).toFixed(2);
  }
  if (t.trim() !== "" && Number.isFinite(nT)) return nT.toFixed(2);
  if (p.trim() !== "" && Number.isFinite(nP)) return nP.toFixed(2);
  return "";
}

function clampScore(val: string): string {
  if (val === "") return "";
  const n = Number(val);
  if (Number.isNaN(n)) return val;
  if (n > 100) return "100";
  if (n < 0) return "0";
  return val;
}

function SubjectTooltip({
  kode,
  nama,
  colSpan,
  locked,
}: {
  kode: string;
  nama: string;
  colSpan: number;
  locked?: boolean;
}) {
  const [show, setShow] = useState(false);
  const ref = useRef<HTMLTableCellElement>(null);

  useEffect(() => {
    if (!show) return undefined;
    function handleOutside(e: MouseEvent | TouchEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setShow(false);
    }
    document.addEventListener("pointerdown", handleOutside);
    return () => document.removeEventListener("pointerdown", handleOutside);
  }, [show]);

  return (
    <th
      ref={ref}
      colSpan={colSpan}
      className="exam-subj-header relative cursor-pointer !text-center"
      onMouseEnter={() => setShow(true)}
      onMouseLeave={() => setShow(false)}
      onClick={() => setShow((p) => !p)}
    >
      <span className="border-b border-dashed border-indigo-400 dark:border-indigo-300">{kode}</span>
      {locked && <span className="ml-0.5 text-[10px] text-amber-500" title="Terkunci">&#128274;</span>}
      {show && (
        <span className="absolute left-1/2 z-50 mt-1 -translate-x-1/2 whitespace-nowrap rounded-lg bg-slate-800 px-3 py-1.5 text-[11px] font-medium normal-case tracking-normal text-white shadow-lg dark:bg-slate-600" style={{ top: "calc(100% + 1.6rem)" }}>
          {nama}{locked ? " (Terkunci)" : ""}
          <span className="absolute -top-1 left-1/2 -translate-x-1/2 border-4 border-transparent border-b-slate-800 dark:border-b-slate-600" />
        </span>
      )}
    </th>
  );
}

function TPTooltip({ label, fullName, className }: { label: string; fullName: string; className?: string }) {
  const [show, setShow] = useState(false);
  const ref = useRef<HTMLTableCellElement>(null);

  useEffect(() => {
    if (!show) return undefined;
    function handleOutside(e: MouseEvent | TouchEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setShow(false);
    }
    document.addEventListener("pointerdown", handleOutside);
    return () => document.removeEventListener("pointerdown", handleOutside);
  }, [show]);

  return (
    <th
      ref={ref}
      className={`relative cursor-pointer !text-center text-[10px] font-semibold${className ? ` ${className}` : ""}`}
      onMouseEnter={() => setShow(true)}
      onMouseLeave={() => setShow(false)}
      onClick={() => setShow((p) => !p)}
    >
      <span className="border-b border-dotted border-slate-400 dark:border-slate-500">{label}</span>
      {show && (
        <span className="absolute left-1/2 top-full z-50 mt-1 -translate-x-1/2 whitespace-nowrap rounded-lg bg-slate-700 px-2.5 py-1 text-[10px] font-medium normal-case tracking-normal text-white shadow-lg dark:bg-slate-600">
          {fullName}
          <span className="absolute -top-1 left-1/2 -translate-x-1/2 border-4 border-transparent border-b-slate-700 dark:border-b-slate-600" />
        </span>
      )}
    </th>
  );
}

/** Resolve effective column display based on subject kind + chosen aspect. */
function effectiveKind(
  subjectKind: "madrasah" | "praktek" | "both",
  aspect: Aspect,
): "madrasah" | "praktek" | "both" | "hidden" {
  if (subjectKind === "both") {
    if (aspect === "tertulis") return "madrasah";
    if (aspect === "praktek") return "praktek";
    return "both";
  }
  if (aspect === "tertulis" && subjectKind === "praktek") return "hidden";
  if (aspect === "praktek" && subjectKind === "madrasah") return "hidden";
  return subjectKind;
}

function getPredikat(val: string, kkm: number): { label: string; color: string } | null {
  if (!val || val.trim() === "") return null;
  const n = Number(val);
  if (!Number.isFinite(n) || n < 0) return null;
  const range = 100 - kkm;
  if (n >= kkm + (range * 2) / 3) return { label: "A", color: "text-emerald-600 dark:text-emerald-400" };
  if (n >= kkm + range / 3) return { label: "B", color: "text-blue-600 dark:text-blue-400" };
  if (n >= kkm) return { label: "C", color: "text-amber-600 dark:text-amber-400" };
  return { label: "D", color: "text-red-600 dark:text-red-400" };
}

const EXAM_SHOW_GRADE_KEY = "sij:exam-tampilkan-grade";

export function UnifiedExamScores({
  tenantSchoolId,
  students,
  subjects,
  classRooms = [],
  kkm = 75,
  examInput = { policy: "OPEN", windowStartIso: null, windowEndIso: null },
  userRole,
}: {
  tenantSchoolId: string;
  students: Student[];
  subjects: Subj[];
  classRooms?: { id: string; name: string }[];
  kkm?: number;
  examInput?: {
    policy: ExamInputPolicy;
    windowStartIso: string | null;
    windowEndIso: string | null;
  };
  userRole: UserRole;
}) {
  const cols = useMemo(
    () =>
      subjects.map((s) => ({
        ...s,
        kind: kindForSubject(s.jenisUjian),
      })),
    [subjects],
  );

  const [aspect, setAspect] = useState<Aspect>("both");
  const [showGrade, setShowGrade] = useState(true);
  const [selectedClass, setSelectedClass] = useState<string>(
    classRooms.length > 1 ? "" : "__all__",
  );
  const filteredStudents = useMemo(
    () =>
      selectedClass === "__all__"
        ? students
        : students.filter((s) => s.classRoomId === selectedClass),
    [students, selectedClass],
  );
  const [madrasah, setMadrasah] = useState<
    Record<string, Record<string, string>>
  >({});
  const [praktek, setPraktek] = useState<
    Record<string, Record<string, string>>
  >({});
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [showImport, setShowImport] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [showSubmitModal, setShowSubmitModal] = useState(false);
  const [showUnsubmitModal, setShowUnsubmitModal] = useState(false);
  const [lockedCodes, setLockedCodes] = useState<Set<string>>(new Set());
  const savedSnapM = useRef<string>("");
  const savedSnapP = useRef<string>("");
  const [saveGen, setSaveGen] = useState(0);
  const { toast } = useToast();

  const loadLocks = useCallback(async () => {
    const locks = await getExamLocksAction();
    setLockedCodes(new Set(locks.map((l) => l.code)));
  }, []);

  const fetchGenRef = useRef(0);

  const dirty = useMemo(() => {
    if (!savedSnapM.current && !savedSnapP.current) return false;
    return (
      JSON.stringify(madrasah) !== savedSnapM.current ||
      JSON.stringify(praktek) !== savedSnapP.current
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [madrasah, praktek, saveGen]);

  const visibleCols = useMemo(
    () =>
      cols
        .map((c) => ({ ...c, eff: effectiveKind(c.kind, aspect) }))
        .filter((c) => c.eff !== "hidden"),
    [cols, aspect],
  );

  const needsSubRow = visibleCols.some((c) => c.eff === "both");

  const [gateTick, setGateTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setGateTick((x) => x + 1), 20000);
    return () => clearInterval(id);
  }, []);

  const inputPolicyGate = useMemo(() => {
    void gateTick;
    return resolveTeacherExamInputGate({
      policy: examInput.policy,
      windowStart: examInput.windowStartIso ? new Date(examInput.windowStartIso) : null,
      windowEnd: examInput.windowEndIso ? new Date(examInput.windowEndIso) : null,
      now: new Date(),
      restrictAsTeacher: userRole === "GURU",
    });
  }, [
    examInput.policy,
    examInput.windowStartIso,
    examInput.windowEndIso,
    userRole,
    gateTick,
  ]);

  const guruExamLocked = inputPolicyGate.locked;

  /** Server mengembalikan kunci untuk seluruh mapel sekolah; counter & UI mengikuti mapel di halaman ini saja (penting untuk akun guru). */
  const lockedVisibleCount = useMemo(
    () => subjects.reduce((n, s) => n + (lockedCodes.has(s.kode) ? 1 : 0), 0),
    [subjects, lockedCodes],
  );
  const subjectCountOnPage = subjects.length;
  const allExamSubjectsSubmitted =
    subjectCountOnPage > 0 && lockedVisibleCount === subjectCountOnPage;

  useLayoutEffect(() => {
    try {
      setShowGrade(window.localStorage.getItem(EXAM_SHOW_GRADE_KEY) !== "0");
    } catch {
      /* ignore */
    }
  }, []);

  const onShowGradeChange = useCallback((checked: boolean) => {
    setShowGrade(checked);
    try {
      window.localStorage.setItem(EXAM_SHOW_GRADE_KEY, checked ? "1" : "0");
    } catch {
      /* ignore */
    }
  }, []);

  const loadGrids = useCallback(async () => {
    const gen = ++fetchGenRef.current;
    setBusy(true);
    setMsg(null);
    try {
      const [m, p, locks] = await Promise.all([
        getExamScoreMatrixAction("madrasah"),
        getExamScoreMatrixAction("praktek"),
        getExamLocksAction(),
      ]);
      if (gen !== fetchGenRef.current) return;

      const textify = (
        grid: ScoreGrid,
      ): Record<string, Record<string, string>> => {
        const o: Record<string, Record<string, string>> = {};
        for (const [nisn, row] of Object.entries(grid)) {
          o[nisn] = {};
          for (const [code, val] of Object.entries(row ?? {}))
            o[nisn][code] =
              val === null || val === undefined ? "" : String(val);
        }
        return o;
      };
      const mText = textify(m);
      const pText = textify(p);
      setLockedCodes(new Set(locks.map((l) => l.code)));
      setMadrasah(mText);
      setPraktek(pText);
      savedSnapM.current = JSON.stringify(mText);
      savedSnapP.current = JSON.stringify(pText);
    } catch (err) {
      if (gen === fetchGenRef.current) {
        console.error(err);
        setMsg((err as Error).message ?? "Gagal memuat grid nilai.");
      }
    } finally {
      if (gen === fetchGenRef.current) {
        setBusy(false);
      }
    }
  }, []);

  const gridSyncKey = useMemo(() => {
    const nisnKey = students
      .map((s) => s.nisn)
      .slice()
      .sort()
      .join("\u0001");
    const subjKey = subjects
      .map((s) => s.id)
      .slice()
      .sort()
      .join("\u0001");
    return `${tenantSchoolId}\u0001${kkm}\u0001${nisnKey}\u0001${subjKey}`;
  }, [tenantSchoolId, kkm, students, subjects]);

  const classRoomIdsKey = useMemo(
    () =>
      classRooms
        .map((c) => c.id)
        .slice()
        .sort()
        .join("\u0001"),
    [classRooms],
  );

  useEffect(() => {
    setSelectedClass(classRooms.length > 1 ? "" : "__all__");
  }, [tenantSchoolId, classRoomIdsKey, classRooms.length]);

  useEffect(() => {
    void loadGrids();
  }, [gridSyncKey, loadGrids]);

  async function onSave() {
    const gridify = (
      g: Record<string, Record<string, string>>,
    ): ScoreGrid => {
      const grid: ScoreGrid = {};
      for (const [nisn, row] of Object.entries(g)) {
        grid[nisn] = {};
        for (const [code, raw] of Object.entries(row ?? {})) {
          const v = raw.trim();
          grid[nisn][code] = v === "" ? null : Number(v);
        }
      }
      return grid;
    };

    setBusy(true);
    setMsg(null);

    const rM = await saveExamScoresAction("madrasah", gridify(madrasah));
    if (!rM.ok) { setMsg(rM.message); toast(rM.message, "error"); setBusy(false); return; }
    const rP = await saveExamScoresAction("praktek", gridify(praktek));
    if (!rP.ok) { setMsg(rP.message); toast(rP.message, "error"); setBusy(false); return; }

    savedSnapM.current = JSON.stringify(madrasah);
    savedSnapP.current = JSON.stringify(praktek);
    setSaveGen((g) => g + 1);
    setMsg(null);
    toast("Nilai ujian berhasil disimpan.", "success");
    setBusy(false);
  }

  const madrasahRef = useRef(madrasah);
  madrasahRef.current = madrasah;
  const praktekRef = useRef(praktek);
  praktekRef.current = praktek;

  const handleImport = useCallback(
    (data: ImportedExamData) => {
      const mergeGrid = (
        cur: Record<string, Record<string, string>>,
        imp: Record<string, Record<string, number>>,
      ): Record<string, Record<string, string>> => {
        const merged = { ...cur };
        for (const [nisn, scores] of Object.entries(imp)) {
          if (!merged[nisn]) continue;
          merged[nisn] = { ...merged[nisn] };
          for (const [code, val] of Object.entries(scores)) {
            if (code in merged[nisn]) merged[nisn][code] = String(val);
          }
        }
        return merged;
      };

      if (Object.keys(data.tertulis).length > 0) {
        setMadrasah(mergeGrid(madrasahRef.current, data.tertulis));
      }
      if (Object.keys(data.praktek).length > 0) {
        setPraktek(mergeGrid(praktekRef.current, data.praktek));
      }
      setShowImport(false);
      setMsg("Nilai berhasil diimport dari Excel. Periksa dan klik Simpan.");
    },
    [],
  );

  async function downloadTemplate() {
    const ExcelJS = (await import("exceljs")).default;
    const wb = new ExcelJS.Workbook();
    const target = filteredStudents.length ? filteredStudents : students;

    const tertulisSubjects = subjects.filter(
      (s) => isUjianTertulisJenis(s.jenisUjian) || s.jenisUjian === "Keduanya",
    );
    const praktikSubjects = subjects.filter(
      (s) => s.jenisUjian === "Ujian Praktek" || s.jenisUjian === "Keduanya",
    );

    for (const [sheetName, sheetSubjects] of [
      ["Tertulis", tertulisSubjects],
      ["Praktik", praktikSubjects],
    ] as const) {
      if (sheetSubjects.length === 0) continue;
      const ws = wb.addWorksheet(sheetName);
      ws.columns = [
        { header: "NISN", key: "nisn", width: 15 },
        { header: "Nama", key: "nama", width: 30 },
        ...sheetSubjects.map((s) => ({ header: s.kode, key: s.kode, width: 10 })),
      ];
      ws.getRow(1).font = { bold: true };
      for (const s of target) ws.addRow({ nisn: s.nisn, nama: s.name });
    }

    const meta = wb.addWorksheet("_metadata");
    meta.getCell("A1").value = "type";
    meta.getCell("B1").value = "exam";
    meta.state = "veryHidden";

    const buffer = await wb.xlsx.writeBuffer();
    const blob = new Blob([buffer], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "template-ujian.xlsx";
    a.click();
    URL.revokeObjectURL(url);
  }

  async function exportData() {
    const ExcelJS = (await import("exceljs")).default;
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet("Export Nilai");

    const target = selectedClass === "__all__" ? students : filteredStudents;

    const columns: any[] = [
      { header: "NISN", key: "nisn", width: 15 },
      { header: "Nama", key: "nama", width: 30 },
    ];

    cols.forEach((c) => {
      if (c.kind === "both" || c.kind === "madrasah") {
        columns.push({ header: `${c.kode} (Tertulis)`, key: `${c.kode}_T`, width: 15 });
      }
      if (c.kind === "both" || c.kind === "praktek") {
        columns.push({ header: `${c.kode} (Praktik)`, key: `${c.kode}_P`, width: 15 });
      }
      if (c.kind === "both") {
        columns.push({ header: `${c.kode} (Rata-rata)`, key: `${c.kode}_R`, width: 15 });
      }
    });

    ws.columns = columns;
    ws.getRow(1).font = { bold: true };

    for (const s of target) {
      const rowData: any = { nisn: s.nisn, nama: s.name };
      cols.forEach((c) => {
        const t = madrasah[s.nisn]?.[c.kode] ?? "";
        const p = praktek[s.nisn]?.[c.kode] ?? "";
        if (c.kind === "both" || c.kind === "madrasah") {
          rowData[`${c.kode}_T`] = t;
        }
        if (c.kind === "both" || c.kind === "praktek") {
          rowData[`${c.kode}_P`] = p;
        }
        if (c.kind === "both") {
          rowData[`${c.kode}_R`] = rowAvg(s.nisn, c.kode, madrasah, praktek);
        }
      });
      ws.addRow(rowData);
    }

    const buffer = await wb.xlsx.writeBuffer();
    const blob = new Blob([buffer], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `export-nilai-ujian${selectedClass && selectedClass !== "__all__" ? "-" + (classRooms.find(c => c.id === selectedClass)?.name || "") : ""}.xlsx`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <section className="ui-card space-y-5">
      <div className="max-w-3xl space-y-2">
        <h2 className="ui-page-title text-[clamp(1.35rem,2.5vw,1.85rem)]">
          Nilai ujian tertulis &amp; praktik
        </h2>
        <p className="ui-muted text-pretty leading-relaxed">
          Isi nilai per mapel. Aspek hanya mengatur tampilan — semua nilai
          (Tertulis &amp; Praktik) tetap tersimpan. Tap kode mapel untuk
          melihat nama lengkap.
        </p>
      </div>

      {userRole === "GURU" && inputPolicyGate.banner ? (
        <div
          className={
            inputPolicyGate.banner.kind === "policy_locked"
              ? "ui-alert ui-alert-error font-medium"
              : inputPolicyGate.banner.kind === "after_window"
                ? "ui-alert border-amber-200 bg-amber-50 text-amber-950 dark:border-amber-800 dark:bg-amber-950/35 dark:text-amber-50"
                : inputPolicyGate.banner.kind === "before_window"
                  ? "ui-alert border-slate-200 bg-slate-50 text-slate-900 dark:border-slate-600 dark:bg-slate-900/50 dark:text-slate-100"
                  : "ui-alert border-emerald-200 bg-emerald-50/90 text-slate-900 dark:border-emerald-800 dark:bg-emerald-950/30 dark:text-slate-100"
          }
        >
          {inputPolicyGate.banner.kind === "policy_locked" ? (
            <span>Input dan Kirim Nilai Terkunci</span>
          ) : null}
          {inputPolicyGate.banner.kind === "before_window" ? (
            <p className="text-pretty">
              Input dan Kirim nilai akan dibuka tanggal{" "}
              <span className="font-semibold text-emerald-700 dark:text-emerald-300">
                {formatKelulusanTanggalWaktuLokal(inputPolicyGate.banner.opensAtIso)}
              </span>
              .
            </p>
          ) : null}
          {inputPolicyGate.banner.kind === "in_window" ? (
            <p className="text-pretty">
              Input dan Kirim nilai akan ditutup tanggal{" "}
              <span className="font-semibold text-red-700 dark:text-red-300">
                {formatKelulusanTanggalWaktuLokal(inputPolicyGate.banner.closesAtIso)}
              </span>
              .
            </p>
          ) : null}
          {inputPolicyGate.banner.kind === "after_window" ? (
            <span className="font-semibold">Masa input dan kirim nilai telah berakhir.</span>
          ) : null}
        </div>
      ) : null}

      <div className="flex flex-wrap items-end gap-4 text-[13px]">
        {classRooms.length > 1 && (
          <label className="ui-label min-w-[10rem]">
            Kelas
            <select
              value={selectedClass}
              onChange={(e) => setSelectedClass(e.target.value)}
              className="ui-select mt-1.5"
            >
              <option value="">— Pilih Kelas —</option>
              <option value="__all__">Semua kelas</option>
              {classRooms.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </label>
        )}
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={() => void loadGrids()}
            className="ui-btn ui-btn-ghost"
          >
            Muat ulang grid
          </button>
          <button
            type="button"
            disabled={busy || guruExamLocked}
            onClick={() => setShowImport(true)}
            className="ui-btn ui-btn-ghost"
          >
            📥 Import dari Excel
          </button>
          <button
            type="button"
            disabled={busy || guruExamLocked}
            onClick={() => void downloadTemplate()}
            className="ui-btn ui-btn-ghost"
          >
            📄 Download Template
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => void exportData()}
            className="ui-btn ui-btn-ghost text-indigo-600 dark:text-indigo-400"
          >
            📤 Eksport Data
          </button>
          <button
            type="button"
            disabled={busy || guruExamLocked}
            onClick={() => setShowClearConfirm(true)}
            className="ui-btn ui-btn-ghost text-red-600 dark:text-red-400"
          >
            🗑 Bersihkan Nilai
          </button>
        </div>

        <div className="w-full rounded-2xl border border-slate-200/90 bg-slate-50/80 px-4 py-3 dark:border-slate-600 dark:bg-slate-900/40">
          <div className="flex flex-wrap items-center gap-2 text-[13px] font-medium text-slate-700 dark:text-slate-200">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 20 20"
              fill="currentColor"
              className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400"
              aria-hidden
            >
              <path
                fillRule="evenodd"
                d="M10 1a4.5 4.5 0 00-4.5 4.5V9H5a2 2 0 00-2 2v6a2 2 0 002 2h10a2 2 0 002-2v-6a2 2 0 00-2-2h-.5V5.5A4.5 4.5 0 0010 1zm3 8V5.5a3 3 0 10-6 0V9h6z"
                clipRule="evenodd"
              />
            </svg>
            <span>
              Mapel yang telah dikirim ={" "}
              <strong className="tabular-nums text-slate-900 dark:text-white">
                {lockedVisibleCount}/{subjectCountOnPage}
              </strong>
            </span>
          </div>
          {lockedVisibleCount > 0 ? (
            <p className="mt-2 text-[12px] leading-relaxed text-slate-600 dark:text-slate-400">
              Nilai pada mapel yang sudah dikirim tidak bisa diubah sampai Anda menekan{" "}
              <span className="font-semibold text-slate-700 dark:text-slate-300">Batal Kirim</span>{" "}
              untuk mapel tersebut. Mapel yang belum dikirim tetap bisa diedit dan disimpan seperti biasa.
            </p>
          ) : (
            <p className="mt-2 text-[12px] leading-relaxed text-slate-600 dark:text-slate-400">
              Setelah nilai dirasa benar, kirim per mapel untuk mengunci kolomnya agar tidak teredit lagi.
              Simpan ke database tetap menggunakan tombol{" "}
              <span className="font-semibold text-slate-700 dark:text-slate-300">Simpan nilai ujian</span>{" "}
              di bawah tabel.
            </p>
          )}
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              disabled={busy || guruExamLocked || allExamSubjectsSubmitted}
              onClick={() => setShowSubmitModal(true)}
              className="ui-btn bg-emerald-600 px-5 text-white hover:bg-emerald-700"
            >
              Kirim Nilai
            </button>
            {lockedVisibleCount > 0 ? (
              <button
                type="button"
                disabled={busy || guruExamLocked}
                onClick={() => setShowUnsubmitModal(true)}
                className="ui-btn bg-amber-500 px-5 text-white hover:bg-amber-600"
              >
                Batal Kirim
              </button>
            ) : null}
          </div>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
          <span className="text-[12px] font-bold uppercase tracking-[0.3em] text-slate-400">
            Aspek
          </span>
          <div className="flex flex-wrap gap-2">
            {(
              [
                ["tertulis", "Tertulis"],
                ["praktek", "Praktik"],
                ["both", "Keduanya"],
              ] as const
            ).map(([val, lbl]) => (
              <label
                key={val}
                className="flex cursor-pointer items-center gap-2 rounded-2xl border border-slate-200/90 bg-white/60 px-3 py-1 text-[13px] font-semibold text-slate-700 shadow-sm transition hover:border-indigo-300 dark:border-slate-600 dark:bg-white/5 dark:text-slate-100"
              >
                <input
                  type="radio"
                  name="exam-aspect"
                  className="accent-indigo-600"
                  checked={aspect === val}
                  onChange={() => setAspect(val)}
                />
                {lbl}
              </label>
            ))}
          </div>
        </div>
        <label className="flex cursor-pointer items-center gap-2 rounded-2xl border border-slate-200/90 bg-white/60 px-3 py-2 text-[13px] font-semibold text-slate-700 shadow-sm transition hover:border-indigo-300 dark:border-slate-600 dark:bg-white/5 dark:text-slate-100">
          <input
            type="checkbox"
            className="accent-indigo-600"
            checked={showGrade}
            onChange={(e) => onShowGradeChange(e.target.checked)}
          />
          Tampilkan Grade
        </label>
      </div>

      {msg ? (
        <p className="ui-alert ui-alert-info font-medium">{msg}</p>
      ) : null}

      {showImport && (
        <ExamImportModal
          subjects={subjects}
          students={students}
          onImport={handleImport}
          onClose={() => setShowImport(false)}
        />
      )}

      {showClearConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
          <div className="ui-card w-full max-w-sm space-y-4 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-red-100 dark:bg-red-500/20">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-red-600 dark:text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100">Bersihkan semua nilai?</h3>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              Semua nilai di tabel akan dikosongkan. Perubahan ini <strong>belum disimpan</strong> ke database sampai Anda menekan tombol Simpan.
            </p>
            <div className="flex justify-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowClearConfirm(false)}
                className="ui-btn ui-btn-ghost px-5"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={() => {
                  const clearGrid = (
                    prev: Record<string, Record<string, string>>,
                  ): Record<string, Record<string, string>> => {
                    const next: Record<string, Record<string, string>> = {};
                    for (const [nisn, row] of Object.entries(prev)) {
                      next[nisn] = {};
                      for (const [kode, val] of Object.entries(row)) {
                        next[nisn][kode] = lockedCodes.has(kode) ? val : "";
                      }
                    }
                    return next;
                  };
                  setMadrasah((prev) => clearGrid(prev));
                  setPraktek((prev) => clearGrid(prev));
                  setShowClearConfirm(false);
                  toast(
                    lockedCodes.size > 0
                      ? "Nilai yang belum dikirim telah dibersihkan. Mapel terkunci tidak terpengaruh."
                      : "Semua nilai telah dibersihkan. Jangan lupa simpan jika ingin menyimpan perubahan.",
                    "warning",
                  );
                }}
                className="ui-btn bg-red-600 px-5 text-white hover:bg-red-700"
              >
                Ya, Bersihkan
              </button>
            </div>
          </div>
        </div>
      )}

      {!selectedClass ? (
        <div className="ui-alert ui-alert-info rounded-xl py-6 text-center font-medium">
          Silakan pilih kelas terlebih dahulu untuk menampilkan tabel nilai.
        </div>
      ) : (
      <div className="ui-table-shell scroll-table-wrap max-h-[calc(100dvh-16rem)] overflow-auto rounded-[1rem] border border-transparent">
        <table className="rekap-table exam-table relative min-w-max border-collapse text-sm">
          <thead className="sticky top-0 z-10">
            <tr>
              <th rowSpan={needsSubRow ? 2 : 1} className="nisn-col text-left">
                NISN
              </th>
              <th rowSpan={needsSubRow ? 2 : 1} className="nama-siswa-cell text-left exam-border-left">
                Nama
              </th>
              {visibleCols.map((c) => (
                <SubjectTooltip
                  key={`h-${c.id}`}
                  kode={c.kode}
                  nama={c.nama}
                  colSpan={c.eff === "both" ? 3 : 1}
                  locked={lockedCodes.has(c.kode)}
                />
              ))}
            </tr>
            {needsSubRow && (
              <tr>
                {visibleCols.flatMap((c, idx) =>
                  c.eff === "both"
                    ? [
                        <TPTooltip key={`${c.id}-t`} label="T" fullName="Tertulis" />,
                        <TPTooltip key={`${c.id}-p`} label="P" fullName="Praktik" />,
                        <TPTooltip key={`${c.id}-r`} label="x̄" fullName="Rata-rata" className={"exam-avg-header" + (idx < visibleCols.length - 1 ? " exam-border-right" : "")} />,
                      ]
                    : [
                        <TPTooltip key={`${c.id}-single`} label={c.eff === "madrasah" ? "T" : "P"} fullName={c.eff === "madrasah" ? "Tertulis" : "Praktik"} />,
                      ],
                )}
              </tr>
            )}
          </thead>
          <tbody>
            {filteredStudents.map((s) => (
              <tr key={s.nisn}>
                <td className="nisn-col tabular-nums">{s.nisn}</td>
                <td className="nama-siswa-cell exam-border-left">{s.name}</td>
                {visibleCols.flatMap((c, idx) => {
                  const setMCell = (v: string) =>
                    setMadrasah((prev) => ({
                      ...prev,
                      [s.nisn]: { ...prev[s.nisn], [c.kode]: v },
                    }));
                  const setPCell = (v: string) =>
                    setPraktek((prev) => ({
                      ...prev,
                      [s.nisn]: { ...prev[s.nisn], [c.kode]: v },
                    }));
                  const borderRight = idx < visibleCols.length - 1 ? " exam-border-right" : "";

                  const locked = lockedCodes.has(c.kode);
                  const lockCls = locked ? " bg-slate-100 dark:bg-slate-800/60" : "";
                  const gradePad = showGrade ? " pb-4" : "";

                  if (c.eff === "madrasah") {
                    const mVal = madrasah[s.nisn]?.[c.kode] ?? "";
                    const pred = getPredikat(mVal, kkm);
                    return [
                      <td key={c.id} className={"text-center exam-border-left" + gradePad + borderRight + lockCls}>
                        <div className="relative inline-flex flex-col items-center">
                          <input
                            type="number"
                            min={0}
                            max={100}
                            className={"score-input ui-input px-1 py-1 text-[13px]" + (locked || guruExamLocked ? " opacity-70 cursor-not-allowed" : "")}
                            value={mVal}
                            readOnly={locked || guruExamLocked}
                            tabIndex={locked || guruExamLocked ? -1 : undefined}
                            onChange={(e) => { if (!locked && !guruExamLocked) setMCell(clampScore(e.target.value)); }}
                          />
                          {showGrade && pred ? (
                            <span className={`absolute -bottom-[13px] text-[10px] font-bold leading-none ${pred.color}`}>{pred.label}</span>
                          ) : null}
                        </div>
                      </td>,
                    ];
                  }
                  if (c.eff === "praktek") {
                    const pVal = praktek[s.nisn]?.[c.kode] ?? "";
                    const pred = getPredikat(pVal, kkm);
                    return [
                      <td key={c.id} className={"text-center exam-border-left" + gradePad + borderRight + lockCls}>
                        <div className="relative inline-flex flex-col items-center">
                          <input
                            type="number"
                            min={0}
                            max={100}
                            className={"score-input ui-input px-1 py-1 text-[13px]" + (locked || guruExamLocked ? " opacity-70 cursor-not-allowed" : "")}
                            value={pVal}
                            readOnly={locked || guruExamLocked}
                            tabIndex={locked || guruExamLocked ? -1 : undefined}
                            onChange={(e) => { if (!locked && !guruExamLocked) setPCell(clampScore(e.target.value)); }}
                          />
                          {showGrade && pred ? (
                            <span className={`absolute -bottom-[13px] text-[10px] font-bold leading-none ${pred.color}`}>{pred.label}</span>
                          ) : null}
                        </div>
                      </td>,
                    ];
                  }
                  {
                    const mVal = madrasah[s.nisn]?.[c.kode] ?? "";
                    const pVal = praktek[s.nisn]?.[c.kode] ?? "";
                    const predM = getPredikat(mVal, kkm);
                    const predP = getPredikat(pVal, kkm);
                    return [
                      <td key={`${c.id}-t`} className={"text-center exam-border-left" + gradePad + lockCls}>
                        <div className="relative inline-flex flex-col items-center">
                          <input
                            type="number"
                            min={0}
                            max={100}
                            className={"score-input ui-input px-1 py-1 text-[13px]" + (locked || guruExamLocked ? " opacity-70 cursor-not-allowed" : "")}
                            value={mVal}
                            readOnly={locked || guruExamLocked}
                            tabIndex={locked || guruExamLocked ? -1 : undefined}
                            onChange={(e) => { if (!locked && !guruExamLocked) setMCell(clampScore(e.target.value)); }}
                          />
                          {showGrade && predM ? (
                            <span className={`absolute -bottom-[13px] text-[10px] font-bold leading-none ${predM.color}`}>{predM.label}</span>
                          ) : null}
                        </div>
                      </td>,
                      <td key={`${c.id}-p`} className={"text-center" + gradePad + lockCls}>
                        <div className="relative inline-flex flex-col items-center">
                          <input
                            type="number"
                            min={0}
                            max={100}
                            className={"score-input ui-input px-1 py-1 text-[13px]" + (locked || guruExamLocked ? " opacity-70 cursor-not-allowed" : "")}
                            value={pVal}
                            readOnly={locked || guruExamLocked}
                            tabIndex={locked || guruExamLocked ? -1 : undefined}
                            onChange={(e) => { if (!locked && !guruExamLocked) setPCell(clampScore(e.target.value)); }}
                          />
                          {showGrade && predP ? (
                            <span className={`absolute -bottom-[13px] text-[10px] font-bold leading-none ${predP.color}`}>{predP.label}</span>
                          ) : null}
                        </div>
                      </td>,
                      <td
                        key={`${c.id}-r`}
                        className={"exam-avg-cell tabular-nums text-center text-xs font-semibold" + borderRight + lockCls}
                      >
                        {rowAvg(s.nisn, c.kode, madrasah, praktek)}
                      </td>,
                    ];
                  }
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      )}

      {selectedClass && (
      <div className="flex flex-row flex-nowrap items-center gap-2 sm:gap-3">
        <button
          type="button"
          disabled={busy || guruExamLocked || allExamSubjectsSubmitted}
          onClick={() => void onSave()}
          className="ui-btn ui-btn-primary shrink-0 px-4 sm:px-6"
        >
          Simpan nilai ujian
        </button>
        {allExamSubjectsSubmitted ? (
          <span className="min-w-0 text-[11px] font-semibold leading-tight text-emerald-700 dark:text-emerald-400 sm:text-sm whitespace-nowrap">
            Nilai ujian telah terkirim.
          </span>
        ) : null}
        {dirty && !busy && !allExamSubjectsSubmitted ? (
          <span className="inline-flex min-w-0 items-center gap-1 text-[11px] font-semibold leading-tight text-amber-600 dark:text-amber-400 sm:gap-1.5 sm:text-sm animate-bounce-x">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 20 20"
              fill="currentColor"
              className="h-4 w-4 shrink-0 sm:h-5 sm:w-5"
              aria-hidden
            >
              <path
                fillRule="evenodd"
                d="M3 10a.75.75 0 01.75-.75h10.638L10.23 5.29a.75.75 0 111.04-1.08l5.5 5.25a.75.75 0 010 1.08l-5.5 5.25a.75.75 0 11-1.04-1.08l4.158-3.96H3.75A.75.75 0 013 10z"
                clipRule="evenodd"
                transform="rotate(180 10 10)"
              />
            </svg>
            <span className="whitespace-nowrap">Jangan lupa simpan!</span>
          </span>
        ) : null}
      </div>
      )}

      {showSubmitModal && (
        <SubjectPickerModal
          title="Kirim Nilai Ujian"
          description="Pilih mapel yang nilainya akan dikirim. Setelah dikirim, nilai tidak bisa diedit kecuali dibatalkan."
          subjects={subjects}
          excludeCodes={lockedCodes}
          confirmLabel="Kirim"
          confirmColor="bg-emerald-600 hover:bg-emerald-700"
          busy={busy}
          onConfirm={async (ids) => {
            setBusy(true);
            const r = await submitExamScoresAction(ids);
            setBusy(false);
            if (!r.ok) { toast(r.message, "error"); return; }
            await loadLocks();
            setShowSubmitModal(false);
            toast("Nilai berhasil dikirim dan dikunci.", "success");
          }}
          onClose={() => setShowSubmitModal(false)}
        />
      )}

      {showUnsubmitModal && (
        <SubjectPickerModal
          title="Batal Kirim Nilai Ujian"
          description="Pilih mapel yang ingin dibuka kembali agar bisa diedit."
          subjects={subjects}
          onlyCodes={lockedCodes}
          confirmLabel="Batal Kirim"
          confirmColor="bg-amber-500 hover:bg-amber-600"
          busy={busy}
          onConfirm={async (ids) => {
            setBusy(true);
            const r = await unsubmitExamScoresAction(ids);
            setBusy(false);
            if (!r.ok) { toast(r.message, "error"); return; }
            await loadLocks();
            setShowUnsubmitModal(false);
            toast("Pengiriman nilai berhasil dibatalkan.", "success");
          }}
          onClose={() => setShowUnsubmitModal(false)}
        />
      )}
    </section>
  );
}

// ─── Subject picker modal for submit/unsubmit ───

function SubjectPickerModal({
  title,
  description,
  subjects,
  excludeCodes,
  onlyCodes,
  confirmLabel,
  confirmColor,
  busy,
  onConfirm,
  onClose,
}: {
  title: string;
  description: string;
  subjects: Subj[];
  excludeCodes?: Set<string>;
  onlyCodes?: Set<string>;
  confirmLabel: string;
  confirmColor: string;
  busy: boolean;
  onConfirm: (subjectIds: string[]) => Promise<void>;
  onClose: () => void;
}) {
  const filtered = useMemo(() => {
    if (onlyCodes) return subjects.filter((s) => onlyCodes.has(s.kode));
    if (excludeCodes) return subjects.filter((s) => !excludeCodes.has(s.kode));
    return subjects;
  }, [subjects, excludeCodes, onlyCodes]);

  const [selected, setSelected] = useState<Set<string>>(new Set());

  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const toggleAll = () => {
    if (selected.size === filtered.length) setSelected(new Set());
    else setSelected(new Set(filtered.map((s) => s.id)));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
      <div className="ui-card w-full max-w-md space-y-4">
        <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100">{title}</h3>
        <p className="text-sm text-slate-600 dark:text-slate-400">{description}</p>

        {filtered.length === 0 ? (
          <p className="py-4 text-center text-sm text-slate-500">Tidak ada mapel yang tersedia.</p>
        ) : (
          <>
            <div className="flex items-center gap-2 border-b border-slate-200 pb-2 dark:border-slate-700">
              <label className="flex cursor-pointer items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-200">
                <input
                  type="checkbox"
                  className="accent-indigo-600"
                  checked={selected.size === filtered.length}
                  onChange={toggleAll}
                />
                Pilih Semua
              </label>
              <span className="text-xs text-slate-400">({selected.size}/{filtered.length})</span>
            </div>
            <div className="max-h-60 space-y-1 overflow-y-auto">
              {filtered.map((s) => (
                <label
                  key={s.id}
                  className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-sm transition hover:bg-slate-50 dark:hover:bg-slate-800"
                >
                  <input
                    type="checkbox"
                    className="accent-indigo-600"
                    checked={selected.has(s.id)}
                    onChange={() => toggle(s.id)}
                  />
                  <span className="font-semibold text-slate-700 dark:text-slate-200">{s.kode}</span>
                  <span className="text-slate-500 dark:text-slate-400">— {s.nama}</span>
                </label>
              ))}
            </div>
          </>
        )}

        <div className="flex justify-end gap-3 pt-2">
          <button type="button" onClick={onClose} className="ui-btn ui-btn-ghost px-5">
            Batal
          </button>
          <button
            type="button"
            disabled={busy || selected.size === 0}
            onClick={() => void onConfirm(Array.from(selected))}
            className={`ui-btn px-5 text-white ${confirmColor} disabled:opacity-50`}
          >
            {confirmLabel} ({selected.size})
          </button>
        </div>
      </div>
    </div>
  );
}
