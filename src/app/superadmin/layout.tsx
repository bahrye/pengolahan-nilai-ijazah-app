import Link from "next/link";
import { redirect } from "next/navigation";

import { ThemeToggle } from "@/components/ThemeToggle";
import { SuperadminImpersonationBanner } from "@/components/layout/SuperadminImpersonationBanner";
import { auth, signOut } from "@/auth";
import { LOGIN_SIGNED_OUT_PATH } from "@/lib/auth-sign-out-path";
import { prisma } from "@/lib/prisma";



export default async function SuperadminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (session.user.role !== "SUPERADMIN") redirect("/dashboard/sekolah");

  const impersonatingId = session.user.impersonatingSchoolId;
  const impersonatingSchool = impersonatingId
    ? await prisma.school.findUnique({
        where: { id: impersonatingId },
        select: { namaSekolah: true },
      })
    : null;

  return (
    <div className="app-shell flex min-h-[100dvh] min-w-0 flex-1 flex-col w-full max-w-full overflow-x-hidden">
      <header className="sticky top-0 z-40 border-b border-white/70 bg-[rgb(255_255_255/0.78)] backdrop-blur-xl dark:border-slate-700/60 dark:bg-[rgb(15_23_42/0.95)]">
        <div className="mx-auto flex max-w-[95rem] flex-wrap items-center justify-between gap-3 px-4 py-3.5 sm:px-6 lg:px-10">
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm font-semibold">
            <Link
              href="/superadmin"
              className="ui-section-title underline decoration-transparent transition hover:decoration-current"
            >
              Superadmin — Sekolah
            </Link>
            <Link
              href="/dashboard/sekolah"
              className="text-slate-600 transition hover:text-indigo-600 dark:text-slate-400 dark:hover:text-indigo-300"
            >
              ← Aplikasi utama
            </Link>
          </div>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <form
              action={async () => {
                "use server";
                await signOut({ redirectTo: LOGIN_SIGNED_OUT_PATH });
              }}
            >
              <button type="submit" className="ui-btn ui-btn-primary ui-btn-sm">
                Logout
              </button>
            </form>
          </div>
        </div>
      </header>
      {impersonatingId ? (
        <SuperadminImpersonationBanner
          schoolName={impersonatingSchool?.namaSekolah?.trim() || "Sekolah"}
        />
      ) : null}
      <main className="subtle-scrollbar mx-auto flex w-full max-w-full min-w-0 flex-1 flex-col overflow-y-auto overflow-x-hidden px-4 py-6 sm:px-6 lg:px-8">
        <div className="mx-auto w-full max-w-7xl min-w-0">
          <div className="grid min-w-0 grid-cols-1">
            <div className="min-w-0 space-y-4">
              {children}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
