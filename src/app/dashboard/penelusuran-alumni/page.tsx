import { BookUser, Users } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { requireTenantAdmin } from "@/server/session";

export default async function PenelusuranAlumniIndexPage() {
  const session = await auth();
  if (session?.user?.role === "GURU") {
    redirect("/dashboard");
  }

  const { schoolId } = await requireTenantAdmin();

  const activeYear = await prisma.academicYear.findFirst({
    where: { schoolId, isActive: true },
  });

  const classRooms = activeYear
    ? await prisma.classRoom.findMany({
        where: { academicYearId: activeYear.id, schoolId },
        orderBy: { name: "asc" },
        select: {
          id: true,
          name: true,
          _count: { select: { students: true } },
        },
      })
    : [];

  return (
    <div className="space-y-8">
      <div className="max-w-3xl space-y-1">
        <h1 className="ui-page-title">Penelusuran Alumni (Tracer Study)</h1>
        <p className="ui-muted text-pretty">
          Pilih kelas untuk melihat daftar siswa dan mengunduh Formulir Penelusuran Alumni. 
          Tahun Ajaran aktif: <strong>{activeYear?.label ?? "Tidak ada"}</strong>
        </p>
      </div>

      <section className="ui-card p-4 sm:p-6">
        <h2 className="mb-4 text-base font-bold text-slate-800 dark:text-slate-100">
          Daftar Kelas
        </h2>

        {classRooms.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-300 p-8 text-center dark:border-slate-700">
            <BookUser className="mx-auto mb-3 size-10 text-slate-400 dark:text-slate-600" />
            <p className="font-semibold text-slate-700 dark:text-slate-300">Belum ada kelas</p>
            <p className="mt-1 text-sm text-slate-500">
              Silakan tambahkan kelas di menu Data Kelas terlebih dahulu.
            </p>
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {classRooms.map((c) => (
              <Link
                key={c.id}
                href={`/dashboard/penelusuran-alumni/${c.id}`}
                className="group flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 p-4 transition-all hover:border-indigo-300 hover:bg-white hover:shadow-md dark:border-slate-700/60 dark:bg-slate-800/50 dark:hover:border-indigo-700/60 dark:hover:bg-slate-800"
              >
                <div className="min-w-0">
                  <p className="font-bold text-slate-800 group-hover:text-indigo-700 dark:text-slate-200 dark:group-hover:text-indigo-400">
                    {c.name}
                  </p>
                  <p className="mt-0.5 flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
                    <Users className="size-3.5" />
                    {c._count.students} siswa
                  </p>
                </div>
                <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-white text-indigo-500 shadow-sm ring-1 ring-slate-200 group-hover:bg-indigo-50 group-hover:ring-indigo-200 dark:bg-slate-900 dark:ring-slate-700 dark:group-hover:bg-indigo-900/40">
                  <BookUser className="size-4" />
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
