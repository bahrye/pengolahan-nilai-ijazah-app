import { prisma } from "@/lib/prisma";
import { requireTenantAdmin } from "@/server/session";
import {
  listGuruTugasTambahanMineAction,
  listGuruTugasTambahanPendingForMeAction,
  listHomeTeachersForTugasAction,
} from "@/server/actions/guru-tugas-tambahan";

import { TugasTambahanGuruClient } from "./TugasTambahanGuruClient";

export default async function TugasTambahanGuruPage() {
  const { schoolId } = await requireTenantAdmin();
  const school = await prisma.school.findUnique({
    where: { id: schoolId },
    select: { namaSekolah: true, isSatminkal: true, npsn: true },
  });

  const [pending, mineRaw, homeTeachers] = await Promise.all([
    listGuruTugasTambahanPendingForMeAction(),
    listGuruTugasTambahanMineAction(),
    listHomeTeachersForTugasAction(),
  ]);

  const mine = mineRaw.map((m) => ({
    id: m.id,
    status: m.status,
    createdAt: m.createdAt.toISOString(),
    rejectReason: m.rejectReason,
    hostIsSatminkal: m.hostSchool.isSatminkal,
    homeTeacher: {
      id: m.homeTeacher.id,
      nama: m.homeTeacher.nama,
      email: m.homeTeacher.user.email,
      schoolNama: m.homeTeacher.school.namaSekolah,
      schoolNpsn: m.homeTeacher.school.npsn,
    },
    hostSchool: {
      nama: m.hostSchool.namaSekolah,
      npsn: m.hostSchool.npsn,
    },
  }));

  const homeTeachersPayload = homeTeachers.map((t) => ({
    id: t.id,
    nama: t.nama,
    nip: t.nip,
    email: t.user.email,
  }));

  return (
    <TugasTambahanGuruClient
      tenantSchoolId={schoolId}
      schoolName={school?.namaSekolah ?? null}
      schoolNpsn={school?.npsn ?? null}
      isSatminkal={school?.isSatminkal ?? true}
      pending={pending}
      mine={mine}
      homeTeachers={homeTeachersPayload}
    />
  );
}
