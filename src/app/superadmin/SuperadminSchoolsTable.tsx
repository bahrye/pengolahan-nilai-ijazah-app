"use client";

import { Check, ChevronDown, ChevronLeft, ChevronRight, LogIn, Users, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import type { SuperadminSchoolListItem } from "@/server/actions/superadmin";

const PAGE_SIZE = 10;

function GradeStatusIcon({ filled, label }: { filled: boolean; label: string }) {
  if (filled) {
    return (
      <span
        className="inline-flex items-center justify-center rounded-full bg-emerald-100 p-1 text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-300"
        title={`${label}: sudah ada nilai`}
      >
        <Check className="size-4" aria-hidden />
        <span className="sr-only">{label}: sudah ada nilai</span>
      </span>
    );
  }
  return (
    <span
      className="inline-flex items-center justify-center rounded-full bg-red-100 p-1 text-red-700 dark:bg-red-500/20 dark:text-red-300"
      title={`${label}: belum ada nilai`}
    >
      <X className="size-4" aria-hidden />
      <span className="sr-only">{label}: belum ada nilai</span>
    </span>
  );
}

type ActionItem = {
  label: string;
  onClick: () => void;
  tone?: "default" | "primary" | "success" | "warning";
  icon?: React.ReactNode;
  disabledLabel?: string;
};

function SchoolActionMenu(props: {
  busy: boolean;
  entering: boolean;
  items: ActionItem[];
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const disabled = props.busy || props.entering;

  function toneClass(tone: ActionItem["tone"]) {
    if (tone === "warning") {
      return "text-amber-700 hover:bg-amber-50 dark:text-amber-400 dark:hover:bg-amber-950/40";
    }
    if (tone === "success") {
      return "text-emerald-700 hover:bg-emerald-50 dark:text-emerald-400 dark:hover:bg-emerald-950/40";
    }
    if (tone === "primary") {
      return "text-indigo-700 hover:bg-indigo-50 dark:text-indigo-300 dark:hover:bg-indigo-950/40";
    }
    return "text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-800";
  }

  return (
    <div ref={rootRef} className="relative inline-block text-left">
      <button
        type="button"
        disabled={disabled}
        className="ui-btn ui-btn-ghost ui-btn-sm inline-flex items-center gap-1"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        Aksi
        <ChevronDown className="size-3.5 opacity-70" aria-hidden />
      </button>
      {open ? (
        <div
          role="menu"
          className="absolute right-0 z-20 mt-1 min-w-[10.5rem] overflow-hidden rounded-xl border border-slate-200 bg-white py-1 shadow-lg dark:border-slate-700 dark:bg-slate-900"
        >
          {props.items.map((item) => (
            <button
              key={item.label}
              type="button"
              role="menuitem"
              disabled={disabled}
              className={`flex w-full items-center gap-2 px-3 py-2 text-left text-sm disabled:opacity-50 ${toneClass(item.tone)}`}
              onClick={() => {
                setOpen(false);
                item.onClick();
              }}
            >
              {item.icon}
              {props.entering && item.disabledLabel ? item.disabledLabel : item.label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function PaginationBar({
  page,
  totalPages,
  totalItems,
  onPrev,
  onNext,
}: {
  page: number;
  totalPages: number;
  totalItems: number;
  onPrev: () => void;
  onNext: () => void;
}) {
  if (totalPages <= 1) return null;

  const start = (page - 1) * PAGE_SIZE + 1;
  const end = Math.min(page * PAGE_SIZE, totalItems);

  return (
    <div className="flex items-center justify-between gap-3 border-t border-slate-200/80 px-3 py-2.5 dark:border-slate-700/60">
      <span className="text-xs text-slate-500 dark:text-slate-400">
        {start}–{end} dari {totalItems} sekolah
      </span>
      <div className="flex items-center gap-1.5">
        <button
          type="button"
          disabled={page <= 1}
          onClick={onPrev}
          className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-40 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
        >
          <ChevronLeft className="size-3.5" aria-hidden />
          Prev
        </button>
        <span className="min-w-[3.5rem] rounded-lg bg-slate-100 px-2 py-1.5 text-center text-xs font-bold tabular-nums text-slate-700 dark:bg-slate-700 dark:text-slate-200">
          {page} / {totalPages}
        </span>
        <button
          type="button"
          disabled={page >= totalPages}
          onClick={onNext}
          className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-40 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
        >
          Next
          <ChevronRight className="size-3.5" aria-hidden />
        </button>
      </div>
    </div>
  );
}

export function SuperadminSchoolsTable(props: {
  schools: SuperadminSchoolListItem[];
  variant: "active" | "inactive";
  emptyMessage: string;
  busy: boolean;
  enteringSchoolId: string | null;
  onAccounts: (school: SuperadminSchoolListItem) => void;
  onEnter?: (schoolId: string) => void;
  onDeactivate?: (schoolId: string) => void;
  onActivate?: (schoolId: string) => void;
  /** Jika true, tampilkan paginasi per 10 sekolah. */
  paginated?: boolean;
}) {
  const [page, setPage] = useState(1);
  const rowClass =
    props.variant === "inactive" ? "opacity-80" : undefined;

  // Reset ke halaman 1 jika data berubah
  useEffect(() => {
    setPage(1);
  }, [props.schools.length]);

  const totalPages = props.paginated
    ? Math.max(1, Math.ceil(props.schools.length / PAGE_SIZE))
    : 1;
  const displaySchools = props.paginated
    ? props.schools.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)
    : props.schools;

  // Pastikan page valid
  const safePage = Math.min(page, totalPages);
  if (safePage !== page) setPage(safePage);

  return (
    <div className="ui-table-shell min-w-0 overflow-hidden">
      <div className="overflow-x-auto subtle-scrollbar">
        <table className="rekap-table w-full min-w-[56rem] text-sm">
          <thead>
            <tr>
              <th className="text-left">Sekolah</th>
              <th className="text-left">Jenjang</th>
              <th className="text-left">NPSN</th>
              <th className="text-left">Tanggal registrasi</th>
              <th className="text-center">Siswa</th>
              <th className="text-center">Kelas</th>
              <th className="text-center">Ujian</th>
              <th className="text-center">Rapor</th>
              <th className="text-right">Aksi</th>
            </tr>
          </thead>
          <tbody>
            {displaySchools.length === 0 ? (
              <tr>
                <td colSpan={9} className="px-4 py-8 text-center text-slate-500">
                  {props.emptyMessage}
                </td>
              </tr>
            ) : (
              displaySchools.map((s) => {
                const items: ActionItem[] =
                  props.variant === "active"
                    ? [
                        {
                          label: "Akun admin",
                          icon: <Users className="size-4 shrink-0 opacity-70" aria-hidden />,
                          onClick: () => props.onAccounts(s),
                        },
                        {
                          label: "Masuk sekolah",
                          disabledLabel: "Masuk…",
                          icon: <LogIn className="size-4 shrink-0 opacity-70" aria-hidden />,
                          tone: "primary",
                          onClick: () => props.onEnter?.(s.id),
                        },
                        {
                          label: "Nonaktifkan",
                          tone: "warning",
                          onClick: () => props.onDeactivate?.(s.id),
                        },
                      ]
                    : [
                        {
                          label: "Akun admin",
                          icon: <Users className="size-4 shrink-0 opacity-70" aria-hidden />,
                          onClick: () => props.onAccounts(s),
                        },
                        {
                          label: "Aktifkan",
                          tone: "success",
                          onClick: () => props.onActivate?.(s.id),
                        },
                      ];

                return (
                  <tr key={s.id} className={rowClass}>
                    <td className="max-w-[14rem] text-left font-medium text-slate-800 dark:text-slate-100">
                      <div className="overflow-x-auto whitespace-nowrap subtle-scrollbar" style={{ maxWidth: "14rem" }}>
                        {s.namaSekolah?.trim() || "—"}
                      </div>
                    </td>
                    <td className="text-left">{s.jenjang ?? "—"}</td>
                    <td className="text-left font-mono text-xs tabular-nums">
                      {s.npsn?.trim() || "—"}
                    </td>
                    <td className="whitespace-normal text-left text-xs leading-snug">
                      {s.registeredAtLabel}
                    </td>
                    <td className="text-center tabular-nums">{s.studentCount}</td>
                    <td className="text-center tabular-nums">{s.classRoomCount}</td>
                    <td className="text-center">
                      <GradeStatusIcon filled={s.hasUjianGrade} label="Ujian" />
                    </td>
                    <td className="text-center">
                      <GradeStatusIcon filled={s.hasRaporGrade} label="Rapor" />
                    </td>
                    <td className="text-right">
                      <SchoolActionMenu
                        busy={props.busy}
                        entering={props.enteringSchoolId === s.id}
                        items={items}
                      />
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
      {props.paginated && (
        <PaginationBar
          page={page}
          totalPages={totalPages}
          totalItems={props.schools.length}
          onPrev={() => setPage((p) => Math.max(1, p - 1))}
          onNext={() => setPage((p) => Math.min(totalPages, p + 1))}
        />
      )}
    </div>
  );
}
