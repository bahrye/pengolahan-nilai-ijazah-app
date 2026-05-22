"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { StudentQuotaBanner } from "@/components/subscription/StudentQuotaBanner";
import { useSubscriptionUsage } from "@/components/subscription/SubscriptionUsageProvider";
import { useToast } from "@/components/ToastProvider";
import type { StudentListItem } from "@/server/actions/students";
import type { ImportSkip, ImportWarning } from "@/server/actions/students";
import {
  parseStudentImportWorksheet,
  pickStudentImportWorksheet,
  type ParsedStudentImportRow,
} from "@/lib/student-import-excel";
import {
  bulkDeleteStudentsAction,
  bulkMoveStudentsClassAction,
  bulkSetStudentLoginActiveAction,
  checkNisnDuplicateAction,
  createStudentAction,
  deleteStudentAction,
  editStudentAction,
  importStudentsChunkAction,
  provisionStudentLoginAction,
  refreshStudentsListAction,
  setStudentLoginActiveAction,
  toggleStudentActiveAction,
} from "@/server/actions/students";

function countPendingNewStudents(
  rows: ParsedStudentImportRow[],
  existingNisns: Set<string>,
): number {
  const seen = new Set<string>();
  let n = 0;
  for (const r of rows) {
    if (r.error) continue;
    const nisn = r.nisn.replace(/\D/g, "");
    if (!/^\d{10}$/.test(nisn)) continue;
    if (existingNisns.has(nisn)) continue;
    if (seen.has(nisn)) continue;
    seen.add(nisn);
    n += 1;
  }
  return n;
}

function useNisnCheck() {
  const [nisnWarning, setNisnWarning] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const checkNisn = useCallback((val: string) => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setNisnWarning(null);
    const clean = val.replace(/\D/g, "");
    if (clean.length !== 10) return;
    timerRef.current = setTimeout(async () => {
      const r = await checkNisnDuplicateAction(clean);
      if (r.found) setNisnWarning(`NISN ini juga terdaftar di ${r.schoolName}. Pastikan data siswa sudah benar.`);
      else setNisnWarning(null);
    }, 500);
  }, []);

  const reset = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setNisnWarning(null);
  }, []);

  useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current); }, []);

  return { nisnWarning, checkNisn, resetNisnWarning: reset };
}

function NisnWarningBanner({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <p className="mt-1 rounded-lg bg-amber-50 px-3 py-1.5 text-xs font-medium text-amber-700 dark:bg-amber-500/10 dark:text-amber-400">
      {message}
    </p>
  );
}

function studentClassGroupKey(s: StudentListItem): string {
  if (s.classRoomId) return `room:${s.classRoomId}`;
  return `name:${(s.className ?? "").trim().toLowerCase()}`;
}

