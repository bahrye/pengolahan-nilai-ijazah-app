import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { homeroomClassRoomIdsForGuruUser } from "@/server/guru-scope";

import { SchoolRekapClient } from "./SchoolRekapClient";
import { StudentRekapClient } from "./StudentRekapClient";

export default async function RekapPage() {
  const session = await auth();
  if (!session?.user?.schoolId) {
    return <p className="text-sm">Terjadi kesalahan konteks.</p>;
  }

  if (session.user.role === "GURU") {
    const homeroomIds = await homeroomClassRoomIdsForGuruUser(session.user.id, session.user.schoolId);
    if (homeroomIds.length === 0) {
      redirect("/dashboard/input/nilai-ujian");
    }
  }

  const subjects = await prisma.subject.findMany({
    where: { schoolId: session.user.schoolId },
    orderBy: [{ orderNo: "asc" }, { code: "asc" }],
  });

  const mapel = subjects.map((s) => ({
    kode: s.code,
    nama: s.name,
  }));

  if (session.user.role === "SISWA") {
    return <StudentRekapClient mapel={mapel} />;
  }

  const school = await prisma.school.findUnique({
    where: { id: session.user.schoolId },
    select: { namaSekolah: true },
  });

  return (
    <SchoolRekapClient
      mapel={mapel}
      schoolName={school?.namaSekolah ?? undefined}
      homeroomOnly={session.user.role === "GURU"}
    />
  );
}
