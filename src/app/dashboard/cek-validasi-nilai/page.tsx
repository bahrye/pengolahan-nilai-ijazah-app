import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { homeroomClassRoomIdsForGuruUser } from "@/server/guru-scope";

import { CekValidasiNilaiClient } from "./CekValidasiNilaiClient";

async function schoolJenjangForUser(schoolId: string) {
  const school = await prisma.school.findUnique({
    where: { id: schoolId },
    select: { jenjang: true },
  });
  return school?.jenjang ?? null;
}

export default async function CekValidasiNilaiPage() {
  const session = await auth();
  if (!session?.user?.schoolId) {
    return <p className="ui-muted text-sm">Terjadi kesalahan konteks.</p>;
  }

  const schoolJenjang = await schoolJenjangForUser(session.user.schoolId);
  const role = session.user.role;

  if (role === "GURU") {
    const homeroomIds = await homeroomClassRoomIdsForGuruUser(
      session.user.id,
      session.user.schoolId,
    );
    if (homeroomIds.length === 0) {
      return (
        <div className="max-w-xl space-y-4">
          <h1 className="ui-page-title">Cek Validasi Nilai</h1>
          <p className="ui-muted text-pretty text-sm">
            Halaman ini hanya untuk wali kelas pada tahun ajaran yang sedang aktif.
            Jika Anda baru ditetapkan sebagai wali kelas, pastikan kelas tersebut
            terdaftar di tahun ajaran aktif, lalu muat ulang halaman.
          </p>
        </div>
      );
    }
    return (
      <CekValidasiNilaiClient homeroomOnly schoolJenjang={schoolJenjang} />
    );
  }

  if (role !== "ADMIN_SEKOLAH" && role !== "SUPERADMIN") {
    redirect("/dashboard");
  }

  return <CekValidasiNilaiClient schoolJenjang={schoolJenjang} />;
}