function StudentRowActionsMenu({
  student: s,
  busyAction,
  busyGenerate,
  onKartu,
  showKartuLogin = true,
  showLoginToggle = true,
  onLoginToggle,
  onEdit,
  onToggleData,
  onDelete,
}: {
  student: StudentListItem;
  busyAction: boolean;
  busyGenerate: boolean;
  onKartu: () => void;
  showKartuLogin?: boolean;
  showLoginToggle?: boolean;
  onLoginToggle: () => void;
  onEdit: () => void;
  onToggleData: () => void;
  onDelete: () => void;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const busy = busyAction || busyGenerate;

  useEffect(() => {
    if (busy) setOpen(false);
  }, [busy]);

  useEffect(() => {
    if (!open) return undefined;
    function onDoc(e: MouseEvent) {
      if (rootRef.current?.contains(e.target as Node)) return;
      setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    window.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const loginDisabled = busy || !s.hasLogin;
  const loginItemTitle = !s.hasLogin
    ? "Buat akun lewat menu Kartu login terlebih dahulu"
    : undefined;
  const loginItemLabel =
    s.hasLogin && s.loginActive ? "Login: Off" : "Login: On";

  return (
    <div className="relative inline-block text-left" ref={rootRef}>
      <button
        type="button"
        className="ui-btn ui-btn-ghost inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold"
        aria-expanded={open}
        aria-haspopup="menu"
        disabled={busy}
        onClick={() => setOpen((o) => !o)}
      >
        Aksi
        <span className="text-[10px] opacity-70" aria-hidden>
          ▾
        </span>
      </button>
      {open ? (
        <div
          className="absolute right-0 z-50 mt-1.5 min-w-[13rem] overflow-hidden rounded-xl border border-slate-200/90 bg-white py-1 text-[13px] shadow-lg ring-1 ring-black/5 dark:border-slate-600 dark:bg-slate-900 dark:ring-white/10"
          role="menu"
        >
          {showKartuLogin !== false ? (
            <button
              type="button"
              role="menuitem"
              disabled={busy}
              className="flex w-full items-center px-3 py-2 text-left font-medium text-slate-800 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 dark:text-slate-100 dark:hover:bg-slate-800/80"
              onClick={() => {
                onKartu();
                setOpen(false);
              }}
            >
              Kartu login
            </button>
          ) : null}
          {showLoginToggle !== false ? (
            <button
              type="button"
              role="menuitem"
              disabled={loginDisabled}
              title={loginItemTitle}
              className="flex w-full items-center px-3 py-2 text-left font-medium text-slate-800 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-45 dark:text-slate-100 dark:hover:bg-slate-800/80"
              onClick={() => {
                onLoginToggle();
                setOpen(false);
              }}
            >
              {loginItemLabel}
            </button>
          ) : null}
          <button
            type="button"
            role="menuitem"
            disabled={busyAction}
            className="flex w-full items-center px-3 py-2 text-left font-medium text-slate-800 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 dark:text-slate-100 dark:hover:bg-slate-800/80"
            onClick={() => {
              onEdit();
              setOpen(false);
            }}
          >
            Edit
          </button>
          <button
            type="button"
            role="menuitem"
            disabled={busyAction}
            title="Status data siswa (kolom STATUS), bukan akses login"
            className="flex w-full items-center px-3 py-2 text-left font-medium text-slate-800 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 dark:text-slate-100 dark:hover:bg-slate-800/80"
            onClick={() => {
              onToggleData();
              setOpen(false);
            }}
          >
            {s.isActive ? "Nonaktifkan data" : "Aktifkan data"}
          </button>
          <div className="my-1 border-t border-slate-200 dark:border-slate-700" />
          <button
            type="button"
            role="menuitem"
            disabled={busyAction}
            className="flex w-full items-center px-3 py-2 text-left font-semibold text-red-600 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50 dark:text-red-400 dark:hover:bg-red-950/40"
            onClick={() => {
              onDelete();
              setOpen(false);
            }}
          >
            Hapus
          </button>
        </div>
      ) : null}
    </div>
  );
}

export function SiswaClient(props: {
  initial: StudentListItem[];
  classRooms: { id: string; name: string }[];
  canGenerateLoginCards?: boolean;
}) {
  const { toast, progressToast } = useToast();
  const subscription = useSubscriptionUsage();
  const [students, setStudents] = useState(props.initial);
  const [busyGenerate, setBusyGenerate] = useState(false);
  const [selectedClassRoomId, setSelectedClassRoomId] = useState("");

  // import state
  const [importPreview, setImportPreview] = useState<ParsedStudentImportRow[] | null>(null);
  const [importResult, setImportResult] = useState<{
    imported: number;
    skipped: ImportSkip[];
    warnings: ImportWarning[];
  } | null>(null);
  const [importing, setImporting] = useState(false);
  /** Progres nyata: baca file di klien, lalu unggah per-batch ke server. */
  const [importProgress, setImportProgress] = useState<
    | { kind: "parse"; loadedRows: number }
    | { kind: "upload"; processed: number; total: number }
    | null
  >(null);
  const fileRef = useRef<HTMLInputElement>(null);
  /** Unduh template: fetch + stream agar bisa progress bar */
  const [templateDownload, setTemplateDownload] = useState<
    | null
    | { phase: "connecting" | "downloading"; loaded: number; total: number | null }
  >(null);

  // edit / delete
  const [editTarget, setEditTarget] = useState<StudentListItem | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<StudentListItem | null>(null);
  const [busyAction, setBusyAction] = useState(false);
  const [showInactive, setShowInactive] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterClassRoomId, setFilterClassRoomId] = useState("");

  const addNisn = useNisnCheck();
  const editNisn = useNisnCheck();

  const existingNisns = useMemo(
    () => new Set(students.map((s) => s.nisn)),
    [students],
  );

  const pendingImportNewCount = useMemo(() => {
    if (!importPreview) return 0;
    return countPendingNewStudents(importPreview, existingNisns);
  }, [importPreview, existingNisns]);

  const importExceedsQuota =
    subscription != null &&
    !subscription.studentQuotaUnlimited &&
    pendingImportNewCount > subscription.studentAddsRemaining;

  function applyQuotaFromServer(quota?: {
    studentAddsUsed: number;
    studentAddsRemaining: number;
  }) {
    if (quota) {
      subscription?.setStudentQuotaFromServer(
        quota.studentAddsUsed,
        quota.studentAddsRemaining,
      );
    }
  }

  // bulk delete / pindah kelas
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showBulkDeleteConfirm, setShowBulkDeleteConfirm] = useState(false);
  const [showBulkMoveModal, setShowBulkMoveModal] = useState(false);
  const [bulkMoveTargetRoomId, setBulkMoveTargetRoomId] = useState("");

  const canManageStudentLogin = props.canGenerateLoginCards !== false;

  /* ────────── helpers ────────── */

  function formatBirthDateDdMmYyyy(isoDate: string): string {
    if (!isoDate) return "—";
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(isoDate);
    if (!m) return "—";
    return `${m[3]}-${m[2]}-${m[1]}`;
  }

  /** URL halaman login siswa (NISN + tanggal lahir). */
  function studentLoginPageUrl() {
    if (typeof window === "undefined") return "";
    return `${window.location.origin}/login/siswa`;
  }

  function filteredStudentsForClass() {
    if (!selectedClassRoomId) return students;
    return students.filter((s) => s.classRoomId === selectedClassRoomId);
  }

  function escapeHtml(s: string) {
    return s
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  /* ────────── Smart class name sorting ────────── */

  function romanToNum(r: string): number | null {
    const map: Record<string, number> = {
      I: 1, V: 5, X: 10, L: 50, C: 100, D: 500, M: 1000,
    };
    const upper = r.toUpperCase();
    if (!/^[IVXLCDM]+$/.test(upper)) return null;
    let total = 0;
    for (let i = 0; i < upper.length; i++) {
      const cur = map[upper[i]];
      const nxt = map[upper[i + 1]] ?? 0;
      total += cur < nxt ? -cur : cur;
    }
    return total;
  }

  function classNameSortKey(name: string): (number | string)[] {
    const tokens = name.split(/([.\s\-/]+)/);
    const key: (number | string)[] = [];
    for (const t of tokens) {
      const trimmed = t.trim();
      if (!trimmed) continue;
      const asNum = Number(trimmed);
      if (!Number.isNaN(asNum)) {
        key.push(asNum);
        continue;
      }
      const asRoman = romanToNum(trimmed);
      if (asRoman !== null) {
        key.push(asRoman);
        continue;
      }
      key.push(trimmed.toLowerCase());
    }
    return key;
  }

  function compareClassName(a: string, b: string): number {
    const ka = classNameSortKey(a);
    const kb = classNameSortKey(b);
    const len = Math.max(ka.length, kb.length);
    for (let i = 0; i < len; i++) {
      const va = ka[i];
      const vb = kb[i];
      if (va === undefined && vb !== undefined) return -1;
      if (va !== undefined && vb === undefined) return 1;
      if (typeof va === "number" && typeof vb === "number") {
        if (va !== vb) return va - vb;
      } else if (typeof va === "string" && typeof vb === "string") {
        const cmp = va.localeCompare(vb, "id");
        if (cmp !== 0) return cmp;
      } else {
        if (typeof va === "number") return -1;
        return 1;
      }
    }
    return 0;
  }

  const selectedStudents = useMemo(
    () => students.filter((s) => selectedIds.has(s.id)),
    [students, selectedIds],
  );

  const bulkMoveClassSource = useMemo(() => {
    if (selectedStudents.length < 2) return null;
    const key0 = studentClassGroupKey(selectedStudents[0]!);
    for (const s of selectedStudents) {
      if (studentClassGroupKey(s) !== key0) return null;
    }
    const first = selectedStudents[0]!;
    return {
      classRoomId: first.classRoomId,
      label: first.classRoomName || first.className || "—",
    };
  }, [selectedStudents]);

  const bulkMoveTargetOptions = useMemo(() => {
    if (!bulkMoveClassSource) return [];
    if (bulkMoveClassSource.classRoomId) {
      return props.classRooms.filter((c) => c.id !== bulkMoveClassSource.classRoomId);
    }
    const src = bulkMoveClassSource.label.trim().toLowerCase();
    return props.classRooms.filter((c) => {
      const short = c.name.split(" (")[0]?.trim().toLowerCase() ?? "";
      return short !== src;
    });
  }, [bulkMoveClassSource, props.classRooms]);

  useEffect(() => {
    if (showBulkMoveModal && bulkMoveTargetOptions.length > 0) {
      setBulkMoveTargetRoomId((prev) =>
        prev && bulkMoveTargetOptions.some((c) => c.id === prev)
          ? prev
          : bulkMoveTargetOptions[0]!.id,
      );
    } else if (!showBulkMoveModal) {
      setBulkMoveTargetRoomId("");
    }
  }, [showBulkMoveModal, bulkMoveTargetOptions]);

  const visibleStudents = students
    .filter((s) => {
      if (!showInactive && !s.isActive) return false;
      if (filterClassRoomId && s.classRoomId !== filterClassRoomId) return false;
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        if (!s.name.toLowerCase().includes(q) && !s.nisn.toLowerCase().includes(q)) return false;
      }
      return true;
    })
    .sort((a, b) => {
      const cmp = compareClassName(a.classRoomName || a.className || "", b.classRoomName || b.className || "");
      if (cmp !== 0) return cmp;
      return a.name.localeCompare(b.name, "id");
    });

  /* ────────── bulk select ────────── */

  function toggleSelect(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function toggleSelectAll() {
    if (selectedIds.size === visibleStudents.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(visibleStudents.map((s) => s.id)));
    }
  }

  async function handleBulkDelete() {
    setBusyAction(true);
    const res = await bulkDeleteStudentsAction({ studentIds: Array.from(selectedIds) });
    setBusyAction(false);
    setShowBulkDeleteConfirm(false);
    if (!res.ok) {
      toast(res.message, "error");
    } else {
      setStudents(res.list);
      setSelectedIds(new Set());
      toast(`${res.deleted} siswa berhasil dihapus.`, "success");
    }
  }

  /* ────────── login card ────────── */

  function buildCardsHtml(list: StudentListItem[], title: string): string {
    if (list.length === 0) return "";
    const loginPage = studentLoginPageUrl();
    const loginPageHref = escapeHtml(loginPage);
    const cards = list
      .map((s) => {
        const kelas = escapeHtml(s.classRoomName || s.className || "-");
        const nama = escapeHtml(s.name);
        const nisn = escapeHtml(s.nisn);
        const tglLahir = escapeHtml(formatBirthDateDdMmYyyy(s.birthDate));
        const urlBlock =
          loginPage.length > 0
            ? `<p><strong>URL Login</strong>: <a href="${loginPageHref}">${loginPageHref}</a></p>
  <p class="hint">Gunakan NISN dan Tanggal Lahir untuk login.</p>`
            : "";
        return `<article class="card">
  <h3>Kartu Login Siswa</h3>
  <p><strong>NISN</strong>: ${nisn}</p>
  <p><strong>Tanggal Lahir</strong>: ${tglLahir}</p>
  <p><strong>Nama</strong>: ${nama}</p>
  <p><strong>Kelas</strong>: ${kelas}</p>
  <hr />
  ${urlBlock}
</article>`;
      })
      .join("");
    const titleSafe = escapeHtml(title);
    return `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>${titleSafe}</title>
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <style>
    * { box-sizing: border-box; }
    body { font-family: Arial, sans-serif; margin: 16px; color: #0f172a; background: #f8fafc; }
    h1 { margin: 0 0 14px; font-size: 20px; }
    .toolbar { margin-bottom: 12px; }
    .toolbar button { cursor: pointer; border-radius: 8px; border: 1px solid #cbd5e1; padding: 8px 12px; background: #fff; }
    .grid { display: grid; grid-template-columns: repeat(2, minmax(280px, 1fr)); gap: 12px; }
    .card {
      border: 1px solid #cbd5e1; border-radius: 12px; padding: 12px 14px;
      break-inside: avoid; background: linear-gradient(160deg, #eef2ff 0%, #ffffff 52%);
    }
    .card h3 { margin: 0 0 8px; font-size: 16px; color: #312e81; }
    .card p { margin: 4px 0; font-size: 14px; }
    .card a { color: #312e81; font-weight: 600; text-decoration: underline; word-break: break-all; }
    .hint { color: #475569; font-size: 12px; margin-top: 8px; }
    hr { border: 0; border-top: 1px dashed #cbd5e1; margin: 8px 0; }
    @media print {
      body { margin: 8mm; background: #fff; }
      .toolbar { display: none; }
      .grid { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; }
    }
  </style>
</head>
<body>
  <div class="toolbar"><button onclick="window.print()">Cetak</button></div>
  <h1>${titleSafe}</h1>
  <section class="grid">${cards}</section>
</body>
</html>`;
  }

  function downloadCardsHtml(list: StudentListItem[], title: string) {
    const html = buildCardsHtml(list, title);
    if (!html) {
      toast("Tidak ada data siswa untuk dibuatkan kartu.", "error");
      return;
    }
    const blob = new Blob([html], { type: "text/html;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${title.replace(/[^a-z0-9-_ ]/gi, "").replace(/\s+/g, "_")}.html`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  }

  /* ────────── CRUD handlers ────────── */

  async function add(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const fd = new FormData(form);
    const birth = fd.get("birthDate");
    const crId = String(fd.get("classRoomId") || "");
    let className = String(fd.get("className") || "").trim();
    if (!className && crId) {
      className = props.classRooms.find((c) => c.id === crId)?.name ?? "";
    }
    const res = await createStudentAction({
      nisn: String(fd.get("nisn")),
      name: String(fd.get("name")),
      gender: String(fd.get("gender") || "L"),
      birthPlace: String(fd.get("birthPlace") || "").trim() || null,
      birthDate: typeof birth === "string" ? birth : "",
      className,
      classRoomId: crId || null,
    });
    if (!res.ok) toast(res.message, "error");
    else {
      setStudents(res.list);
      if (res.quota) applyQuotaFromServer(res.quota);
      else subscription?.applyStudentAdds(1);
      toast("Siswa berhasil ditambahkan.", "success");
      if (res.warning) toast(res.warning, "warning");
      form.reset();
      addNisn.resetNisnWarning();
    }
  }

  async function handleEdit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!editTarget) return;
    setBusyAction(true);
    const fd = new FormData(e.currentTarget);
    const res = await editStudentAction({
      id: editTarget.id,
      nisn: String(fd.get("nisn")),
      name: String(fd.get("name")),
      gender: String(fd.get("gender") || "L"),
      birthPlace: String(fd.get("birthPlace") || "").trim() || null,
      birthDate: String(fd.get("birthDate")),
      className: String(fd.get("className")),
      classRoomId: String(fd.get("classRoomId")) || null,
    });
    setBusyAction(false);
    if (!res.ok) {
      toast(res.message, "error");
    } else {
      setStudents(res.list);
      setEditTarget(null);
      toast("Data siswa berhasil diperbarui.", "success");
      if (res.warning) toast(res.warning, "warning");
      editNisn.resetNisnWarning();
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setBusyAction(true);
    const res = await deleteStudentAction({ studentId: deleteTarget.id });
    setBusyAction(false);
    if (!res.ok) {
      toast(res.message, "error");
    } else {
      setStudents(res.list);
      setDeleteTarget(null);
      toast("Siswa berhasil dihapus.", "success");
    }
  }

  async function handleToggleActive(s: StudentListItem) {
    setBusyAction(true);
    const res = await toggleStudentActiveAction({ studentId: s.id });
    setBusyAction(false);
    if (!res.ok) {
      toast(res.message, "error");
    } else {
      setStudents(res.list);
      toast(
        s.isActive
          ? `${s.name} dinonaktifkan (status data).`
          : `${s.name} diaktifkan kembali (status data).`,
        "success",
      );
    }
  }

  async function handleSetLoginActive(s: StudentListItem, active: boolean) {
    if (!s.hasLogin) {
      toast(
        "Akun login belum dibuat. Gunakan tombol Kartu untuk membuat akun terlebih dahulu.",
        "error",
      );
      return;
    }
    setBusyAction(true);
    const res = await setStudentLoginActiveAction({ studentId: s.id, active });
    setBusyAction(false);
    if (!res.ok) {
      toast(res.message, "error");
      return;
    }
    setStudents(res.list);
    toast(
      active
        ? `Login ${s.name} diaktifkan.`
        : `Login ${s.name} dinonaktifkan.`,
      "success",
    );
  }

  async function handleBulkSetLoginActive(active: boolean) {
    if (selectedIds.size === 0) return;
    setBusyAction(true);
    const res = await bulkSetStudentLoginActiveAction({
      studentIds: Array.from(selectedIds),
      active,
    });
    setBusyAction(false);
    if (!res.ok) {
      toast(res.message, "error");
      return;
    }
    setStudents(res.list);
    const parts = [`${res.updated} siswa diperbarui.`];
    if (res.skippedNoAccount > 0) {
      parts.push(
        `${res.skippedNoAccount} terlewati (tanpa akun login).`,
      );
    }
    toast(parts.join(" "), "success");
  }

  async function handleBulkMoveClass() {
    if (!bulkMoveTargetRoomId || selectedIds.size < 2) return;
    setBusyAction(true);
    const res = await bulkMoveStudentsClassAction({
      studentIds: Array.from(selectedIds),
      targetClassRoomId: bulkMoveTargetRoomId,
    });
    setBusyAction(false);
    if (!res.ok) {
      toast(res.message, "error");
      return;
    }
    setStudents(res.list);
    setShowBulkMoveModal(false);
    setSelectedIds(new Set());
    toast(`${res.moved} siswa berhasil dipindahkan kelas.`, "success");
  }

  /* ────────── Download template Excel (dengan progress) ────────── */

  async function handleDownloadStudentTemplate() {
    if (templateDownload !== null) return;
    setTemplateDownload({ phase: "connecting", loaded: 0, total: null });
    try {
      const res = await fetch("/api/students/template", { credentials: "include" });
      const ct = res.headers.get("content-type") ?? "";
      if (!res.ok) {
        let msg = "Gagal mengunduh template.";
        try {
          if (ct.includes("application/json")) {
            const j = (await res.json()) as { error?: string };
            if (typeof j.error === "string" && j.error) msg = j.error;
          } else {
            const t = await res.text();
            if (t) msg = t.slice(0, 240);
          }
        } catch {
          /* tetap pakai msg default */
        }
        toast(msg, "error");
        return;
      }

      const lenHdr = res.headers.get("content-length");
      const bytesTotal =
        lenHdr != null && /^\d+$/.test(lenHdr.trim()) ? parseInt(lenHdr, 10) : null;

      const triggerBlobDownload = (blob: Blob) => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "template_import_siswa.xlsx";
        a.rel = "noopener";
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
      };

      if (!res.body) {
        const buf = await res.arrayBuffer();
        triggerBlobDownload(
          new Blob([buf], {
            type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          }),
        );
        toast("Template berhasil diunduh.", "success");
        return;
      }

      setTemplateDownload({ phase: "downloading", loaded: 0, total: bytesTotal });
      const reader = res.body.getReader();
      const chunks: BlobPart[] = [];
      let loaded = 0;
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        if (value && value.byteLength > 0) {
          chunks.push(value);
          loaded += value.byteLength;
          setTemplateDownload({ phase: "downloading", loaded, total: bytesTotal });
        }
      }
      triggerBlobDownload(
        new Blob(chunks, {
          type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        }),
      );
      toast("Template berhasil diunduh.", "success");
    } catch (e) {
      toast((e as Error).message ?? "Gagal mengunduh template.", "error");
    } finally {
      setTemplateDownload(null);
    }
  }

  /* ────────── Import Excel: parse → preview → confirm ────────── */

  function handleFilePicked(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true);
    setImportProgress({ kind: "parse", loadedRows: 0 });
    setImportPreview(null);
    setImportResult(null);

    void (async () => {
      try {
        const ExcelJS = (await import("exceljs")).default;
        const buf = await file.arrayBuffer();
        const wb = new ExcelJS.Workbook();
        await wb.xlsx.load(buf);
        const ws = pickStudentImportWorksheet(wb.worksheets);
        if (!ws) {
          toast("Tidak ada sheet data siswa di file Excel.", "error");
          return;
        }

        const parsed = parseStudentImportWorksheet(ws);
        if (parsed.rows.length === 0) {
          toast("Tidak ada data di file Excel.", "error");
          return;
        }

        setImportProgress({ kind: "parse", loadedRows: parsed.rows.length });
        setImportPreview(parsed.rows);
      } catch (err) {
        toast(`Gagal membaca file: ${(err as Error).message}`, "error");
      } finally {
        setImportProgress(null);
        setImporting(false);
      }
    })();

    if (fileRef.current) fileRef.current.value = "";
  }

  async function confirmImport() {
    if (!importPreview) return;
    const rowsWithMeta = importPreview
      .map((r) => ({ r, excelRow: r.excelRow }))
      .filter((x) => !x.r.error);
    if (rowsWithMeta.length === 0) {
      toast("Tidak ada baris yang valid untuk diimport.", "error");
      return;
    }

    const IMPORT_CHUNK = 50;
    setImporting(true);
    setImportProgress({ kind: "upload", processed: 0, total: rowsWithMeta.length });

    const allSkipped: ImportSkip[] = [];
    const allWarnings: ImportWarning[] = [];
    let importedSum = 0;

    try {
      for (let i = 0; i < rowsWithMeta.length; i += IMPORT_CHUNK) {
        const slice = rowsWithMeta.slice(i, i + IMPORT_CHUNK);
        setImportProgress({
          kind: "upload",
          processed: i,
          total: rowsWithMeta.length,
        });
        const chunk = slice.map(({ r, excelRow }) => ({
          excelRow,
          nisn: r.nisn,
          name: r.name,
          gender: r.gender,
          birthPlace: r.birthPlace,
          birthDate: r.birthDate,
          className: r.className,
          classRoomName: r.classRoomName,
          nomorUjian: r.nomorUjian || undefined,
          ruangUjian: r.ruangUjian || "1",
          parentGuardianName: r.parentGuardianName || undefined,
          sklLetterNumber: r.sklLetterNumber || undefined,
          nis: r.nis || undefined,
        }));
        const res = await importStudentsChunkAction(chunk);
        if (!res.ok) {
          toast(res.message, "error");
          return;
        }
        importedSum += res.imported;
        allSkipped.push(...res.skipped);
        allWarnings.push(...res.warnings);
        if (res.quota) applyQuotaFromServer(res.quota);
        else if (res.imported > 0) subscription?.applyStudentAdds(res.imported);
        setImportProgress({
          kind: "upload",
          processed: Math.min(i + slice.length, rowsWithMeta.length),
          total: rowsWithMeta.length,
        });
      }

      const listRes = await refreshStudentsListAction();
      if (!listRes.ok) {
        toast(listRes.message, "error");
        return;
      }
      setStudents(listRes.list);
      setImportResult({
        imported: importedSum,
        skipped: allSkipped,
        warnings: allWarnings,
      });
      setImportPreview(null);
      toast(`Berhasil mengimport ${importedSum} siswa.`, "success");
      if (allWarnings.length > 0) {
        toast(
          `${allWarnings.length} siswa memiliki NISN yang juga terdaftar di sekolah lain.`,
          "warning",
        );
      }
    } finally {
      setImportProgress(null);
      setImporting(false);
    }
  }

  /* ────────── Generate login ────────── */

  async function generateOne(studentId: string) {
    if (props.canGenerateLoginCards === false) {
      toast("Generate kartu login hanya untuk sekolah berlangganan.", "error");
      return;
    }
    const pt = progressToast({ total: 1, title: "Membuat akun login siswa…" });
    setBusyGenerate(true);
    try {
      const res = await provisionStudentLoginAction({ studentId });
      if (!res.ok) {
        pt.error(res.message);
        return;
      }
      pt.update(1, "Memuat data siswa…");
      const listRes = await refreshStudentsListAction();
      if (!listRes.ok) {
        pt.error(listRes.message);
        return;
      }
      setStudents(listRes.list);
      const s = listRes.list.find((x) => x.id === studentId);
      if (!s) {
        pt.error("Siswa tidak ditemukan.");
        return;
      }
      downloadCardsHtml([s], `Kartu Login - ${s.name}`);
      pt.success("Kartu login berhasil dibuat dan file HTML diunduh.");
    } finally {
      setBusyGenerate(false);
    }
  }

  async function generateByClass() {
    if (props.canGenerateLoginCards === false) {
      toast("Generate kartu login hanya untuk sekolah berlangganan.", "error");
      return;
    }
    const list = filteredStudentsForClass();
    if (list.length === 0) {
      toast("Tidak ada siswa pada kelas yang dipilih.", "error");
      return;
    }
    const missingBirth = list.find((s) => !s.birthDate);
    if (missingBirth) {
      toast(
        `Tanggal lahir belum diisi untuk siswa ${missingBirth.nisn} — ${missingBirth.name}.`,
        "error",
      );
      return;
    }

    const ids = list.map((s) => s.id);
    const pt = progressToast({
      total: ids.length,
      title: "Membuat akun login siswa…",
    });
    setBusyGenerate(true);
    try {
      for (let i = 0; i < ids.length; i++) {
        const res = await provisionStudentLoginAction({ studentId: ids[i] });
        if (!res.ok) {
          pt.error(res.message);
          return;
        }
        pt.update(i + 1, `Memproses… (${i + 1} / ${ids.length})`);
      }

      const listRes = await refreshStudentsListAction();
      if (!listRes.ok) {
        pt.error(listRes.message);
        return;
      }
      setStudents(listRes.list);
      const byId = new Map(listRes.list.map((s) => [s.id, s]));
      const forCards = ids
        .map((id) => byId.get(id))
        .filter((x): x is StudentListItem => x != null);
      if (forCards.length === 0) {
        pt.error("Gagal memuat data siswa untuk kartu.");
        return;
      }
      const kelasLabel =
        props.classRooms.find((c) => c.id === selectedClassRoomId)?.name ??
        "Semua Kelas";
      downloadCardsHtml(forCards, `Kartu Login - ${kelasLabel}`);
      pt.success(
        `Kartu login ${forCards.length} siswa berhasil dibuat dan file HTML diunduh.`,
      );
    } finally {
      setBusyGenerate(false);
    }
  }

  /* ────────── render ────────── */

  const invalidImportCount = importPreview?.filter((r) => r.error).length ?? 0;
  const validImportCount = (importPreview?.length ?? 0) - invalidImportCount;

  return (
    <div className="min-w-0 w-full space-y-8 overflow-x-hidden">
      <div className="max-w-2xl space-y-1">
        <h1 className="ui-page-title">Data siswa</h1>
        <p className="ui-muted text-pretty">
          Tambah siswa baru lalu gunakan NISN + tanggal lahir sebagai akun login
          siswa.
        </p>
      </div>

      {/* ─── Tambah siswa ─── */}
      <section className="ui-card ui-card-tight">
        <h2 className="ui-section-title mb-4">Tambah siswa</h2>
        <StudentQuotaBanner className="mb-4" />
        <form onSubmit={add} className="grid gap-4 md:grid-cols-3">
          <label className="space-y-1">
            <span className="text-[12px] font-semibold text-slate-600 dark:text-slate-400">NISN *</span>
            <input required name="nisn" placeholder="10 digit NISN" pattern="\d{10}" minLength={10} maxLength={10} title="NISN harus tepat 10 digit angka" inputMode="numeric" className="ui-input w-full" onChange={(e) => addNisn.checkNisn(e.target.value)} />
            <NisnWarningBanner message={addNisn.nisnWarning} />
          </label>
          <label className="space-y-1">
            <span className="text-[12px] font-semibold text-slate-600 dark:text-slate-400">Nama lengkap *</span>
            <input required name="name" placeholder="Nama siswa" className="ui-input w-full" />
          </label>
          <label className="space-y-1">
            <span className="text-[12px] font-semibold text-slate-600 dark:text-slate-400">Jenis kelamin</span>
            <select name="gender" className="ui-select w-full">
              <option value="L">Laki-laki</option>
              <option value="P">Perempuan</option>
            </select>
          </label>
          <label className="space-y-1">
            <span className="text-[12px] font-semibold text-slate-600 dark:text-slate-400">Tempat lahir</span>
            <input name="birthPlace" placeholder="Contoh: Jakarta" className="ui-input w-full" />
          </label>
          <label className="space-y-1">
            <span className="text-[12px] font-semibold text-slate-600 dark:text-slate-400">Tanggal lahir *</span>
            <input name="birthDate" type="date" required className="ui-input w-full" />
          </label>
          <label className="space-y-1 md:col-span-2">
            <span className="text-[12px] font-semibold text-slate-600 dark:text-slate-400">Label kelas (opsional)</span>
            <input name="className" placeholder="Contoh: IX.1, XII IPA 2" className="ui-input w-full" />
          </label>
          <label className="space-y-1 md:col-span-3">
            <span className="text-[12px] font-semibold text-slate-600 dark:text-slate-400">Kelas *</span>
            <select name="classRoomId" required className="ui-select w-full">
              <option value="">— Pilih kelas —</option>
              {props.classRooms.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </label>
          <div className="md:col-span-3">
            <button type="submit" className="ui-btn ui-btn-success">Tambah siswa</button>
          </div>
        </form>
      </section>

      {/* ─── Import & Template ─── */}
      <section className="ui-card ui-card-tight">
        <h2 className="ui-section-title mb-4">Import data siswa dari Excel</h2>
        <StudentQuotaBanner
          pendingAdds={importPreview ? pendingImportNewCount : 0}
          className="mb-4"
        />
        <p className="ui-muted mb-4 text-sm">
          Download template terlebih dahulu, isi data, lalu upload file Excel untuk import.
        </p>
        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            disabled={templateDownload !== null || busyAction}
            onClick={async () => {
              setBusyAction(true);
              try {
                const res = await fetch("/api/students/export", { credentials: "include" });
                if (!res.ok) {
                  toast("Gagal mengekspor data.", "error");
                  return;
                }
                const blob = await res.blob();
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                a.download = "export_data_siswa.xlsx";
                a.click();
                URL.revokeObjectURL(url);
                toast("Data berhasil diekspor ke Excel.", "success");
              } catch (e) {
                toast((e as Error).message ?? "Gagal mengekspor Excel.", "error");
              } finally {
                setBusyAction(false);
              }
            }}
            className="ui-btn ui-btn-primary"
          >
            {busyAction ? "Mengekspor…" : "Eksport data saat ini"}
          </button>
          <button
            type="button"
            disabled={templateDownload !== null || busyAction}
            onClick={() => void handleDownloadStudentTemplate()}
            className="ui-btn ui-btn-ghost"
          >
            {templateDownload ? "Mengunduh template…" : "Download template kosong"}
          </button>
          <label className="ui-btn ui-btn-success cursor-pointer">
            {importing && importProgress?.kind === "parse"
              ? `Membaca file… (${importProgress.loadedRows} baris)`
              : importing && importProgress?.kind === "upload"
                ? `Mengimport… (${importProgress.processed}/${importProgress.total})`
                : importing
                  ? "Membaca file…"
                  : "Upload file Excel"}
            <input
              ref={fileRef}
              type="file"
              accept=".xlsx,.xls"
              className="hidden"
              onChange={handleFilePicked}
              disabled={importing || templateDownload !== null || busyAction}
            />
          </label>
        </div>

        {templateDownload ? (
          <div className="mt-4 w-full max-w-lg space-y-2" role="status" aria-live="polite">
            <div className="flex flex-wrap justify-between gap-2 text-xs font-semibold text-slate-600 dark:text-slate-400">
              <span>
                {templateDownload.phase === "connecting"
                  ? "Menyambung ke server…"
                  : templateDownload.total != null && templateDownload.total > 0
                    ? `Mengunduh file… ${Math.min(100, Math.round((templateDownload.loaded / templateDownload.total) * 100))}%`
                    : `Menerima data… (${Math.max(0, Math.round(templateDownload.loaded / 1024))} KB)`}
              </span>
              {templateDownload.phase === "downloading" &&
              templateDownload.total != null &&
              templateDownload.total > 0 ? (
                <span className="tabular-nums">
                  {templateDownload.loaded.toLocaleString("id-ID")} /{" "}
                  {templateDownload.total.toLocaleString("id-ID")} byte
                </span>
              ) : null}
            </div>
            {templateDownload.phase === "connecting" ||
            templateDownload.total == null ||
            templateDownload.total <= 0 ? (
              <div className="guru-import-progress-track">
                <div className="guru-import-progress-thumb" />
              </div>
            ) : (
              <div className="h-2.5 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-indigo-600 to-violet-600 transition-[width] duration-200 ease-out"
                  style={{
                    width: `${Math.min(100, Math.round((templateDownload.loaded / templateDownload.total) * 100))}%`,
                  }}
                />
              </div>
            )}
          </div>
        ) : null}
      </section>

      {/* ─── Generate kartu login ─── */}
      <section className="ui-card ui-card-tight">
        <h2 className="ui-section-title mb-4">Generate kartu login siswa</h2>
        {props.canGenerateLoginCards === false ? (
          <p className="ui-alert ui-alert-info mb-4 text-sm">
            Fitur kartu login siswa hanya untuk sekolah berlangganan. Buka menu{" "}
            <strong>Langganan</strong> untuk mengaktifkan paket.
          </p>
        ) : null}
        {props.canGenerateLoginCards !== false ? (
        <p className="ui-muted mb-4 text-sm">
          Siswa masuk lewat halaman login siswa dengan <strong>NISN</strong> dan <strong>tanggal lahir</strong> (sama seperti di kartu; tanggal lahir ditampilkan format <code>dd-mm-yyyy</code>).
          Progres pembuatan akun tampil di notifikasi; setelah selesai file HTML kartu (berisi tautan halaman login) diunduh otomatis.
        </p>
        ) : null}
        {props.canGenerateLoginCards !== false ? (
        <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_auto]">
          <label className="ui-label">
            Pilih kelas (opsional)
            <select className="ui-select mt-1.5" value={selectedClassRoomId} onChange={(e) => setSelectedClassRoomId(e.target.value)}>
              <option value="">Semua kelas</option>
              {props.classRooms.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </label>
          <div className="flex items-end">
            <button type="button" onClick={generateByClass} disabled={busyGenerate} className="ui-btn ui-btn-primary w-full md:w-auto">
              Generate kartu per kelas
            </button>
          </div>
        </div>
        ) : null}
      </section>

      {/* ─── Daftar siswa ─── */}
      <section className="min-w-0 w-full overflow-hidden">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-3">
            <h2 className="ui-section-title">Daftar siswa ({visibleStudents.length})</h2>
            {selectedIds.size > 0 && (
              <>
                {canManageStudentLogin ? (
                  <>
                    <button
                      type="button"
                      disabled={busyAction}
                      onClick={() => void handleBulkSetLoginActive(true)}
                      className="ui-btn bg-emerald-600 px-3 py-1 text-xs text-white hover:bg-emerald-700"
                    >
                      Aktif Login ({selectedIds.size})
                    </button>
                    <button
                      type="button"
                      disabled={busyAction}
                      onClick={() => void handleBulkSetLoginActive(false)}
                      className="ui-btn border border-amber-600/80 bg-amber-500/90 px-3 py-1 text-xs text-white hover:bg-amber-600"
                    >
                      Non-Aktif Login ({selectedIds.size})
                    </button>
                  </>
                ) : null}
                {bulkMoveClassSource && bulkMoveTargetOptions.length > 0 ? (
                  <button
                    type="button"
                    disabled={busyAction}
                    onClick={() => setShowBulkMoveModal(true)}
                    className="ui-btn border border-indigo-600/80 bg-indigo-600 px-3 py-1 text-xs text-white hover:bg-indigo-700"
                  >
                    Pindah Kelas ({selectedIds.size})
                  </button>
                ) : null}
                <button
                  type="button"
                  disabled={busyAction}
                  onClick={() => setShowBulkDeleteConfirm(true)}
                  className="ui-btn bg-red-600 px-3 py-1 text-xs text-white hover:bg-red-700"
                >
                  Hapus Massal ({selectedIds.size})
                </button>
              </>
            )}
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={showInactive} onChange={(e) => setShowInactive(e.target.checked)} className="accent-indigo-600" />
            Tampilkan non-aktif
          </label>
        </div>
        <div className="mb-3 flex flex-wrap items-center gap-3">
          <input
            type="text"
            placeholder="Cari nama atau NISN..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="ui-input w-full max-w-xs"
          />
          <select
            value={filterClassRoomId}
            onChange={(e) => setFilterClassRoomId(e.target.value)}
            className="ui-select w-full max-w-[14rem]"
          >
            <option value="">Semua kelas</option>
            {props.classRooms.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>
        <p className="ui-muted mb-2 text-xs md:hidden">Geser tabel ke kanan/kiri untuk melihat semua kolom.</p>
        <div className="ui-table-shell min-w-0 w-full">
          <div className="w-full overflow-x-auto overscroll-x-contain">
            <table className="rekap-table w-full min-w-[64rem] text-sm">
              <thead>
                <tr>
                  <th className="text-center w-8">
                    <input
                      type="checkbox"
                      className="accent-indigo-600"
                      checked={visibleStudents.length > 0 && selectedIds.size === visibleStudents.length}
                      onChange={toggleSelectAll}
                    />
                  </th>
                  <th className="text-left">#</th>
                  <th className="text-left">NISN</th>
                  <th className="text-left">Nama</th>
                  <th className="text-left">JK</th>
                  <th className="text-left">Tanggal Lahir</th>
                  <th className="text-left">Kelas</th>
                  <th className="text-left whitespace-nowrap">
                    <span className="font-semibold">STATUS</span>
                    <span className="mx-1 text-slate-400 font-normal">|</span>
                    <span className="font-semibold">LOGIN</span>
                  </th>
                  <th className="text-left">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {visibleStudents.map((s, i) => (
                  <tr key={s.id} className={s.isActive ? "" : "opacity-50"}>
                    <td className="text-center">
                      <input
                        type="checkbox"
                        className="accent-indigo-600"
                        checked={selectedIds.has(s.id)}
                        onChange={() => toggleSelect(s.id)}
                      />
                    </td>
                    <td className="text-left">{i + 1}</td>
                    <td className="text-left">{s.nisn}</td>
                    <td className="text-left">{s.name}</td>
                    <td className="text-left">{s.gender ?? "-"}</td>
                    <td className="text-left">{formatBirthDateDdMmYyyy(s.birthDate)}</td>
                    <td className="text-left">{s.classRoomName || s.className || "-"}</td>
                    <td className="text-left">
                      <div className="flex flex-wrap items-center gap-x-1.5 text-xs font-semibold">
                        <span
                          className={
                            s.isActive
                              ? "text-emerald-700 dark:text-emerald-300"
                              : "text-red-700 dark:text-red-300"
                          }
                        >
                          {s.isActive ? "Aktif" : "Non-aktif"}
                        </span>
                        <span className="font-normal text-slate-400">|</span>
                        <span
                          className={
                            s.hasLogin && s.loginActive
                              ? "text-emerald-700 dark:text-emerald-300"
                              : "text-slate-600 dark:text-slate-400"
                          }
                        >
                          {!s.hasLogin
                            ? "Non-Aktif"
                            : s.loginActive
                              ? "Aktif"
                              : "Non-Aktif"}
                        </span>
                      </div>
                    </td>
                    <td className="text-left align-middle">
                      <StudentRowActionsMenu
                        student={s}
                        busyAction={busyAction}
                        busyGenerate={busyGenerate}
                        showKartuLogin={canManageStudentLogin}
                        showLoginToggle={canManageStudentLogin}
                        onKartu={() => void generateOne(s.id)}
                        onLoginToggle={() => void handleSetLoginActive(s, !s.loginActive)}
                        onEdit={() => setEditTarget(s)}
                        onToggleData={() => void handleToggleActive(s)}
                        onDelete={() => setDeleteTarget(s)}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* ═══ Modal: Pindah kelas massal ═══ */}
      {showBulkMoveModal && bulkMoveClassSource ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
          <div className="ui-card w-full max-w-md space-y-4">
            <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100">
              Pindah {selectedIds.size} siswa ke kelas lain
            </h3>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              Semua siswa terpilih berasal dari kelas{" "}
              <strong>{bulkMoveClassSource.label}</strong>. Pilih kelas tujuan pada tahun ajaran
              aktif.
            </p>
            <label className="ui-label block">
              Kelas tujuan
              <select
                className="ui-select mt-1.5"
                value={bulkMoveTargetRoomId}
                onChange={(e) => setBulkMoveTargetRoomId(e.target.value)}
                disabled={busyAction || bulkMoveTargetOptions.length === 0}
              >
                {bulkMoveTargetOptions.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>
            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                disabled={busyAction}
                onClick={() => setShowBulkMoveModal(false)}
                className="ui-btn ui-btn-ghost px-5"
              >
                Batal
              </button>
              <button
                type="button"
                disabled={busyAction || !bulkMoveTargetRoomId}
                onClick={() => void handleBulkMoveClass()}
                className="ui-btn ui-btn-primary px-5"
              >
                {busyAction ? "Memindahkan…" : "Pindahkan"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {/* ═══ Modal: Konfirmasi hapus massal ═══ */}
      {showBulkDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
          <div className="ui-card w-full max-w-sm space-y-4 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-red-100 dark:bg-red-500/20">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-red-600 dark:text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </div>
            <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100">Hapus {selectedIds.size} siswa?</h3>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              Data siswa yang dipilih beserta nilai dan akun login-nya akan <strong>dihapus permanen</strong> dari database. Tindakan ini tidak dapat dibatalkan.
            </p>
            <div className="flex justify-center gap-3 pt-2">
              <button
                type="button"
                disabled={busyAction}
                onClick={() => setShowBulkDeleteConfirm(false)}
                className="ui-btn ui-btn-ghost px-5"
              >
                Batal
              </button>
              <button
                type="button"
                disabled={busyAction}
                onClick={() => void handleBulkDelete()}
                className="ui-btn bg-red-600 px-5 text-white hover:bg-red-700"
              >
                {busyAction ? "Menghapus..." : "Ya, Hapus Semua"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══ Modal: Import preview / konfirmasi ═══ */}
      {importPreview ? (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/50 p-4">
          <div className="ui-card w-full max-w-4xl">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
              <h3 className="ui-section-title">Preview Import Siswa</h3>
              <button type="button" className="ui-btn ui-btn-ghost" onClick={() => setImportPreview(null)} disabled={importing}>
                Batal
              </button>
            </div>

            <div className="mb-4 flex flex-wrap gap-4 text-sm">
              <span className="rounded-lg bg-emerald-100 px-3 py-1 font-semibold text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-300">
                Valid: {validImportCount} baris
              </span>
              {invalidImportCount > 0 && (
                <span className="rounded-lg bg-red-100 px-3 py-1 font-semibold text-red-800 dark:bg-red-500/20 dark:text-red-300">
                  Bermasalah: {invalidImportCount} baris
                </span>
              )}
              {pendingImportNewCount > 0 ? (
                <span className="rounded-lg bg-indigo-100 px-3 py-1 font-semibold text-indigo-800 dark:bg-indigo-500/20 dark:text-indigo-300">
                  Perkiraan siswa baru: {pendingImportNewCount}
                </span>
              ) : null}
            </div>

            <StudentQuotaBanner
              pendingAdds={pendingImportNewCount}
              className="mb-4"
            />
            {importExceedsQuota ? (
              <p className="mb-4 text-sm font-medium text-red-600 dark:text-red-400">
                Kuota tidak mencukupi: perkiraan {pendingImportNewCount} siswa baru, sisa kuota{" "}
                {subscription?.studentAddsRemaining ?? 0}. Kurangi data atau berlangganan.
              </p>
            ) : null}

            <div className="mb-4 max-h-80 overflow-auto rounded-lg border dark:border-slate-700">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-slate-100 dark:bg-slate-800">
                  <tr>
                    <th className="px-3 py-2 text-left">Baris</th>
                    <th className="px-3 py-2 text-left">NISN</th>
                    <th className="px-3 py-2 text-left">Nama</th>
                    <th className="px-3 py-2 text-left">JK</th>
                    <th className="px-3 py-2 text-left">Tgl Lahir</th>
                    <th className="px-3 py-2 text-left">Kelas</th>
                    <th className="px-3 py-2 text-left">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {importPreview.map((r, i) => (
                    <tr key={i} className={r.error ? "bg-red-50 dark:bg-red-950/30" : ""}>
                      <td className="px-3 py-1.5">{i + 1}</td>
                      <td className="px-3 py-1.5">{r.nisn || <span className="text-red-500">—</span>}</td>
                      <td className="px-3 py-1.5">{r.name || <span className="text-red-500">—</span>}</td>
                      <td className="px-3 py-1.5">{r.gender}</td>
                      <td className="px-3 py-1.5">{r.birthDate || <span className="text-red-500">—</span>}</td>
                      <td className="px-3 py-1.5">{r.classRoomName || r.className || "-"}</td>
                      <td className="px-3 py-1.5 text-xs">
                        {r.error ? (
                          <span className="font-medium text-red-600 dark:text-red-400">{r.error}</span>
                        ) : (
                          <span className="text-emerald-600 dark:text-emerald-400">OK</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {invalidImportCount > 0 && (
              <p className="mb-3 text-sm text-amber-700 dark:text-amber-400">
                {invalidImportCount} baris bermasalah akan dilewati saat import.
              </p>
            )}

            {importProgress?.kind === "upload" ? (
              <div className="mb-4 space-y-2">
                <div className="flex justify-between text-xs font-semibold text-slate-600 dark:text-slate-400">
                  <span>Mengirim ke server</span>
                  <span>
                    {importProgress.processed} / {importProgress.total} baris
                  </span>
                </div>
                <div className="h-2.5 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-indigo-600 to-violet-600 transition-[width] duration-300 ease-out"
                    style={{
                      width: `${
                        importProgress.total > 0
                          ? Math.min(
                              100,
                              Math.round((importProgress.processed / importProgress.total) * 100),
                            )
                          : 0
                      }%`,
                    }}
                  />
                </div>
              </div>
            ) : null}

            <div className="flex justify-end gap-2">
              <button type="button" className="ui-btn ui-btn-ghost" onClick={() => setImportPreview(null)} disabled={importing}>
                Batal
              </button>
              <button
                type="button"
                className="ui-btn ui-btn-primary"
                onClick={confirmImport}
                disabled={importing || validImportCount === 0 || importExceedsQuota}
              >
                {importing ? "Mengimport..." : `Konfirmasi Import (${validImportCount} siswa)`}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {/* ═══ Modal: Hasil import (skipped) ═══ */}
      {importResult && (importResult.skipped.length > 0 || importResult.warnings.length > 0) ? (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/50 p-4">
          <div className="ui-card w-full max-w-3xl">
            <h3 className="ui-section-title mb-2">Hasil Import</h3>
            <p className="mb-1 text-sm text-emerald-700 dark:text-emerald-400">
              Berhasil: <strong>{importResult.imported}</strong> siswa diimport.
            </p>
            {importResult.skipped.length > 0 && (
              <p className="mb-1 text-sm text-red-600 dark:text-red-400">
                Dilewati: <strong>{importResult.skipped.length}</strong> baris.
              </p>
            )}
            {importResult.warnings.length > 0 && (
              <p className="mb-1 text-sm text-amber-700 dark:text-amber-400">
                Peringatan: <strong>{importResult.warnings.length}</strong> siswa memiliki NISN duplikat antar sekolah.
              </p>
            )}

            {importResult.skipped.length > 0 && (
              <div className="mb-4 mt-3 max-h-48 overflow-auto rounded-lg border dark:border-slate-700">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-slate-100 dark:bg-slate-800">
                    <tr>
                      <th className="px-3 py-2 text-left">Baris</th>
                      <th className="px-3 py-2 text-left">NISN</th>
                      <th className="px-3 py-2 text-left">Nama</th>
                      <th className="px-3 py-2 text-left">Alasan</th>
                    </tr>
                  </thead>
                  <tbody>
                    {importResult.skipped.map((sk, i) => (
                      <tr key={i}>
                        <td className="px-3 py-1.5">{sk.row}</td>
                        <td className="px-3 py-1.5">{sk.nisn}</td>
                        <td className="px-3 py-1.5">{sk.name}</td>
                        <td className="px-3 py-1.5 text-xs text-red-600 dark:text-red-400">{sk.reason}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {importResult.warnings.length > 0 && (
              <div className="mb-4 mt-3 max-h-48 overflow-auto rounded-lg border border-amber-200 dark:border-amber-700/50">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-amber-50 dark:bg-amber-900/30">
                    <tr>
                      <th className="px-3 py-2 text-left">Baris</th>
                      <th className="px-3 py-2 text-left">NISN</th>
                      <th className="px-3 py-2 text-left">Nama</th>
                      <th className="px-3 py-2 text-left">Peringatan</th>
                    </tr>
                  </thead>
                  <tbody>
                    {importResult.warnings.map((w, i) => (
                      <tr key={i}>
                        <td className="px-3 py-1.5">{w.row}</td>
                        <td className="px-3 py-1.5">{w.nisn}</td>
                        <td className="px-3 py-1.5">{w.name}</td>
                        <td className="px-3 py-1.5 text-xs text-amber-700 dark:text-amber-400">{w.message}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <div className="flex justify-end">
              <button type="button" className="ui-btn ui-btn-primary" onClick={() => setImportResult(null)}>
                Tutup
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {/* ═══ Modal: Edit siswa ═══ */}
      {editTarget ? (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/50 p-4">
          <div className="ui-card w-full max-w-lg">
            <h3 className="ui-section-title mb-4">Edit siswa</h3>
            <form onSubmit={handleEdit} className="space-y-3">
              <label className="ui-label">
                NISN
                <input name="nisn" defaultValue={editTarget.nisn} required className="ui-input mt-1" onChange={(e) => editNisn.checkNisn(e.target.value)} />
                <NisnWarningBanner message={editNisn.nisnWarning} />
              </label>
              <label className="ui-label">
                Nama
                <input name="name" defaultValue={editTarget.name} required className="ui-input mt-1" />
              </label>
              <label className="ui-label">
                Jenis Kelamin
                <select name="gender" defaultValue={editTarget.gender ?? "L"} className="ui-select mt-1">
                  <option value="L">L</option>
                  <option value="P">P</option>
                </select>
              </label>
              <label className="ui-label">
                Tempat Lahir
                <input name="birthPlace" defaultValue={editTarget.birthPlace ?? ""} className="ui-input mt-1" />
              </label>
              <label className="ui-label">
                Tanggal Lahir
                <input name="birthDate" type="date" defaultValue={editTarget.birthDate} required className="ui-input mt-1" />
              </label>
              <label className="ui-label">
                Kelas (teks)
                <input name="className" defaultValue={editTarget.className ?? ""} className="ui-input mt-1" />
              </label>
              <label className="ui-label">
                Link ke struktur kelas
                <select name="classRoomId" defaultValue={editTarget.classRoomId ?? ""} className="ui-select mt-1">
                  <option value="">— Tidak ada —</option>
                  {props.classRooms.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </label>
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" className="ui-btn ui-btn-ghost" onClick={() => setEditTarget(null)} disabled={busyAction}>Batal</button>
                <button type="submit" className="ui-btn ui-btn-primary" disabled={busyAction}>
                  {busyAction ? "Menyimpan..." : "Simpan"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {/* ═══ Modal: Konfirmasi hapus ═══ */}
      {deleteTarget ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
          <div className="ui-card w-full max-w-sm text-center">
            <h3 className="ui-section-title mb-2">Hapus siswa?</h3>
            <p className="ui-muted mb-4 text-sm">
              Data <strong>{deleteTarget.name}</strong> ({deleteTarget.nisn}) beserta seluruh nilainya akan dihapus permanen.
            </p>
            <div className="flex justify-center gap-3">
              <button type="button" className="ui-btn ui-btn-ghost" onClick={() => setDeleteTarget(null)} disabled={busyAction}>Batal</button>
              <button type="button" className="ui-btn bg-red-600 text-white hover:bg-red-700" onClick={handleDelete} disabled={busyAction}>
                {busyAction ? "Menghapus..." : "Ya, hapus"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
