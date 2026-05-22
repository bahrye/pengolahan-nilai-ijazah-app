"use client";

import { AnimatePresence, motion } from "framer-motion";
import {
  ChevronDown,
  Download,
  FileSpreadsheet,
  LayoutDashboard,
  LockKeyhole,
  Map,
  Megaphone,
  Menu,
  Send,
  Sparkles,
  Stamp,
  X,
  Crown,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { SignOutButton } from "@/components/auth/SignOutButton";
import { SuperadminImpersonationBanner } from "@/components/layout/SuperadminImpersonationBanner";
import { ThemeToggle } from "@/components/ThemeToggle";
import { GuruHeaderSchoolTitle } from "@/components/layout/GuruHeaderSchoolTitle";
import { GuruSchoolSwitcher } from "@/components/layout/GuruSchoolSwitcher";
import { ADMIN_SIDEBAR_NAV_SECTIONS } from "@/lib/admin-site-map";
import { buildGuruNavMenuItems } from "@/lib/guru-nav-items";
import { headerAccountDisplayLabel } from "@/lib/header-account-label";
import { displayStudentLoginEmail } from "@/lib/student-login";
import { isFreeAdminPath } from "@/lib/subscription/constants";
import { hasPremiumMenuAccess } from "@/lib/subscription/premium-access";
import { LanggananSidebarNavLabel } from "@/components/subscription/LanggananSidebarNavLabel";
import { SubscriptionAccessBanner } from "@/components/subscription/SubscriptionAccessBanner";
import { useSubscriptionUsage } from "@/components/subscription/SubscriptionUsageProvider";

import type { AdminSidebarNavSection } from "@/lib/admin-site-map";
import type { GuruSchoolContextRow } from "@/server/layout-data";
import type { SchoolAccessSnapshot } from "@/lib/subscription/types";
import type { UserRole } from "@prisma/client";
import type { LucideIcon } from "lucide-react";

export type DashboardUserCtx = {
  email: string | null;
  /** Nama tampilan (siswa / guru); untuk drawer & header. */
  name: string | null;
  role: UserRole;
  image: string | null;
  isHomeroom?: boolean;
  activeSchoolId?: string | null;
  effectiveSchoolId?: string | null;
  guruSchoolContexts?: GuruSchoolContextRow[] | null;
  /** Teks utama header (nama sekolah / judul). */
  headerPrimaryLabel: string;
  subscriptionAccess?: SchoolAccessSnapshot | null;
  impersonatingSchoolId?: string | null;
};

type NavItem =
  | { href: string; label: string; icon: LucideIcon }
  | {
      label: string;
      icon: LucideIcon;
      children: { href: string; label: string }[];
    };

const LANGGANAN_HREF = "/dashboard/langganan";
const PREMIUM_NAV_DOUBLE_CLICK_MS = 450;

function PremiumNavItem({
  className,
  title,
  onNavigate,
  children,
}: {
  className: string;
  title?: string;
  onNavigate?: () => void;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const lastClickRef = useRef(0);

  return (
    <span
      role="button"
      tabIndex={0}
      className={className}
      title={title ?? "Fitur premium — klik dua kali untuk membuka Langganan"}
      onClick={() => {
        const now = Date.now();
        if (now - lastClickRef.current < PREMIUM_NAV_DOUBLE_CLICK_MS) {
          onNavigate?.();
          router.push(LANGGANAN_HREF);
          lastClickRef.current = 0;
        } else {
          lastClickRef.current = now;
        }
      }}
      onKeyDown={(e) => {
        if (e.key !== "Enter" && e.key !== " ") return;
        e.preventDefault();
        const now = Date.now();
        if (now - lastClickRef.current < PREMIUM_NAV_DOUBLE_CLICK_MS) {
          onNavigate?.();
          router.push(LANGGANAN_HREF);
          lastClickRef.current = 0;
        } else {
          lastClickRef.current = now;
        }
      }}
    >
      {children}
    </span>
  );
}

function roleNav(role: UserRole, isHomeroom?: boolean): NavItem[] {
  if (role === "GURU") {
    return buildGuruNavMenuItems(isHomeroom ?? false).map((item) => ({
      href: item.href,
      label: item.label,
      icon: item.icon,
    }));
  }
  if (role === "SISWA") {
    return [
      { href: "/dashboard/peta-situs", label: "Peta Situs", icon: Map },
      {
        href: "/dashboard/pengumuman",
        label: "Pengumuman",
        icon: Megaphone,
      },
      {
        href: "/dashboard/rekap-nilai-ijazah",
        label: "Rekap Nilai Ijazah",
        icon: FileSpreadsheet,
      },
      {
        href: "/dashboard/skl-unduh",
        label: "Unduh SKL",
        icon: Download,
      },
    ];
  }
  return [];
}

function isAdminRole(role: UserRole): boolean {
  return role === "ADMIN_SEKOLAH" || role === "SUPERADMIN";
}

function isHrefPremium(
  href: string,
  access: SchoolAccessSnapshot | null | undefined,
): boolean {
  if (!access || hasPremiumMenuAccess(access)) return false;
  return !isFreeAdminPath(href);
}

function isNavItemPremium(
  item: NavItem,
  access: SchoolAccessSnapshot | null | undefined,
): boolean {
  if (!access || hasPremiumMenuAccess(access)) return false;
  if ("children" in item) {
    return item.children.every((c) => isHrefPremium(c.href, access));
  }
  return isHrefPremium(item.href, access);
}

function NavLinkItem({
  href,
  label,
  icon: Icon,
  pathname,
  subscriptionAccess,
  onNavigate,
  itemKey,
}: {
  href: string;
  label: string;
  icon: LucideIcon;
  pathname: string;
  subscriptionAccess?: SchoolAccessSnapshot | null;
  onNavigate?: () => void;
  itemKey: string;
}) {
  const premium = isHrefPremium(href, subscriptionAccess);
  const active = pathname === href || pathname.startsWith(`${href}/`);
  const isLangganan = href === LANGGANAN_HREF;

  const labelContent =
    isLangganan && subscriptionAccess ? (
      <LanggananSidebarNavLabel
        access={subscriptionAccess}
        className="min-w-0 truncate text-left"
      />
    ) : (
      label
    );

  if (premium) {
    return (
      <PremiumNavItem
        key={itemKey}
        className="nav-item cursor-not-allowed opacity-55"
        onNavigate={onNavigate}
      >
        <Icon className="size-4 shrink-0 opacity-95" />
        {labelContent}
        <Crown className="ml-auto size-3.5 shrink-0 text-amber-400" aria-hidden />
      </PremiumNavItem>
    );
  }

  return (
    <Link
      key={itemKey}
      href={href}
      onClick={() => onNavigate?.()}
      className={`nav-item ${active ? "nav-item-active" : ""}`}
    >
      <Icon className="size-4 shrink-0 opacity-95" />
      {labelContent}
    </Link>
  );
}

function NavLinks({
  items,
  sections,
  pathname,
  subscriptionAccess,
  onNavigate,
}: {
  items?: NavItem[];
  sections?: AdminSidebarNavSection[];
  pathname: string;
  subscriptionAccess?: SchoolAccessSnapshot | null;
  onNavigate?: () => void;
}) {
  const [inputOpen, setInputOpen] = useState(() =>
    pathname.startsWith("/dashboard/input"),
  );

  if (sections && sections.length > 0) {
    return (
      <nav className="flex flex-col gap-1 p-3">
        {sections.map((section, sectionIdx) => (
          <div
            key={section.id}
            className={sectionIdx > 0 ? "mt-2 border-t border-white/8 pt-2" : ""}
          >
            <p className="px-3 pb-1.5 pt-1 text-[10px] font-bold uppercase tracking-[0.14em] text-indigo-200/75 capitalize">
              {section.title}
            </p>
            <div className="flex flex-col gap-0.5">
              {section.items.map((item) => (
                <NavLinkItem
                  key={item.href}
                  itemKey={item.href}
                  href={item.href}
                  label={item.label}
                  icon={item.icon}
                  pathname={pathname}
                  subscriptionAccess={subscriptionAccess}
                  onNavigate={onNavigate}
                />
              ))}
            </div>
          </div>
        ))}
      </nav>
    );
  }

  const flatItems = items ?? [];

  return (
    <nav className="flex flex-col gap-0.5 p-3">
      {flatItems.map((item, idx) => {
        const premium = isNavItemPremium(item, subscriptionAccess);

        if ("children" in item) {
          const submenuActive = item.children.some(
            (c) => pathname === c.href || pathname.startsWith(`${c.href}/`),
          );
          const open = inputOpen || submenuActive;

          if (premium) {
            return (
              <PremiumNavItem
                key={item.label}
                className="nav-item cursor-not-allowed opacity-55"
                onNavigate={onNavigate}
              >
                <item.icon className="size-4 shrink-0 opacity-95" />
                {item.label}
                <Crown className="ml-auto size-3.5 shrink-0 text-amber-400" aria-hidden />
              </PremiumNavItem>
            );
          }

          return (
            <div key={item.label} className="py-0.5">
              <button
                type="button"
                onClick={() => setInputOpen(!inputOpen)}
                className={`flex w-full items-center justify-between gap-2 px-3 py-2 ${open ? "nav-item nav-item-active" : "nav-item"}`}
                aria-expanded={open}
              >
                <span className="flex items-center gap-2.5">
                  <item.icon className="size-4 shrink-0 opacity-95" />
                  {item.label}
                </span>
                <ChevronDown
                  className={`size-4 shrink-0 opacity-80 transition-transform ${open ? "rotate-180" : ""}`}
                />
              </button>
              <AnimatePresence initial={false}>
                {open ? (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.22 }}
                    className="overflow-hidden pl-2"
                  >
                    <div className="flex flex-col gap-0.5 border-l border-white/10 py-2 pl-2">
                      {item.children.map((c) => {
                        const childPremium = isHrefPremium(c.href, subscriptionAccess);
                        if (childPremium) {
                          return (
                            <PremiumNavItem
                              key={c.href}
                              className="nav-subitem flex cursor-not-allowed items-center gap-2 opacity-55"
                              onNavigate={onNavigate}
                            >
                              {c.label}
                              <Crown className="ml-auto size-3 shrink-0 text-amber-400" aria-hidden />
                            </PremiumNavItem>
                          );
                        }
                        return (
                          <Link
                            key={c.href}
                            href={c.href}
                            onClick={() => onNavigate?.()}
                            className={`nav-subitem ${pathname === c.href ? "nav-item-active !rounded-lg" : ""}`}
                          >
                            {c.label}
                          </Link>
                        );
                      })}
                    </div>
                  </motion.div>
                ) : null}
              </AnimatePresence>
            </div>
          );
        }
        return (
          <NavLinkItem
            key={item.href ?? String(idx)}
            itemKey={item.href ?? String(idx)}
            href={item.href}
            label={item.label}
            icon={item.icon}
            pathname={pathname}
            subscriptionAccess={subscriptionAccess}
            onNavigate={onNavigate}
          />
        );
      })}
    </nav>
  );
}

