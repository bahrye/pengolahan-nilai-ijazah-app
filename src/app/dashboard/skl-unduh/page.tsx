import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

import { SklUnduhClient } from "./SklUnduhClient";

export const dynamic = "force-dynamic";

export default async function SklUnduhPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (session.user.role !== "SISWA") redirect("/dashboard");

  const student = await prisma.student.findFirst({
    where: { userId: session.user.id, isActive: true },
    select: {
      nisn: true,
      name: true,
      className: true,
      classRoom: { select: { name: true } },
      school: { select: { namaSekolah: true } },
    },
  });

  if (!student) {
    redirect("/dashboard/pengumuman");
  }

  const classLabel = student.className ?? student.classRoom?.name ?? "—";
  const schoolName = student.school?.namaSekolah?.trim() || "—";

  return (
    <div className="mx-auto min-w-0 max-w-lg space-y-8">
      <div className="space-y-1">
        <h1 className="ui-page-title">Unduh SKL</h1>
        <p className="ui-muted text-pretty">
          Surat Keterangan Lulus (SKL) dalam bentuk PDF. Unduhan hanya untuk berkas yang sesuai dengan NISN Anda.
        </p>
      </div>

      <SklUnduhClient
        name={student.name}
        nisn={student.nisn}
        classLabel={classLabel}
        schoolName={schoolName}
      />
    </div>
  );
}
