"use client";

import { useCallback, useLayoutEffect, useRef } from "react";

const MAX_FONT_PX = 20;
const MIN_FONT_PX = 10;
const FONT_STEP = 0.5;
const LG_MEDIA = "(min-width: 1024px)";

function fitTitle(el: HTMLElement, avail: number) {
  el.style.wordBreak = "";
  el.style.overflowWrap = "";
  el.style.whiteSpace = "nowrap";
  el.style.overflow = "visible";
  el.style.textOverflow = "clip";

  let px = MAX_FONT_PX;
  let fits = false;
  while (px >= MIN_FONT_PX) {
    el.style.fontSize = `${px}px`;
    if (el.scrollWidth <= avail) {
      fits = true;
      break;
    }
    px -= FONT_STEP;
  }

  if (!fits) {
    el.style.fontSize = `${MIN_FONT_PX}px`;
    el.style.whiteSpace = "normal";
    el.style.overflowWrap = "anywhere";
    el.style.wordBreak = "break-word";
  }
}

export function GuruHeaderSchoolTitle({
  schoolLabel,
  accountLabel = null,
}: {
  schoolLabel: string;
  /** Ditampilkan setelah " - " hanya pada layar lg ke atas. */
  accountLabel?: string | null;
}) {
  const rowRef = useRef<HTMLDivElement>(null);
  const dotRef = useRef<HTMLSpanElement>(null);
  const compactRef = useRef<HTMLHeadingElement>(null);
  const expandedRef = useRef<HTMLHeadingElement>(null);

  const showAccount = Boolean(accountLabel?.trim());
  const expandedText = showAccount ? `${schoolLabel} - ${accountLabel!.trim()}` : schoolLabel;

  const fit = useCallback(() => {
    const row = rowRef.current;
    const dot = dotRef.current;
    if (!row) return;

    const dotW = dot?.offsetWidth ?? 0;
    const styles = getComputedStyle(row);
    const gapPx = parseFloat(styles.columnGap || styles.gap) || 10;
    const reserved = dotW + gapPx;
    const avail = Math.max(48, row.clientWidth - reserved);

    const isLg =
      typeof window !== "undefined" && window.matchMedia(LG_MEDIA).matches;

    const compact = compactRef.current;
    const expanded = expandedRef.current;

    if (compact) fitTitle(compact, avail);
    if (expanded && isLg && showAccount) fitTitle(expanded, avail);
    else if (expanded && isLg && !showAccount) fitTitle(expanded, avail);
  }, [schoolLabel, expandedText, showAccount]);

  useLayoutEffect(() => {
    fit();
  }, [fit]);

  useLayoutEffect(() => {
    const row = rowRef.current;
    if (!row || typeof ResizeObserver === "undefined") return undefined;
    const ro = new ResizeObserver(() => fit());
    ro.observe(row);
    return () => ro.disconnect();
  }, [fit]);

  useLayoutEffect(() => {
    if (typeof window === "undefined") return undefined;
    const mq = window.matchMedia(LG_MEDIA);
    const onChange = () => fit();
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [fit]);

  const titleClass =
    "m-0 min-w-0 flex-1 text-left font-bold leading-tight tracking-tight text-slate-800 dark:text-white";

  return (
    <div
      ref={rowRef}
      className="flex min-h-0 min-w-0 flex-1 items-center gap-2.5 self-center"
    >
      <span
        ref={dotRef}
        className="size-2.5 shrink-0 rounded-full bg-emerald-500 shadow-[0_0_0_2px_rgb(16_185_129/0.25)] dark:bg-emerald-400 dark:shadow-[0_0_0_2px_rgb(52_211_153/0.2)]"
        aria-hidden
      />
      <h1
        ref={compactRef}
        className={`${titleClass} lg:hidden`}
        style={{ fontSize: MAX_FONT_PX }}
      >
        {schoolLabel}
      </h1>
      <h1
        ref={expandedRef}
        className={`${titleClass} hidden lg:block`}
        style={{ fontSize: MAX_FONT_PX }}
        aria-hidden={!showAccount ? undefined : false}
      >
        {expandedText}
      </h1>
    </div>
  );
}