function SidebarBrandBlock({ roleBadge }: { roleBadge: string }) {
  return (
    <>
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-8 top-0 h-48 rounded-full bg-indigo-500/15 blur-[64px]"
      />
      <div className="relative border-b border-white/5 p-5">
        <div className="flex items-start gap-3">
          <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 via-violet-600 to-teal-500 shadow-lg shadow-indigo-950/45 ring-4 ring-white/5">
            <Sparkles className="size-[22px] text-white" />
          </span>
          <div className="min-w-0">
            <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-indigo-200/85">
              Ijazah
            </div>
            <div className="truncate text-[15px] font-bold tracking-tight text-white">
              Sistem Nilai
            </div>
            <span className="mt-2 inline-flex max-w-full truncate rounded-full border border-white/10 bg-white/5 px-2.5 py-0.5 text-[11px] font-semibold text-slate-200/90 backdrop-blur">
              {roleBadge}
            </span>
          </div>
        </div>
        <p className="mt-3 text-[12px] leading-relaxed text-slate-400">
          Kontrol akademik dalam satu workspace rapi dan ringkas.
        </p>
      </div>
    </>
  );
}

function GuruSidebarSchoolPicker({
  contexts,
  currentSessionSchoolId,
}: {
  contexts: GuruSchoolContextRow[];
  currentSessionSchoolId: string | null;
}) {
  return (
    <div className="border-b border-white/5 px-4 py-3">
      <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-emerald-300/95 dark:text-emerald-400/95">
        Pilih Sekolah Aktif
      </p>
      <div className="mt-2 rounded-xl border border-white/10 bg-[rgb(255_255_255/0.96)] p-2 shadow-lg shadow-black/25 ring-1 ring-black/5 dark:border-white/10 dark:bg-slate-950/95 dark:ring-white/10">
        <GuruSchoolSwitcher
          contexts={contexts}
          currentSessionSchoolId={currentSessionSchoolId}
          inSidebar
        />
      </div>
    </div>
  );
}

