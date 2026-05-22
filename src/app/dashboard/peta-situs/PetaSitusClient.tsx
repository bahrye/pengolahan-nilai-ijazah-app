"use client";

import { ChevronRight, ExternalLink, Info, LayoutGrid, Minus, TrendingUp } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";

import {
  ADMIN_FLOW_META,
  getAdminOnboardingFlow,
  getAdminSiteMapSections,
} from "@/lib/admin-site-map";
import {
  buildGuruOnboardingFlow,
  buildGuruSiteMapSections,
  GURU_FLOW_META,
} from "@/lib/guru-site-map";
import {
  SISWA_FLOW_META,
  SISWA_ONBOARDING_FLOW,
  SISWA_SITE_MAP_SECTIONS,
} from "@/lib/siswa-site-map";
import { isFreeAdminPath } from "@/lib/subscription/constants";
import { hasPremiumMenuAccess } from "@/lib/subscription/premium-access";
import { useSubscriptionUsage } from "@/components/subscription/SubscriptionUsageProvider";
import type { SiteMapFlowMeta, SiteMapFlowStep, SiteMapSection } from "@/lib/site-map-types";
import type { SchoolLevel } from "@prisma/client";

type TabId = "menu" | "flow";

export type PetaSitusVariant = "admin" | "guru" | "siswa";

export type PetaSitusClientProps = {
  variant: PetaSitusVariant;
  /** Hanya untuk variant guru — menu wali kelas mengikuti nilai ini. */
  isHomeroom?: boolean;
  schoolJenjang?: SchoolLevel | null;
  /** Untuk copy & konteks di variant admin (beda admin sekolah vs superadmin). */
  viewerRole?: "ADMIN_SEKOLAH" | "SUPERADMIN";
  /** Tab yang aktif saat pertama render (mis. admin sekolah: Panduan Flow). */
  initialTab?: TabId;
};

function resolveViewData(
  variant: PetaSitusVariant,
  isHomeroom: boolean,
  schoolJenjang: SchoolLevel | null,
) {
  if (variant === "admin") {
    return {
      sections: getAdminSiteMapSections(schoolJenjang),
      flowMeta: ADMIN_FLOW_META,
      flowSteps: getAdminOnboardingFlow(schoolJenjang),
      premiumGate: true,
    };
  }
  if (variant === "guru") {
    return {
      sections: buildGuruSiteMapSections(isHomeroom),
      flowMeta: GURU_FLOW_META,
      flowSteps: buildGuruOnboardingFlow(isHomeroom),
      premiumGate: false,
    };
  }
  return {
    sections: SISWA_SITE_MAP_SECTIONS,
    flowMeta: SISWA_FLOW_META,
    flowSteps: SISWA_ONBOARDING_FLOW,
    premiumGate: false,
  };
}

function PageDescription({
  variant,
  isHomeroom,
  viewerRole,
}: {
  variant: PetaSitusVariant;
  isHomeroom: boolean;
  viewerRole?: "ADMIN_SEKOLAH" | "SUPERADMIN";
}) {
  if (variant === "admin") {
    if (viewerRole === "ADMIN_SEKOLAH") {
      return (
        <>
          Panduan menu dan urutan kerja administrator. Untuk akun admin sekolah, halaman utama
          setelah login adalah Peta Situs (tab Panduan Flow). Pengaturan profil sekolah ada di{" "}
          <Link
            href="/dashboard/sekolah"
            className="font-semibold text-teal-800 underline dark:text-teal-400"
          >
            Data Sekolah
          </Link>
          .
        </>
      );
    }
    return (
      <>
        Panduan menu dan urutan kerja administrator. Halaman utama setelah login tetap{" "}
        <Link
          href="/dashboard/sekolah"
          className="font-semibold text-teal-800 underline dark:text-teal-400"
        >
          Data Sekolah
        </Link>
        .
      </>
    );
  }
  if (variant === "guru") {
    return (
      <>
        Menu yang tampil di sidebar akun guru Anda
        {isHomeroom ? " (termasuk peran wali kelas)" : ""}. Setelah login, halaman utama tetap{" "}
        <Link
          href="/dashboard/input/nilai-ujian"
          className="font-semibold text-teal-800 underline dark:text-teal-400"
        >
          Input Nilai Ujian
        </Link>
        .
      </>
    );
  }
  return (
    <>
      Menu portal siswa. Setelah login, halaman utama tetap{" "}
      <Link
        href="/dashboard/pengumuman"
        className="font-semibold text-teal-800 underline dark:text-teal-400"
      >
        Pengumuman
      </Link>
      .
    </>
  );
}

