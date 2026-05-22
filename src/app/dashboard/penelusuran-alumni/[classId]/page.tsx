import { notFound, redirect } from "next/navigation";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { requireTenantAdmin } from "@/server/session";

import { PenelusuranAlumniClient } from "./PenelusuranAlumniClient";

export const dynamic = "force-dynamic";

export default async function PenelusuranAlumniClassPage({
  params,
}: {
  params: Promise<{ classId: string }>;
}) {
  const session = await auth();
  if (session?.user?.role === "GURU") {
    redirect("/dashboard");
  }

  const { schoolId } = await requireTenantAdmin();

  const resolvedParams = await params;
  const classId = resolvedParams.classId;

  const classRoom = await prisma.classRoom.findUnique({
    where: { id: classId, schoolId },
  });

  if (!classRoom) return notFound();

  const [school, students] = await Promise.all([
    prisma.school.findUnique({
      where: { id: schoolId },
      select: {
        namaSekolah: true,
        jenjang: true,
        printLetterheadUrl: true,
      },
    }),
    prisma.student.findMany({
      where: { classRoomId: classId, schoolId },
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        nisn: true,
        nis: true,
        birthPlace: true,
        birthDate: true,
      },
    }),
  ]);

  return (
    <PenelusuranAlumniClient
      className={classRoom.name}
      students={students}
      schoolName={school?.namaSekolah ?? "Sekolah"}
      jenjang={school?.jenjang ?? null}
      printLetterheadUrl={school?.printLetterheadUrl ?? null}
    />
  );
}
