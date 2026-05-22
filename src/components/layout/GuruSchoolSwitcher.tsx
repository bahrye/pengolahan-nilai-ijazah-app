"use client";

import { ChevronDown } from "lucide-react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { useEffect, useId, useRef, useState } from "react";

import { useToast } from "@/components/ToastProvider";
import { switchGuruActiveSchoolAction } from "@/server/actions/guru-context";

import type { GuruSchoolContextRow } from "@/server/layout-data";

function resolveCurrentContext(
  contexts: GuruSchoolContextRow[],
  currentSessionSchoolId: string | null,
): GuruSchoolContextRow {
  const first = contexts[0];
  if (!first) {
    throw new Error("GuruSchoolSwitcher: konteks sekolah tidak boleh kosong.");
  }
  if (currentSessionSchoolId) {
    const hit = contexts.find((c) => c.schoolId === currentSessionSchoolId);
    if (hit) return hit;
  }
  return first;
}

function schoolNameOnly(c: GuruSchoolContextRow): string {
  return (c.namaSekolah ?? c.schoolId).trim() || c.schoolId;
}

function tierLabel(c: GuruSchoolContextRow): string {
  return c.isHome ? "Satminkal" : "Non-Satminkal";
}

export function GuruSchoolSwitcher(props: {
  contexts: GuruSchoolContextRow[];
  currentSessionSchoolId: string | null;
  /** Bilah samping / drawer: lebar penuh, tanpa caption kecil “Pilih sekolah”. */
  inSidebar?: boolean;
}) {
  const router = useRouter();
  const { update } = useSession();
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const listId = useId();

  useEffect(() => {
    if (!open) return undefined;
    const onDoc = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    window.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  if (props.contexts.length === 0) return null;

  const inSidebar = Boolean(props.inSidebar);

  const locked = props.contexts.length === 1;
  const current = resolveCurrentContext(props.contexts, props.currentSessionSchoolId);
  const selectedId =
    props.currentSessionSchoolId ?? props.contexts[0]?.schoolId ?? "";

  if (locked) {
    const name = schoolNameOnly(current);
    const tier = tierLabel(current);
    return (
      <div
        className={`flex min-h-9 min-w-0 w-full max-w-full items-center ${inSidebar ? "" : "sm:max-w-xs"}`}
      >
        <span
          className="min-w-0 truncate text-left text-xs font-semibold text-slate-800 dark:text-slate-100"
          title={`${tier} — hanya satu penugasan sekolah`}
          aria-label={`Sekolah aktif: ${name}. ${tier}.`}
        >
          {name}
        </span>
      </div>
    );
  }

  async function pickSchool(nextId: string) {
    if (busy) return;
    if (nextId === selectedId) {
      setOpen(false);
      return;
    }
    setBusy(true);
    const homeId = props.contexts.find((c) => c.isHome)?.schoolId ?? null;
    const payload = nextId === homeId ? null : nextId;
    const r = await switchGuruActiveSchoolAction(payload);
    setBusy(false);
    if (!r.ok) {
      toast(r.message, "error");
      return;
    }
    await update({});
    router.refresh();
    toast("Konteks sekolah diperbarui.", "success");
    setOpen(false);
  }

  const selectedName = schoolNameOnly(current);

  const captionId = `${listId}-caption`;

  const switcherButtonClass =
    "flex h-9 w-full min-w-0 flex-nowrap items-center justify-between gap-2 rounded-xl border border-slate-200/95 bg-white py-0 pl-3 pr-2 text-left text-xs font-medium text-slate-800 shadow-inner outline-none transition focus-visible:ring-2 focus-visible:ring-indigo-400/45 focus-visible:ring-offset-2 focus-visible:ring-offset-white enabled:cursor-pointer enabled:hover:border-indigo-300/80 dark:border-slate-600 dark:bg-slate-900/90 dark:text-slate-100 dark:focus-visible:ring-indigo-500/40 dark:focus-visible:ring-offset-slate-900 dark:enabled:hover:border-indigo-500/50";

  return (
    <div
      ref={rootRef}
      className={
        inSidebar
          ? "relative w-full min-w-0"
          : "relative flex min-w-0 w-full max-w-full flex-col gap-0.5 sm:max-w-xs"
      }
    >
      {inSidebar ? null : (
        <span
          id={captionId}
          className="text-[10px] font-semibold leading-snug text-slate-500 dark:text-slate-400"
        >
          Pilih sekolah
        </span>
      )}
      <button
        type="button"
        disabled={busy}
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-controls={open ? listId : undefined}
        aria-labelledby={inSidebar ? undefined : captionId}
        aria-label={
          inSidebar
            ? `Pilih sekolah aktif. Saat ini: ${selectedName}.`
            : undefined
        }
        className={switcherButtonClass}
        onClick={() => setOpen((v) => !v)}
      >
        <span className="min-w-0 flex-1 truncate">{selectedName}</span>
        <ChevronDown
          className={`size-4 shrink-0 text-slate-500 transition-transform dark:text-slate-400 ${open ? "rotate-180" : ""}`}
          aria-hidden
        />
      </button>
      {open ? (
        <ul
          id={listId}
          role="listbox"
          className="absolute left-0 right-0 top-full z-[60] mt-1 max-h-60 overflow-auto rounded-xl border border-slate-200/95 bg-[rgb(255_255_255/0.98)] py-1 shadow-lg shadow-slate-900/15 ring-1 ring-slate-900/5 dark:border-slate-600/95 dark:bg-slate-900 dark:shadow-black/40 dark:ring-white/10"
        >
          {props.contexts.map((c) => {
            const isSelected = c.schoolId === selectedId;
            const tier = tierLabel(c);
            return (
              <li
                key={c.schoolId}
                role="option"
                tabIndex={-1}
                aria-selected={isSelected}
                className={`cursor-pointer px-3 py-2.5 text-xs outline-none transition hover:bg-indigo-50 focus-visible:bg-indigo-50 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-indigo-400 dark:hover:bg-indigo-950/50 dark:focus-visible:bg-indigo-950/50 dark:focus-visible:ring-indigo-500/60 ${
                  isSelected ? "bg-indigo-50/90 dark:bg-indigo-950/35" : ""
                }`}
                onClick={() => {
                  if (busy) return;
                  void pickSchool(c.schoolId);
                }}
                onKeyDown={(e) => {
                  if (busy) return;
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    void pickSchool(c.schoolId);
                  }
                }}
              >
                <div className="flex flex-col items-start gap-0.5">
                  <span className="w-full truncate font-semibold text-slate-900 dark:text-white">
                    {schoolNameOnly(c)}
                  </span>
                  <span
                    className={`inline-flex max-w-full rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
                      c.isHome
                        ? "bg-emerald-100 text-emerald-900 dark:bg-emerald-900/50 dark:text-emerald-100"
                        : "bg-amber-100 text-amber-950 dark:bg-amber-900/45 dark:text-amber-100"
                    }`}
                  >
                    {tier}
                  </span>
                </div>
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}
