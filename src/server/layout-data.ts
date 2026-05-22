import { auth } from "@/auth";

import { institutionNoun } from "@/lib/school-terminology";
import { prisma } from "@/lib/prisma";
import {
  fetchGuruSchoolContextRowsForUser,
  type GuruSchoolContextRow,
} from "@/server/guru-school-contexts";
import { homeroomClassRoomIdsForGuruUser } from "@/server/guru-scope";
import type { SchoolAccessSnapshot } from "@/lib/subscription/types";
import {
  getSchoolAccessSnapshot,
  getSchoolAccessSnapshotSafe,
  touchAdminFreeTierUsage,
} from "@/server/subscription-access";

import type { SchoolLevel, UserRole } from "@prisma/client";

export type { GuruSchoolContextRow };

export type SidebarContext = {
  email: string | null;
  /** Nama untuk UI (siswa/guru); di-resolve dari sesi atau tabel terkait. */
  name: string | null;
  role: UserRole;
  image: string | null;
  isHomeroom: boolean;
  activeSchoolId: string | null;
  /** `session.user.schoolId` — untuk guru: sekolah konteks efektif. */
  effectiveSchoolId: string | null;
  guruSchoolContexts: GuruSchoolContextRow[] | null;
  /** Jenjang sekolah aktif (untuk istilah madrasah/sekolah di UI). */
  schoolJenjang: SchoolLevel | null;
  /** Teks utama header (nama sekolah / judul); diseragamkan untuk semua peran. */
  headerPrimaryLabel: string;
  /** Konteks langganan admin sekolah (menu premium & kuota). */
  subscriptionAccess: SchoolAccessSnapshot | null;
  /** Superadmin sedang masuk sebagai admin sekolah ini. */
  impersonatingSchoolId: string | null;
};

export async function getSidebarContext(): Promise<SidebarContext | null> {
  const session = await auth();
  if (!session?.user) return null;

  const dbUser = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { schoolId: true, activeSchoolId: true },
  });

  let isHomeroom = false;
  let guruSchoolContexts: GuruSchoolContextRow[] | null = null;

  let name = session.user.name?.trim() || null;
  let schoolJenjang: SchoolLevel | null = null;
  let headerPrimaryLabel = "Kontrol sekolah";

  if (session.user.role === "SISWA") {
    const st = await prisma.student.findFirst({
      where: { userId: session.user.id },
      select: {
        name: true,
        school: { select: { namaSekolah: true, jenjang: true } },
      },
    });
    schoolJenjang = st?.school?.jenjang ?? null;
    if (!name) name = st?.name?.trim() ?? null;
    const schoolName = st?.school?.namaSekolah?.trim();
    if (schoolName) headerPrimaryLabel = schoolName;
    else if (st?.name?.trim()) headerPrimaryLabel = st.name.trim();
  } else if (!name && session.user.role === "GURU") {
    const schoolForTeacher =
      session.user.schoolId ?? dbUser?.schoolId ?? null;
    if (schoolForTeacher) {
      const t = await prisma.teacher.findFirst({
        where: { userId: session.user.id, schoolId: schoolForTeacher },
        select: { nama: true },
      });
      name = t?.nama?.trim() ?? null;
    }
  }

  if (session.user.role === "GURU") {
    const homeId = dbUser?.schoolId ?? null;
    const rows = await fetchGuruSchoolContextRowsForUser(session.user.id, homeId);
    if (rows.length > 0) {
      guruSchoolContexts = rows;
    }

    const eff = session.user.schoolId;
    if (eff) {
      const homeroomIds = await homeroomClassRoomIdsForGuruUser(
        session.user.id,
        eff,
      );
      isHomeroom = homeroomIds.length > 0;
    }
  }

  if (session.user.role === "GURU" && guruSchoolContexts && guruSchoolContexts.length > 0) {
    const eff = session.user.schoolId ?? null;
    const hit = eff ? guruSchoolContexts.find((c) => c.schoolId === eff) : undefined;
    const cur = hit ?? guruSchoolContexts[0];
    headerPrimaryLabel = (cur.namaSekolah ?? cur.schoolId).trim() || cur.schoolId;
    if (eff) {
      const school = await prisma.school.findUnique({
        where: { id: eff },
        select: { jenjang: true },
      });
      schoolJenjang = school?.jenjang ?? null;
    }
  } else if (
    session.user.role === "ADMIN_SEKOLAH" ||
    (session.user.role === "SUPERADMIN" && session.user.impersonatingSchoolId)
  ) {
    const sid =
      session.user.role === "SUPERADMIN"
        ? session.user.impersonatingSchoolId
        : (dbUser?.schoolId ?? null);
    if (sid) {
      const school = await prisma.school.findUnique({
        where: { id: sid },
        select: { namaSekolah: true, jenjang: true },
      });
      schoolJenjang = school?.jenjang ?? null;
      const n = school?.namaSekolah?.trim();
      if (n) headerPrimaryLabel = n;
      else if (schoolJenjang) {
        headerPrimaryLabel = `Kontrol ${institutionNoun(schoolJenjang)}`;
      }
    }
  }

  let subscriptionAccess: SchoolAccessSnapshot | null = null;
  const subscriptionSchoolId =
    session.user.role === "ADMIN_SEKOLAH"
      ? (dbUser?.schoolId ?? session.user.schoolId ?? null)
      : session.user.role === "SUPERADMIN"
        ? session.user.impersonatingSchoolId
        : null;
  if (subscriptionSchoolId) {
    subscriptionAccess = await getSchoolAccessSnapshotSafe(subscriptionSchoolId, async () => {
      if (session.user.role === "ADMIN_SEKOLAH") {
        await touchAdminFreeTierUsage(subscriptionSchoolId);
      }
      return getSchoolAccessSnapshot(subscriptionSchoolId);
    });
  }

  return {
    email: session.user.email ?? null,
    name,
    role: session.user.role,
    image: session.user.image ?? null,
    isHomeroom,
    activeSchoolId: dbUser?.activeSchoolId ?? null,
    effectiveSchoolId: session.user.schoolId,
    guruSchoolContexts,
    schoolJenjang,
    headerPrimaryLabel,
    subscriptionAccess,
    impersonatingSchoolId: session.user.impersonatingSchoolId ?? null,
  };
}
