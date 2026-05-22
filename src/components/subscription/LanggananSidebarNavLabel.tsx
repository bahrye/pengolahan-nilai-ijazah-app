"use client";

import { useEffect, useState } from "react";

import { useSubscriptionUsage } from "@/components/subscription/SubscriptionUsageProvider";
import { buildLanggananSidebarLabel } from "@/lib/subscription/langganan-nav-label";
import type { SchoolAccessSnapshot } from "@/lib/subscription/types";

type Props = {
  /** Fallback saat di luar SubscriptionUsageProvider. */
  access?: SchoolAccessSnapshot | null;
  className?: string;
};

/**
 * Label menu sidebar «Langganan» dengan hitung mundur sisa trial / langganan / kuota harian.
 */
export function LanggananSidebarNavLabel({ access: accessProp, className }: Props) {
  const usage = useSubscriptionUsage();
  const access = usage?.effectiveAccess ?? accessProp ?? null;
  const remainingSecondsDaily = usage?.remainingSeconds;

  const [nowMs, setNowMs] = useState(() => Date.now());

  useEffect(() => {
    const id = window.setInterval(() => setNowMs(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  const label = buildLanggananSidebarLabel(access, {
    remainingSecondsDaily,
    nowMs,
  });

  return (
    <span className={className} title={label}>
      {label}
    </span>
  );
}
