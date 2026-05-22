import { redirect } from "next/navigation";

import { prisma } from "@/lib/prisma";
import { requireUserSchoolId } from "@/server/session";

import { UbahPasswordGuruClient } from "./UbahPasswordGuruClient";

export default async function UbahPasswordGuruPage() {
  const ctx = await requireUserSchoolId();
  if (ctx.role !== "GURU") {
    redirect("/dashboard");
  }

  const teacher = await prisma.teacher.findFirst({
    where: { userId: ctx.userId, schoolId: ctx.schoolId },
    select: { id: true },
  });
  if (!teacher) {
    redirect("/dashboard");
  }

  const user = await prisma.user.findUnique({
    where: { id: ctx.userId },
    select: { passwordHash: true },
  });
  if (!user?.passwordHash) {
    return (
      <div className="mx-auto w-full max-w-lg space-y-4">
        <h1 className="ui-page-title">Ubah password</h1>
        <div className="ui-card ui-card-tight border-amber-200/80 bg-amber-50/60 text-sm text-amber-950 dark:border-amber-900/50 dark:bg-amber-950/35 dark:text-amber-100">
          <p className="leading-relaxed">
            Akun Anda tidak memakai sandi email untuk login. Hubungi administrator sekolah jika perlu bantuan akses.
          </p>
        </div>
      </div>
    );
  }

  return <UbahPasswordGuruClient />;
}
