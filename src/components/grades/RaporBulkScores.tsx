"use client";

import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react";

import {
  getRaporScoreMatrixAction,
  saveRaporScoresAction,
  getRaporLocksAction,
  lockRaporScoresAction,
  unlockRaporScoresAction,
  type ScoreGrid,
  type RaporLockInfo,
} from "@/server/actions/grades";
import { useToast } from "@/components/ToastProvider";
import { RaporImportModal, type ImportedRaporData } from "./RaporImportModal";

type Aspect = "pengetahuan" | "keterampilan" | "both";

type SubjProp = { id: string; kode: string; nama?: string };

function SubjectTooltipRapor({
  kode,
  nama,
  colSpan,
  hasSubRow,
  locked,
}: {
  kode: string;
  nama?: string;
  colSpan?: number;
  hasSubRow?: boolean;
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

  if (!nama) return <th className="exam-subj-header !text-center" colSpan={colSpan}>{kode}</th>;

  return (
    <th
      ref={ref}
      className="exam-subj-header relative cursor-pointer !text-center"
      colSpan={colSpan}
      onMouseEnter={() => setShow(true)}
      onMouseLeave={() => setShow(false)}
      onClick={() => setShow((p) => !p)}
    >
      <span className="border-b border-dashed border-indigo-400 dark:border-indigo-300">{kode}</span>
      {locked && <span className="ml-0.5 text-[10px] text-amber-500" title="Terkunci">&#128274;</span>}
      {show && (
        <span
          className="absolute left-1/2 z-50 mt-1 -translate-x-1/2 whitespace-nowrap rounded-lg bg-slate-800 px-3 py-1.5 text-[11px] font-medium normal-case tracking-normal text-white shadow-lg dark:bg-slate-600"
          style={{ top: hasSubRow ? "calc(100% + 1.6rem)" : "100%" }}
        >
          {nama}{locked ? " (Terkunci)" : ""}
          <span className="absolute -top-1 left-1/2 -translate-x-1/2 border-4 border-transparent border-b-slate-800 dark:border-b-slate-600" />
        </span>
      )}
    </th>
  );
}

function RaporTPTooltip({ label, fullName, className }: { label: string; fullName: string; className?: string }) {
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


function clampScore(val: string): string {
  if (val === "") return "";
  const n = Number(val);
  if (Number.isNaN(n)) return val;
  if (n > 100) return "100";
  if (n < 0) return "0";
  return val;
}

type GridState = Record<string, Record<string, string>>;

type GridAction =
  | { type: "SET_GRID"; grid: GridState }
  | { type: "UPDATE_CELL"; nisn: string; kode: string; value: string };

function gridReducer(state: GridState, action: GridAction): GridState {
  switch (action.type) {
    case "SET_GRID":
      return action.grid;
    case "UPDATE_CELL": {
      const { nisn, kode, value } = action;
      return {
        ...state,
        [nisn]: {
          ...state[nisn],
          [kode]: value,
        },
      };
    }
    default:
      return state;
  }
}

function emptyGrid(
  students: { nisn: string }[],
  subjects: { kode: string }[],
): GridState {
  const g: GridState = {};
  for (const st of students) {
    g[st.nisn] = {};
    for (const su of subjects) g[st.nisn][su.kode] = "";
  }
  return g;
}

function mergeFetched(base: GridState, fetched: ScoreGrid) {
  for (const [nisn, row] of Object.entries(fetched)) {
    if (!base[nisn]) continue;
    for (const su of Object.keys(base[nisn])) {
      const v = row[su];
      base[nisn][su] =
        v === null || v === undefined || Number.isNaN(v) ? "" : String(v);
    }
  }
}

function toScoreGrid(g: GridState): ScoreGrid {
  const out: ScoreGrid = {};
  for (const [nisn, row] of Object.entries(g)) {
    out[nisn] = {};
    for (const [code, raw] of Object.entries(row ?? {})) {
      const t = raw.trim();
      out[nisn][code] = t === "" ? null : Number(t);
    }
  }
  return out;
}

export function RaporBulkScores({
  students,
  subjects,
  semesterOptions,
  classRooms = [],
}: {
  students: { nisn: string; name: string; classRoomId?: string }[];
  subjects: SubjProp[];
  semesterOptions: { key: string; label: string }[];
  initialAspectStored?: string;
  classRooms?: { id: string; name: string }[];
}) {
  const [semesterKey, setSemesterKey] = useState(
    semesterOptions[0]?.key ?? "",
  );
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
  const [aspectUI, setAspectUI] = useState<Aspect>("both");
  const [gridP, dispatchP] = useReducer(gridReducer, {});
  const [gridK, dispatchK] = useReducer(gridReducer, {});
  const [busy, setBusy] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [showImport, setShowImport] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [showLockModal, setShowLockModal] = useState(false);
  const [showUnlockModal, setShowUnlockModal] = useState(false);
  const [lockedCodes, setLockedCodes] = useState<Set<string>>(new Set());
  const [, setLockMap] = useState<Map<string, RaporLockInfo>>(new Map());
  const [msg, setMsg] = useState<string | null>(null);
  const savedSnapshotP = useRef<string>("");
  const savedSnapshotK = useRef<string>("");
  const [saveGen, setSaveGen] = useState(0);
  const abortRef = useRef<AbortController | null>(null);
  const { toast } = useToast();

  const loadLocks = useCallback(async (sk: string) => {
    if (!sk) return;
    const locks = await getRaporLocksAction(sk);
    setLockMap(new Map(locks.map((l) => [l.code, l])));
    setLockedCodes(new Set(locks.map((l) => l.code)));
  }, []);

  const dirty = useMemo(() => {
    if (!savedSnapshotP.current && !savedSnapshotK.current) return false;
    return (
      JSON.stringify(gridP) !== savedSnapshotP.current ||
      JSON.stringify(gridK) !== savedSnapshotK.current
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gridP, gridK, saveGen]);

  /** Server mengembalikan kunci seluruh mapel sekolah; counter mengikuti mapel di halaman ini (penting untuk akun guru). */
  const lockedVisibleCount = useMemo(
    () => subjects.reduce((n, s) => n + (lockedCodes.has(s.kode) ? 1 : 0), 0),
    [subjects, lockedCodes],
  );
  const subjectCountOnPage = subjects.length;
  const allRaporSubjectsLocked =
    subjectCountOnPage > 0 && lockedVisibleCount === subjectCountOnPage;

  const reload = useCallback(async () => {
    if (!semesterKey) return;

    if (abortRef.current) {
      abortRef.current.abort();
    }
    const ctrl = new AbortController();
    abortRef.current = ctrl;

    setBusy(true);
    setFetching(true);
    try {
      const p0 = emptyGrid(students, subjects);
      const k0 = emptyGrid(students, subjects);

      const [mP, mK] = await Promise.all([
        getRaporScoreMatrixAction(semesterKey, "pengetahuan"),
        getRaporScoreMatrixAction(semesterKey, "keterampilan"),
      ]);
      if (ctrl.signal.aborted) return;
      mergeFetched(p0, mP);
      mergeFetched(k0, mK);
      dispatchP({ type: "SET_GRID", grid: p0 });
      dispatchK({ type: "SET_GRID", grid: k0 });
      savedSnapshotP.current = JSON.stringify(p0);
      savedSnapshotK.current = JSON.stringify(k0);
      await loadLocks(semesterKey);
    } catch (err) {
      if (!ctrl.signal.aborted) {
        console.error("Failed to load scores:", err);
      }
    } finally {
      if (!ctrl.signal.aborted) {
        setBusy(false);
        setFetching(false);
      }
    }
  }, [semesterKey, students, subjects, loadLocks]);

  useEffect(() => {
    void reload();
    return () => {
      if (abortRef.current) {
        abortRef.current.abort();
      }
    };
  }, [reload]);

  const avgCell = useMemo(() => {
    return (nisn: string, kode: string) => {
      const t = gridP[nisn]?.[kode]?.trim() ?? "";
      const kp = gridK[nisn]?.[kode]?.trim() ?? "";
      const nT = Number(t);
      const nP = Number(kp);
      if (t !== "" && kp !== "" && Number.isFinite(nT + nP))
        return ((nT + nP) / 2).toFixed(2);
      if (t !== "" && Number.isFinite(nT)) return nT.toFixed(2);
      if (kp !== "" && Number.isFinite(nP)) return nP.toFixed(2);
      return "";
    };
  }, [gridP, gridK]);

  async function onSave() {
    if (!semesterKey) return;
    setBusy(true);
    setMsg(null);

    try {
      const r1 = await saveRaporScoresAction(
        semesterKey,
        "pengetahuan",
        toScoreGrid(gridP),
      );
      if (!r1.ok) throw new Error(r1.message);
      const r2 = await saveRaporScoresAction(
        semesterKey,
        "keterampilan",
        toScoreGrid(gridK),
      );
      if (!r2.ok) throw new Error(r2.message);
      savedSnapshotP.current = JSON.stringify(gridP);
      savedSnapshotK.current = JSON.stringify(gridK);
      setSaveGen((g) => g + 1);
      setMsg(null);
      toast("Nilai rapor berhasil disimpan.", "success");
    } catch (err) {
      setMsg((err as Error).message);
      toast((err as Error).message, "error");
    }

    setBusy(false);
  }

  const gridPRef = useRef(gridP);
  gridPRef.current = gridP;
  const gridKRef = useRef(gridK);
  gridKRef.current = gridK;

  const handleImport = useCallback(
    (data: ImportedRaporData) => {
      const merge = (
        cur: GridState,
        imp: Record<string, Record<string, number>>,
      ): GridState => {
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

      dispatchP({ type: "SET_GRID", grid: merge(gridPRef.current, data.pengetahuan) });
      if (Object.keys(data.keterampilan).length > 0) {
        dispatchK({ type: "SET_GRID", grid: merge(gridKRef.current, data.keterampilan) });
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

    for (const sheetName of ["Pengetahuan", "Keterampilan"]) {
      const ws = wb.addWorksheet(sheetName);
      ws.columns = [
        { header: "NISN", key: "nisn", width: 15 },
        { header: "Nama", key: "nama", width: 30 },
        ...subjects.map((s) => ({ header: s.kode, key: s.kode, width: 10 })),
      ];
      ws.getRow(1).font = { bold: true };
      for (const s of target) ws.addRow({ nisn: s.nisn, nama: s.name });
    }

    const semLabel = semesterOptions.find((o) => o.key === semesterKey)?.label ?? semesterKey;
    const meta = wb.addWorksheet("_metadata");
    meta.getCell("A1").value = "type";
    meta.getCell("B1").value = "rapor";
    meta.getCell("A2").value = "semester_key";
    meta.getCell("B2").value = semesterKey;
    meta.getCell("A3").value = "semester_label";
    meta.getCell("B3").value = semLabel;
    meta.state = "veryHidden";

    const buffer = await wb.xlsx.writeBuffer();
    const blob = new Blob([buffer], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `template-rapor-${semesterKey || "semester"}.xlsx`;
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

    subjects.forEach((s) => {
      columns.push({ header: `${s.kode} (Pengetahuan)`, key: `${s.kode}_P`, width: 15 });
      columns.push({ header: `${s.kode} (Keterampilan)`, key: `${s.kode}_K`, width: 15 });
      columns.push({ header: `${s.kode} (Rata-rata)`, key: `${s.kode}_R`, width: 15 });
    });

    ws.columns = columns;
    ws.getRow(1).font = { bold: true };

    for (const s of target) {
      const rowData: any = { nisn: s.nisn, nama: s.name };
      subjects.forEach((su) => {
        const p = gridP[s.nisn]?.[su.kode] ?? "";
        const k = gridK[s.nisn]?.[su.kode] ?? "";
        rowData[`${su.kode}_P`] = p;
        rowData[`${su.kode}_K`] = k;
        rowData[`${su.kode}_R`] = avgCell(s.nisn, su.kode);
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
    a.download = `export-nilai-rapor-${semesterKey || "semester"}${selectedClass && selectedClass !== "__all__" ? "-" + (classRooms.find(c => c.id === selectedClass)?.name || "") : ""}.xlsx`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const showAvg = aspectUI === "both";

  return (
    <section className="ui-card space-y-5">
      <div className="max-w-3xl space-y-2">
        <h2 className="ui-page-title text-[clamp(1.35rem,2.5vw,1.85rem)]">
          Nilai rapor bulk
        </h2>
        <p className="ui-muted text-pretty">
          Isi massal per semester. Aspek hanya mengatur tampilan — semua nilai
          (Pengetahuan &amp; Keterampilan) tetap tersimpan. Tap kode mapel
          untuk melihat nama lengkap.
        </p>
      </div>

      <div className="flex flex-wrap items-end gap-4 text-[13px]">
        <label className="ui-label min-w-[12rem]">
          Semester aktif
          <select
            value={semesterKey}
            onChange={(e) => setSemesterKey(e.target.value)}
            className="ui-select mt-1.5"
          >
            {semesterOptions.map((o) => (
              <option key={o.key} value={o.key}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
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
            disabled={busy || fetching}
            onClick={() => setShowImport(true)}
            className="ui-btn ui-btn-ghost"
          >
            📥 Import dari Excel
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => void downloadTemplate()}
            className="ui-btn ui-btn-ghost"
          >
            📄 Download Template
          </button>
          <button
            type="button"
            disabled={busy || fetching}
            onClick={() => void exportData()}
            className="ui-btn ui-btn-ghost text-indigo-600 dark:text-indigo-400"
          >
            📤 Eksport Data
          </button>
          <button
            type="button"
            disabled={busy || fetching}
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
              Mapel yang telah dikunci ={" "}
              <strong className="tabular-nums text-slate-900 dark:text-white">
                {lockedVisibleCount}/{subjectCountOnPage}
              </strong>
            </span>
          </div>
          {lockedVisibleCount > 0 ? (
            <p className="mt-2 text-[12px] leading-relaxed text-slate-600 dark:text-slate-400">
              Nilai pada mapel yang sudah dikunci tidak bisa diubah sampai Anda menekan{" "}
              <span className="font-semibold text-slate-700 dark:text-slate-300">Buka Kunci</span>{" "}
              untuk mapel tersebut. Mapel yang belum dikunci tetap bisa diedit dan disimpan seperti biasa.
            </p>
          ) : (
            <p className="mt-2 text-[12px] leading-relaxed text-slate-600 dark:text-slate-400">
              Setelah nilai dirasa benar, kunci per mapel agar kolomnya tidak teredit lagi.
              Simpan ke database tetap menggunakan tombol{" "}
              <span className="font-semibold text-slate-700 dark:text-slate-300">Simpan nilai rapor</span>{" "}
              di bawah tabel.
            </p>
          )}
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              disabled={busy || fetching || allRaporSubjectsLocked}
              onClick={() => setShowLockModal(true)}
              className="ui-btn bg-emerald-600 px-5 text-white hover:bg-emerald-700"
            >
              Kunci Nilai
            </button>
            {lockedVisibleCount > 0 ? (
              <button
                type="button"
                disabled={busy || fetching}
                onClick={() => setShowUnlockModal(true)}
                className="ui-btn bg-amber-500 px-5 text-white hover:bg-amber-600"
              >
                Buka Kunci
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
                ["pengetahuan", "Pengetahuan"],
                ["keterampilan", "Keterampilan"],
                ["both", "Keduanya"],
              ] as const
            ).map(([val, lbl]) => (
              <label
                key={val}
                className="flex cursor-pointer items-center gap-2 rounded-2xl border border-slate-200/90 bg-white/60 px-3 py-1 text-[13px] font-semibold text-slate-700 shadow-sm transition hover:border-indigo-300 dark:border-slate-600 dark:bg-white/5 dark:text-slate-100"
              >
                <input
                  type="radio"
                  name="aspek"
                  className="accent-indigo-600"
                  checked={aspectUI === val}
                  onChange={() => setAspectUI(val)}
                />
                {lbl}
              </label>
            ))}
          </div>
        </div>
      </div>

      {msg ? (
        <p className="ui-alert ui-alert-info font-medium">{msg}</p>
      ) : null}

      {showImport && (
        <RaporImportModal
          subjects={subjects}
          students={students}
          currentSemesterKey={semesterKey}
          currentSemesterLabel={semesterOptions.find((o) => o.key === semesterKey)?.label ?? semesterKey}
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
                  const clearGrid = (prev: GridState): GridState => {
                    const next: GridState = {};
                    for (const [nisn, row] of Object.entries(prev)) {
                      next[nisn] = {};
                      for (const [kode, val] of Object.entries(row)) {
                        next[nisn][kode] = lockedCodes.has(kode) ? val : "";
                      }
                    }
                    return next;
                  };
                  dispatchP({ type: "SET_GRID", grid: clearGrid(gridP) });
                  dispatchK({ type: "SET_GRID", grid: clearGrid(gridK) });
                  setShowClearConfirm(false);
                  toast(
                    lockedCodes.size > 0
                      ? "Nilai yang belum dikunci telah dibersihkan. Mapel terkunci tidak terpengaruh."
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
      <div className="ui-table-shell scroll-table-wrap max-h-[calc(100dvh-14rem)] overflow-auto rounded-[1rem] border border-transparent">
        <table className="rekap-table exam-table relative min-w-max border-collapse text-sm">
          <thead className="sticky top-0 z-10">
            {showAvg ? (
              <>
                <tr>
                  <th rowSpan={2} className="nisn-col text-left">NISN</th>
                  <th rowSpan={2} className="nama-siswa-cell text-left exam-border-left">Nama</th>
                  {subjects.map((su) => (
                    <SubjectTooltipRapor
                      key={`h-${su.kode}`}
                      kode={su.kode}
                      nama={su.nama}
                      colSpan={3}
                      hasSubRow
                      locked={lockedCodes.has(su.kode)}
                    />
                  ))}
                </tr>
                <tr>
                  {subjects.flatMap((su, idx) => [
                    <RaporTPTooltip key={`${su.kode}-p`} label="P" fullName="Pengetahuan" />,
                    <RaporTPTooltip key={`${su.kode}-k`} label="K" fullName="Keterampilan" />,
                    <RaporTPTooltip key={`${su.kode}-r`} label="x̄" fullName="Rata-rata" className={"exam-avg-header" + (idx < subjects.length - 1 ? " exam-border-right" : "")} />,
                  ])}
                </tr>
              </>
            ) : (
              <tr>
                <th className="nisn-col text-left">NISN</th>
                <th className="nama-siswa-cell text-left exam-border-left">Nama</th>
                {subjects.map((su) => (
                  <SubjectTooltipRapor key={su.kode} kode={su.kode} nama={su.nama} locked={lockedCodes.has(su.kode)} />
                ))}
              </tr>
            )}
          </thead>
          <tbody>
            {fetching
              ? Array.from({ length: Math.min(10, Math.max(filteredStudents.length, 3)) }).map((_, i) => (
                  <tr key={`skeleton-${i}`} className="animate-pulse">
                    <td className="nisn-col"><div className="h-4 w-16 rounded bg-slate-200 dark:bg-slate-700" /></td>
                    <td className="nama-siswa-cell"><div className="h-4 w-32 rounded bg-slate-200 dark:bg-slate-700" /></td>
                    {showAvg
                      ? subjects.flatMap((su) => [
                          <td key={`${su.kode}-p`}><div className="mx-auto h-7 w-10 rounded bg-slate-200/60 dark:bg-slate-700/60" /></td>,
                          <td key={`${su.kode}-k`}><div className="mx-auto h-7 w-10 rounded bg-slate-200/60 dark:bg-slate-700/60" /></td>,
                          <td key={`${su.kode}-r`} className="exam-avg-cell"><div className="mx-auto h-4 w-8 rounded bg-slate-200 dark:bg-slate-700" /></td>,
                        ])
                      : subjects.map((su) => (
                          <td key={su.kode}><div className="mx-auto h-7 w-10 rounded bg-slate-200/60 dark:bg-slate-700/60" /></td>
                        ))}
                  </tr>
                ))
              : filteredStudents.map((s) => (
                  <tr key={s.nisn}>
                    <td className="nisn-col tabular-nums">{s.nisn}</td>
                    <td className="nama-siswa-cell exam-border-left">{s.name}</td>
                    {showAvg
                      ? subjects.flatMap((su, idx) => {
                          const locked = lockedCodes.has(su.kode);
                          const lockCls = locked ? " bg-slate-100 dark:bg-slate-800/60" : "";
                          const inputLockCls = locked ? " opacity-70 cursor-not-allowed" : "";
                          return [
                            <td key={`${su.kode}-p`} className={"text-center exam-border-left" + lockCls}>
                              <input
                                type="number"
                                min={0}
                                max={100}
                                className={"score-input ui-input px-1 py-1 text-[13px]" + inputLockCls}
                                value={gridP[s.nisn]?.[su.kode] ?? ""}
                                readOnly={locked}
                                tabIndex={locked ? -1 : undefined}
                                onChange={(e) => {
                                  if (!locked) dispatchP({
                                    type: "UPDATE_CELL",
                                    nisn: s.nisn,
                                    kode: su.kode,
                                    value: clampScore(e.target.value),
                                  });
                                }}
                              />
                            </td>,
                            <td key={`${su.kode}-k`} className={"text-center" + lockCls}>
                              <input
                                type="number"
                                min={0}
                                max={100}
                                className={"score-input ui-input px-1 py-1 text-[13px]" + inputLockCls}
                                value={gridK[s.nisn]?.[su.kode] ?? ""}
                                readOnly={locked}
                                tabIndex={locked ? -1 : undefined}
                                onChange={(e) => {
                                  if (!locked) dispatchK({
                                    type: "UPDATE_CELL",
                                    nisn: s.nisn,
                                    kode: su.kode,
                                    value: clampScore(e.target.value),
                                  });
                                }}
                              />
                            </td>,
                            <td
                              key={`${su.kode}-r`}
                              className={"exam-avg-cell tabular-nums text-center text-xs font-semibold" + (idx < subjects.length - 1 ? " exam-border-right" : "") + lockCls}
                            >
                              {avgCell(s.nisn, su.kode)}
                            </td>,
                          ];
                        })
                      : subjects.map((su, idx) => {
                          const locked = lockedCodes.has(su.kode);
                          const lockCls = locked ? " bg-slate-100 dark:bg-slate-800/60" : "";
                          const inputLockCls = locked ? " opacity-70 cursor-not-allowed" : "";
                          return (
                            <td key={su.kode} className={"text-center exam-border-left" + (idx < subjects.length - 1 ? " exam-border-right" : "") + lockCls}>
                              <input
                                type="number"
                                min={0}
                                max={100}
                                className={"score-input ui-input px-1 py-1 text-[13px]" + inputLockCls}
                                value={
                                  (aspectUI === "pengetahuan" ? gridP : gridK)[
                                    s.nisn
                                  ]?.[su.kode] ?? ""
                                }
                                readOnly={locked}
                                tabIndex={locked ? -1 : undefined}
                                onChange={(e) => {
                                  if (locked) return;
                                  const dispatch =
                                    aspectUI === "pengetahuan" ? dispatchP : dispatchK;
                                  dispatch({
                                    type: "UPDATE_CELL",
                                    nisn: s.nisn,
                                    kode: su.kode,
                                    value: clampScore(e.target.value),
                                  });
                                }}
                              />
                            </td>
                          );
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
          disabled={busy || allRaporSubjectsLocked}
          onClick={() => void onSave()}
          className="ui-btn ui-btn-success shrink-0 px-4 sm:px-6"
        >
          Simpan nilai rapor
        </button>
        {allRaporSubjectsLocked ? (
          <span className="min-w-0 whitespace-nowrap text-[11px] font-semibold leading-tight text-emerald-700 dark:text-emerald-400 sm:text-sm">
            Nilai rapor telah terkunci.
          </span>
        ) : null}
        {dirty && !busy && !allRaporSubjectsLocked ? (
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

      {showLockModal && (
        <RaporSubjectPickerModal
          title="Kunci Nilai Rapor"
          description="Pilih mapel yang nilainya akan dikunci. Setelah dikunci, nilai tidak bisa diedit kecuali dibuka kembali."
          subjects={subjects}
          excludeCodes={lockedCodes}
          confirmLabel="Kunci"
          confirmColor="bg-emerald-600 hover:bg-emerald-700"
          busy={busy}
          onConfirm={async (ids) => {
            setBusy(true);
            const r = await lockRaporScoresAction(semesterKey, ids);
            setBusy(false);
            if (!r.ok) { toast(r.message, "error"); return; }
            await loadLocks(semesterKey);
            setShowLockModal(false);
            toast("Nilai berhasil dikunci.", "success");
          }}
          onClose={() => setShowLockModal(false)}
        />
      )}

      {showUnlockModal && (
        <RaporSubjectPickerModal
          title="Buka Kunci Nilai Rapor"
          description="Pilih mapel yang ingin dibuka kembali agar bisa diedit."
          subjects={subjects}
          onlyCodes={lockedCodes}
          confirmLabel="Buka Kunci"
          confirmColor="bg-amber-500 hover:bg-amber-600"
          busy={busy}
          onConfirm={async (ids) => {
            setBusy(true);
            const r = await unlockRaporScoresAction(semesterKey, ids);
            setBusy(false);
            if (!r.ok) { toast(r.message, "error"); return; }
            await loadLocks(semesterKey);
            setShowUnlockModal(false);
            toast("Kunci nilai berhasil dibuka.", "success");
          }}
          onClose={() => setShowUnlockModal(false)}
        />
      )}
    </section>
  );
}

// ─── Subject picker modal for lock/unlock ───

function RaporSubjectPickerModal({
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
  subjects: SubjProp[];
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
                  {s.nama && <span className="text-slate-500 dark:text-slate-400">— {s.nama}</span>}
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