function SectionBlock({
  section,
  premiumGate,
}: {
  section: SiteMapSection;
  premiumGate: boolean;
}) {
  const usage = useSubscriptionUsage();
  const access = usage?.effectiveAccess ?? null;
  const premiumOk = access ? hasPremiumMenuAccess(access) : true;
  const Icon = section.icon;

  return (
    <section className="space-y-3">
      <div className="flex items-center gap-2.5">
        <span className="flex size-9 items-center justify-center rounded-lg bg-teal-800/10 text-teal-800 dark:bg-teal-400/15 dark:text-teal-300">
          <Icon className="size-[18px]" aria-hidden />
        </span>
        <h2 className="text-base font-bold text-slate-900 dark:text-white">{section.title}</h2>
        <span className="flex size-7 items-center justify-center rounded-full bg-teal-800 text-[12px] font-bold text-white dark:bg-teal-600">
          {section.items.length}
        </span>
      </div>

      <ul className="grid gap-2 sm:grid-cols-2">
        {section.items.map((item) => {
          const ItemIcon = item.icon;
          const needsPremium =
            premiumGate && !isFreeAdminPath(item.href) && !premiumOk;
          const inner = (
            <>
              <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-teal-800 dark:bg-emerald-950/50 dark:text-emerald-300">
                <ItemIcon className="size-5" aria-hidden />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block font-semibold text-slate-900 dark:text-white">{item.label}</span>
                <span className="mt-0.5 block text-[13px] leading-snug text-slate-500 dark:text-slate-400">
                  {item.description}
                </span>
              </span>
              <ChevronRight
                className="size-5 shrink-0 text-slate-300 dark:text-slate-600"
                aria-hidden
              />
            </>
          );

          if (needsPremium) {
            return (
              <li key={item.href}>
                <Link
                  href="/dashboard/langganan"
                  className="flex items-center gap-3 rounded-2xl border border-slate-200/90 bg-white px-4 py-3.5 shadow-sm transition hover:border-amber-300 hover:bg-amber-50/50 dark:border-slate-700 dark:bg-slate-900/60 dark:hover:border-amber-500/40"
                >
                  {inner}
                </Link>
              </li>
            );
          }

          return (
            <li key={item.href}>
              <Link
                href={item.href}
                className="flex items-center gap-3 rounded-2xl border border-slate-200/90 bg-white px-4 py-3.5 shadow-sm transition hover:border-teal-300 hover:shadow-md dark:border-slate-700 dark:bg-slate-900/60 dark:hover:border-teal-600/50"
              >
                {inner}
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function FlowPanel({
  flowMeta,
  steps,
}: {
  flowMeta: SiteMapFlowMeta;
  steps: SiteMapFlowStep[];
}) {
  const [expanded, setExpanded] = useState(true);
  const FlowIcon = flowMeta.icon;

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900/70">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full items-start gap-3 border-b border-slate-100 px-5 py-4 text-left transition hover:bg-slate-50/80 dark:border-slate-800 dark:hover:bg-slate-800/40"
        aria-expanded={expanded}
      >
        <span className="mt-0.5 text-slate-400">
          {expanded ? <Minus className="size-4" /> : <span className="text-lg leading-none">+</span>}
        </span>
        <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-teal-800 text-white dark:bg-teal-700">
          <FlowIcon className="size-5" aria-hidden />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-base font-bold text-slate-900 dark:text-white">
            {flowMeta.title}
          </span>
          <span className="mt-1 block text-[13px] leading-relaxed text-slate-500 dark:text-slate-400">
            {flowMeta.subtitle}
          </span>
        </span>
        <span className="shrink-0 rounded-full bg-teal-800 px-3 py-1 text-[12px] font-bold text-white dark:bg-teal-600">
          {steps.length} langkah
        </span>
      </button>

      {expanded ? (
        <div className="px-5 py-6 sm:px-8">
          <ol className="relative space-y-0">
            {steps.map((step, idx) => {
              const isLast = idx === steps.length - 1;
              return (
                <li key={step.order} className="relative flex gap-4 pb-10 last:pb-0">
                  {!isLast ? (
                    <span
                      className="absolute left-[15px] top-8 bottom-0 w-px bg-slate-200 dark:bg-slate-700"
                      aria-hidden
                    />
                  ) : null}
                  <span
                    className="relative z-[1] flex size-8 shrink-0 items-center justify-center rounded-full bg-teal-800 text-[13px] font-bold text-white shadow-sm dark:bg-teal-600"
                    aria-hidden
                  >
                    {step.order}
                  </span>
                  <div className="min-w-0 flex-1 pt-0.5">
                    <h3 className="text-[15px] font-bold text-slate-900 dark:text-white">
                      {step.title}
                    </h3>
                    <p className="mt-1 text-[13px] leading-relaxed text-slate-600 dark:text-slate-400">
                      {step.description}
                    </p>
                    {step.info ? (
                      <div className="mt-3 flex gap-2 rounded-xl border border-sky-200/90 bg-sky-50 px-3 py-2.5 text-[12px] leading-relaxed text-sky-900 dark:border-sky-500/30 dark:bg-sky-950/40 dark:text-sky-100">
                        <Info className="mt-0.5 size-4 shrink-0 text-sky-600 dark:text-sky-400" aria-hidden />
                        <span>{step.info}</span>
                      </div>
                    ) : null}
                    <Link
                      href={step.href}
                      className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-emerald-200/90 bg-emerald-50 px-3.5 py-2 text-[13px] font-semibold text-teal-900 transition hover:bg-emerald-100 dark:border-emerald-800/50 dark:bg-emerald-950/40 dark:text-emerald-200 dark:hover:bg-emerald-950/70"
                    >
                      <ExternalLink className="size-3.5" aria-hidden />
                      {step.buttonLabel}
                    </Link>
                  </div>
                </li>
              );
            })}
          </ol>
        </div>
      ) : null}
    </div>
  );
}

export function PetaSitusClient({
  variant,
  isHomeroom = false,
  schoolJenjang = null,
  initialTab = "menu",
  viewerRole,
}: PetaSitusClientProps) {
  const [tab, setTab] = useState<TabId>(initialTab);
  const { sections, flowMeta, flowSteps, premiumGate } = useMemo(
    () => resolveViewData(variant, isHomeroom, schoolJenjang),
    [variant, isHomeroom, schoolJenjang],
  );

  return (
    <div className="mx-auto w-full max-w-4xl space-y-6">
      <div>
        <h1 className="ui-page-title">Peta Situs</h1>
        <p className="ui-muted mt-1 text-pretty text-sm">
          <PageDescription
            variant={variant}
            isHomeroom={isHomeroom}
            viewerRole={viewerRole}
          />
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setTab("menu")}
          className={`inline-flex items-center gap-2 rounded-full px-4 py-2.5 text-[14px] font-semibold transition ${
            tab === "menu"
              ? "bg-teal-800 text-white shadow-md dark:bg-teal-700"
              : "bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50 dark:bg-slate-900 dark:text-slate-300 dark:ring-slate-700"
          }`}
        >
          <LayoutGrid className="size-4" aria-hidden />
          Daftar Menu
        </button>
        <button
          type="button"
          onClick={() => setTab("flow")}
          className={`inline-flex items-center gap-2 rounded-full px-4 py-2.5 text-[14px] font-semibold transition ${
            tab === "flow"
              ? "bg-teal-800 text-white shadow-md dark:bg-teal-700"
              : "bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50 dark:bg-slate-900 dark:text-slate-300 dark:ring-slate-700"
          }`}
        >
          <TrendingUp className="size-4" aria-hidden />
          Panduan Flow
        </button>
      </div>

      {tab === "menu" ? (
        <div className="space-y-8">
          {sections.map((section) => (
            <SectionBlock key={section.id} section={section} premiumGate={premiumGate} />
          ))}
        </div>
      ) : (
        <FlowPanel flowMeta={flowMeta} steps={flowSteps} />
      )}
    </div>
  );
}
