/**
 * Akun dummy untuk QA (admin, guru, siswa) pada sekolah demo.
 *
 * Jalankan: npx prisma db seed
 * (butuh DATABASE_URL di .env)
 */

import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const DUMMY_SCHOOL_CODE = "DUMMY-SIJ-DEMO";

const ADMIN_EMAIL = "admin-dummy@demo-sij.local";
const GURU_EMAIL = "guru-dummy@demo-sij.local";
const SISWA_EMAIL = "siswa-dummy@demo-sij.local";

const PASSWORD_ADMIN = "DummyAdmin123!";
const PASSWORD_GURU = "DummyGuru123!";
const PASSWORD_SISWA = "DummySiswa123!";

const SISWA_NISN = "0012345678";

async function main() {
  const school = await prisma.school.upsert({
    where: { schoolCode: DUMMY_SCHOOL_CODE },
    create: {
      schoolCode: DUMMY_SCHOOL_CODE,
      jenjang: "MTS",
      namaSekolah: "MTs Negeri Dummy (QA)",
      isSatminkal: true,
      provinsi: "Jawa Timur",
      tipeKabupaten: "Kota",
      kabupaten: "Malang",
      kecamatan: "Lowokwaru",
      tipeKelurahan: "Kelurahan",
      kelurahan: "Tunjungsekar",
      namaKepsek: "Dr. Dummy Kepsek, M.Pd.",
      raporSemesterCount: 5,
    },
    update: {
      namaSekolah: "MTs Negeri Dummy (QA)",
      jenjang: "MTS",
      isSatminkal: true,
    },
  });

  await prisma.schoolGradingConfig.upsert({
    where: { schoolId: school.id },
    create: { schoolId: school.id },
    update: {},
  });

  const hashAdmin = await bcrypt.hash(PASSWORD_ADMIN, 12);
  const hashGuru = await bcrypt.hash(PASSWORD_GURU, 12);
  const hashSiswa = await bcrypt.hash(PASSWORD_SISWA, 12);

  const adminUser = await prisma.user.upsert({
    where: { email: ADMIN_EMAIL },
    create: {
      email: ADMIN_EMAIL,
      name: "Admin Sekolah Dummy",
      passwordHash: hashAdmin,
      role: "ADMIN_SEKOLAH",
      schoolId: school.id,
    },
    update: {
      name: "Admin Sekolah Dummy",
      passwordHash: hashAdmin,
      role: "ADMIN_SEKOLAH",
      schoolId: school.id,
    },
  });

  const guruUser = await prisma.user.upsert({
    where: { email: GURU_EMAIL },
    create: {
      email: GURU_EMAIL,
      name: "Guru Dummy QA",
      passwordHash: hashGuru,
      role: "GURU",
      schoolId: school.id,
    },
    update: {
      name: "Guru Dummy QA",
      passwordHash: hashGuru,
      role: "GURU",
      schoolId: school.id,
    },
  });

  await prisma.teacher.upsert({
    where: {
      schoolId_userId: {
        schoolId: school.id,
        userId: guruUser.id,
      },
    },
    create: {
      userId: guruUser.id,
      schoolId: school.id,
      nama: "Guru Dummy QA",
      nip: null,
    },
    update: {
      schoolId: school.id,
      nama: "Guru Dummy QA",
    },
  });

  const siswaUser = await prisma.user.upsert({
    where: { email: SISWA_EMAIL },
    create: {
      email: SISWA_EMAIL,
      name: "Siswa Dummy QA",
      passwordHash: hashSiswa,
      role: "SISWA",
      schoolId: school.id,
    },
    update: {
      name: "Siswa Dummy QA",
      passwordHash: hashSiswa,
      role: "SISWA",
      schoolId: school.id,
    },
  });

  await prisma.student.upsert({
    where: {
      schoolId_nisn: { schoolId: school.id, nisn: SISWA_NISN },
    },
    create: {
      schoolId: school.id,
      nisn: SISWA_NISN,
      name: "Siswa Dummy QA",
      gender: "L",
      birthDate: new Date("2010-05-15"),
      className: "IX A (Dummy)",
      userId: siswaUser.id,
    },
    update: {
      name: "Siswa Dummy QA",
      userId: siswaUser.id,
      className: "IX A (Dummy)",
    },
  });

  // Bersihkan baris Teacher/Student yang salah tempel pada user role lain
  await prisma.teacher.deleteMany({ where: { userId: adminUser.id } });
  await prisma.student.deleteMany({ where: { userId: adminUser.id } });
  await prisma.teacher.deleteMany({ where: { userId: siswaUser.id } });
  await prisma.student.deleteMany({ where: { userId: guruUser.id } });

  console.log(`
✓ Dummy siap — ${school.namaSekolah} (${school.schoolCode})

  ── Admin sekolah ──
  Email : ${ADMIN_EMAIL}
  Sandi : ${PASSWORD_ADMIN}

  ── Guru ──
  Email : ${GURU_EMAIL}
  Sandi : ${PASSWORD_GURU}
  (menu: Input Nilai — ujian & rapor)

  ── Siswa ──
  Email : ${SISWA_EMAIL}
  Sandi : ${PASSWORD_SISWA}
  NISN  : ${SISWA_NISN}
  (menu: Rekap Nilai Ijazah)

  Login di /login dengan email + sandi di atas.
`);
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error(e);
    void prisma.$disconnect();
    process.exit(1);
  });