export function DashboardShell({
  ctx,
  children,
}: {
  ctx: DashboardUserCtx;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const usage = useSubscriptionUsage();
  const subscriptionAccess = usage?.effectiveAccess ?? ctx.subscriptionAccess;
  const actsAsSchoolAdmin =
    ctx.role === "ADMIN_SEKOLAH" ||
    (ctx.role === "SUPERADMIN" && !!ctx.impersonatingSchoolId);
  const adminNav = actsAsSchoolAdmin || isAdminRole(ctx.role);
  const nav = adminNav ? undefined : roleNav(ctx.role, ctx.isHomeroom);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!mobileOpen) return undefined;

    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = prev;
    };
  }, [mobileOpen]);

  const roleBadge = actsAsSchoolAdmin
    ? "Admin Sekolah"
    : ctx.role === "SUPERADMIN"
      ? "Superadmin"
      : ctx.role === "GURU"
        ? "Guru"
        : ctx.role === "SISWA"
          ? "Siswa"
          : ctx.role;

  const guruSchoolContexts = ctx.guruSchoolContexts ?? [];
  const guruSchoolPanel =
    ctx.role === "GURU" && guruSchoolContexts.length >= 1;
  const guruMultiSchool =
    guruSchoolPanel && guruSchoolContexts.length > 1;


  return (
    <div className="relative flex w-full max-w-full min-h-[100dvh] min-h-0 flex-1 flex-col overflow-x-hidden md:flex-row">
      {/* Desktop sidebar — tidak ikut flex row di ponsel */}
      <aside className="relative hidden w-[17.5rem] shrink-0 flex-col overflow-hidden border-r border-white/5 bg-gradient-to-b from-[#070b14] via-[#0c1224] to-[#060911] md:flex">
        <SidebarBrandBlock roleBadge={roleBadge} />
        {guruMultiSchool ? (
          <GuruSidebarSchoolPicker
            contexts={guruSchoolContexts}
            currentSessionSchoolId={ctx.effectiveSchoolId ?? null}
          />
        ) : null}
        <div className="custom-scrollbar relative flex min-h-0 flex-1 flex-col overflow-y-auto pb-6">
          <NavLinks
            sections={adminNav ? ADMIN_SIDEBAR_NAV_SECTIONS : undefined}
            items={nav}
            pathname={pathname}
            subscriptionAccess={subscriptionAccess}
          />
        </div>
      </aside>

      {/* Kolom utama: full width di ponsel */}
      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-x-hidden">
        {ctx.role === "SUPERADMIN" && ctx.impersonatingSchoolId ? (
          <SuperadminImpersonationBanner schoolName={ctx.headerPrimaryLabel} />
        ) : null}
        <header className="sticky top-0 z-30 shrink-0 overflow-visible border-b border-white/70 bg-[rgb(255_255_255/0.78)] backdrop-blur-xl backdrop-saturate-150 shadow-[0_1px_0_rgb(226_232_240/0.7)] dark:border-slate-700/60 dark:bg-[rgb(15_23_42/0.95)] dark:shadow-[inset_0_-1px_0_rgb(148_163_184/0.12)]">
          <div className="flex min-h-12 flex-row items-center gap-3 px-3 py-3 sm:min-h-14 sm:gap-4 sm:px-5 lg:px-10">
            <button
              type="button"
              className="ui-btn ui-btn-ghost ui-btn-sm shrink-0 self-center text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-white/10 md:!hidden"
              aria-expanded={mobileOpen}
              aria-controls="mobile-drawer-nav"
              aria-label="Buka menu navigasi"
              onClick={() => setMobileOpen(true)}
            >
              <Menu className="size-5" />
            </button>
            <GuruHeaderSchoolTitle
              schoolLabel={ctx.headerPrimaryLabel}
              accountLabel={headerAccountDisplayLabel(ctx.role, ctx.name)}
            />
            <div className="flex shrink-0 items-center gap-2 self-center sm:gap-2.5">
              {ctx.image ? (
                <Image
                  src={ctx.image}
                  alt=""
                  width={36}
                  height={36}
                  unoptimized
                  className="hidden shrink-0 rounded-xl border border-white/70 shadow-md ring-4 ring-white/70 dark:border-slate-600 dark:ring-white/10 sm:block"
                />
              ) : null}
              <ThemeToggle />
              <SignOutButton />
            </div>
          </div>
        </header>

        <main className="subtle-scrollbar min-h-0 min-w-0 flex-1 overflow-y-auto overflow-x-hidden px-3 py-6 sm:px-6 lg:px-12">
          <div className="animate-fade-app mx-auto min-w-0 w-full max-w-6xl xl:max-w-7xl">
            <div className="content-page min-w-0 space-y-6">
              {actsAsSchoolAdmin && subscriptionAccess ? (
                <SubscriptionAccessBanner access={subscriptionAccess} />
              ) : null}
              {children}
            </div>
          </div>
        </main>
      </div>

      {/* Drawer ponsel — fixed, tidak memakai lebar flex */}
      <AnimatePresence>
        {mobileOpen ? (
          <>
            <motion.div
              role="presentation"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 z-40 bg-slate-950/55 backdrop-blur-[2px] md:hidden"
              onClick={() => setMobileOpen(false)}
            />
            <motion.aside
              id="mobile-drawer-nav"
              role="dialog"
              aria-modal="true"
              aria-label="Menu navigasi"
              initial={{ x: "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: "-100%" }}
              transition={{ type: "spring", damping: 28, stiffness: 320 }}
              className="fixed left-0 top-0 z-50 flex h-[100dvh] w-[min(19rem,88vw)] max-w-[320px] flex-col border-r border-white/10 bg-gradient-to-b from-[#070b14] via-[#0c1224] to-[#060911] text-white shadow-2xl shadow-black/40 md:hidden"
            >
              <div className="flex items-center justify-between gap-2 border-b border-white/10 px-3 py-3">
                <div className="flex min-w-0 items-center gap-2">
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 shadow-lg">
                    <LayoutDashboard className="size-4 text-white" />
                  </span>
                  <span className="truncate text-sm font-bold tracking-tight">Menu</span>
                </div>
                <button
                  type="button"
                  className="flex size-10 items-center justify-center rounded-xl text-white/90 hover:bg-white/10"
                  aria-label="Tutup menu"
                  onClick={() => setMobileOpen(false)}
                >
                  <X className="size-5" />
                </button>
              </div>
              <div className="custom-scrollbar min-h-0 flex-1 overflow-y-auto">
                <div className="border-b border-white/5 px-4 py-4">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-indigo-200/90">
                    {roleBadge}
                  </p>
                  {ctx.role === "SISWA" ? (
                    <>
                      <p className="mt-1 break-all text-[13px] font-semibold leading-snug text-white">
                        {ctx.email ? displayStudentLoginEmail(ctx.email) : "—"}
                      </p>
                      {ctx.name ? (
                        <p className="mt-1 text-[12px] leading-snug text-slate-300">{ctx.name}</p>
                      ) : null}
                    </>
                  ) : ctx.role === "GURU" ? (
                    <>
                      <p className="mt-1 break-all text-[12px] leading-snug text-slate-400">
                        {ctx.email ?? "—"}
                      </p>
                      {ctx.name ? (
                        <p className="mt-1 text-[13px] font-semibold leading-snug text-white">{ctx.name}</p>
                      ) : null}
                    </>
                  ) : (
                    <p className="mt-1 truncate text-[12px] text-slate-400">{ctx.email ?? "pengguna"}</p>
                  )}
                </div>
                {guruMultiSchool ? (
                  <GuruSidebarSchoolPicker
                    contexts={guruSchoolContexts}
                    currentSessionSchoolId={ctx.effectiveSchoolId ?? null}
                  />
                ) : null}
                <NavLinks
                  sections={adminNav ? ADMIN_SIDEBAR_NAV_SECTIONS : undefined}
                  items={nav}
                  pathname={pathname}
                  subscriptionAccess={subscriptionAccess}
                  onNavigate={() => setMobileOpen(false)}
                />
              </div>
            </motion.aside>
          </>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
