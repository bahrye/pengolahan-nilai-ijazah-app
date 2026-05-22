"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";

type ToastType = "success" | "error" | "info" | "warning";

export interface Toast {
  id: number;
  message: string;
  type: ToastType;
  /** Jika true, toast tidak auto-hilang sampai persistent dihapus. */
  persistent?: boolean;
  /** Progres nyata (current = selesai, total = target). */
  progress?: { current: number; total: number };
}

export interface ProgressToastHandle {
  update: (current: number, detail?: string) => void;
  success: (message: string) => void;
  error: (message: string) => void;
}

interface ToastCtx {
  toast: (message: string, type?: ToastType) => void;
  progressToast: (opts: { total: number; title?: string }) => ProgressToastHandle;
}

const Ctx = createContext<ToastCtx>({
  toast: () => {},
  progressToast: () => ({
    update: () => {},
    success: () => {},
    error: () => {},
  }),
});

export function useToast() {
  return useContext(Ctx);
}

const DISMISS_MS = 4500;

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const counter = useRef(0);

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const toast = useCallback((message: string, type: ToastType = "success") => {
    const id = ++counter.current;
    setToasts((prev) => [...prev, { id, message, type }]);
  }, []);

  const progressToast = useCallback(
    (opts: { total: number; title?: string }): ProgressToastHandle => {
      const id = ++counter.current;
      const total = Math.max(1, opts.total);
      const title = opts.title ?? "Memproses…";
      setToasts((prev) => [
        ...prev,
        {
          id,
          message: title,
          type: "info",
          persistent: true,
          progress: { current: 0, total },
        },
      ]);
      return {
        update: (current: number, detail?: string) => {
          const c = Math.min(Math.max(0, current), total);
          setToasts((prev) =>
            prev.map((t) =>
              t.id === id
                ? {
                    ...t,
                    progress: { current: c, total },
                    ...(detail !== undefined ? { message: detail } : {}),
                  }
                : t,
            ),
          );
        },
        success: (message: string) => {
          setToasts((prev) =>
            prev.map((t) =>
              t.id === id
                ? {
                    ...t,
                    message,
                    type: "success",
                    persistent: false,
                    progress: undefined,
                  }
                : t,
            ),
          );
        },
        error: (message: string) => {
          setToasts((prev) =>
            prev.map((t) =>
              t.id === id
                ? {
                    ...t,
                    message,
                    type: "error",
                    persistent: false,
                    progress: undefined,
                  }
                : t,
            ),
          );
        },
      };
    },
    [],
  );

  return (
    <Ctx.Provider value={{ toast, progressToast }}>
      {children}
      <ToastContainer toasts={toasts} dismiss={dismiss} />
    </Ctx.Provider>
  );
}

function ToastContainer({
  toasts,
  dismiss,
}: {
  toasts: Toast[];
  dismiss: (id: number) => void;
}) {
  return (
    <div
      aria-live="polite"
      className="pointer-events-none fixed right-0 top-0 z-[9999] flex max-h-[100dvh] flex-col items-end gap-2 overflow-y-auto overscroll-contain p-3 pt-[max(0.75rem,env(safe-area-inset-top))] pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:p-4"
    >
      {toasts.map((t) => (
        <ToastItem key={t.id} toast={t} dismiss={dismiss} />
      ))}
    </div>
  );
}

function ToastItem({
  toast: t,
  dismiss,
}: {
  toast: Toast;
  dismiss: (id: number) => void;
}) {
  const [exiting, setExiting] = useState(false);

  useEffect(() => {
    setExiting(false);
  }, [t.id]);

  useEffect(() => {
    if (t.persistent) return undefined;
    const fadeTimer = setTimeout(() => setExiting(true), DISMISS_MS - 400);
    const removeTimer = setTimeout(() => dismiss(t.id), DISMISS_MS);
    return () => {
      clearTimeout(fadeTimer);
      clearTimeout(removeTimer);
    };
  }, [t.id, t.persistent, t.type, t.message, dismiss]);

  const colors: Record<ToastType, string> = {
    success:
      "border-emerald-300 bg-emerald-50 text-emerald-900 dark:border-emerald-600 dark:bg-emerald-950/80 dark:text-emerald-200",
    error:
      "border-red-300 bg-red-50 text-red-900 dark:border-red-600 dark:bg-red-950/80 dark:text-red-200",
    warning:
      "border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-600 dark:bg-amber-950/80 dark:text-amber-200",
    info: "border-indigo-300 bg-indigo-50 text-indigo-900 dark:border-indigo-600 dark:bg-indigo-950/80 dark:text-indigo-200",
  };

  const icons: Record<ToastType, string> = {
    success: "✓",
    error: "✕",
    warning: "⚠",
    info: "ℹ",
  };

  const pct =
    t.progress && t.progress.total > 0
      ? Math.min(100, Math.round((t.progress.current / t.progress.total) * 100))
      : 0;

  return (
    <div
      role="status"
      className={`pointer-events-auto flex w-[min(100vw-1.5rem,22rem)] flex-col gap-2 rounded-xl border px-4 py-3 text-sm shadow-lg backdrop-blur-sm transition-all duration-300 sm:w-[min(100vw-2rem,24rem)] ${
        colors[t.type]
      } ${exiting ? "translate-x-4 opacity-0" : "translate-x-0 opacity-100"}`}
    >
      <div className="flex items-start gap-2.5">
        <span className="mt-0.5 shrink-0 text-base font-bold leading-none">{icons[t.type]}</span>
        <span className="min-w-0 flex-1 whitespace-pre-line leading-snug">{t.message}</span>
        <button
          type="button"
          onClick={() => dismiss(t.id)}
          className="ml-1 mt-0.5 shrink-0 text-current opacity-50 hover:opacity-100"
          aria-label="Tutup"
        >
          ×
        </button>
      </div>
      {t.progress ? (
        <div className="flex flex-col gap-1.5 pl-7">
          <div className="flex items-center justify-between gap-2 text-[11px] font-semibold tabular-nums opacity-90">
            <span>
              {t.progress.current} / {t.progress.total} selesai
            </span>
            <span>{pct}%</span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-black/10 dark:bg-white/15">
            <div
              className="h-full rounded-full bg-indigo-600 transition-[width] duration-200 ease-out dark:bg-indigo-400"
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}
