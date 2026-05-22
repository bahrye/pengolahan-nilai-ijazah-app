import {
  BookOpen,
  Briefcase,
  Calendar,
  ClipboardCheck,
  ClipboardList,
  Crown,
  FileSpreadsheet,
  FileUp,
  GraduationCap,
  LayoutGrid,
  ListChecks,
  LockKeyhole,
  Map,
  Megaphone,
  Printer,
  School,
  ScrollText,
  Send,
  SlidersHorizontal,
  Stamp,
  TrendingUp,
  Users,
  CalendarClock,
  Headphones,
  BookUser,
} from "lucide-react";

import {
  isKemenagJenjang,
  localizeInstitutionInText,
} from "@/lib/school-terminology";
import type { SiteMapFlowMeta, SiteMapFlowStep, SiteMapSection } from "@/lib/site-map-types";

import type { SchoolLevel } from "@prisma/client";

function localizeSiteMapSections(
  sections: SiteMapSection[],
  jenjang: SchoolLevel | null,
): SiteMapSection[] {
  if (isKemenagJenjang(jenjang)) return sections;
  return sections.map((section) => ({
    ...section,
    items: section.items.map((item) => ({
      ...item,
      description: localizeInstitutionInText(item.description, jenjang),
    })),
  }));
}

function localizeFlowSteps(
  steps: SiteMapFlowStep[],
  jenjang: SchoolLevel | null,
): SiteMapFlowStep[] {
  if (isKemenagJenjang(jenjang)) return steps;
  return steps.map((step) => ({
    ...step,
    description: localizeInstitutionInText(step.description, jenjang),
    info: step.info
      ? localizeInstitutionInText(step.info, jenjang)
      : step.info,
  }));
}

export function getAdminSiteMapSections(
  jenjang: SchoolLevel | null,
): SiteMapSection[] {
  return localizeSiteMapSections(ADMIN_SITE_MAP_SECTIONS, jenjang);
}

export function getAdminOnboardingFlow(
  jenjang: SchoolLevel | null,
): SiteMapFlowStep[] {
  return localizeFlowSteps(ADMIN_ONBOARDING_FLOW, jenjang);
}

export type { SiteMapMenuItem as AdminSiteMapMenuItem } from "@/lib/site-map-types";
export type { SiteMapSection as AdminSiteMapSection } from "@/lib/site-map-types";
export type { SiteMapFlowStep as AdminFlowStep } from "@/lib/site-map-types";

/** Daftar menu admin sekolah untuk tab Daftar Menu. */
export const ADMIN_SITE_MAP_SECTIONS: SiteMapSection[] = [
  {
    id: "utama",
    title: "Menu utama",
    icon: LayoutGrid,
    items: [
      {
        href: "/dashboard/peta-situs",
        label: "Peta Situs",
        description: "Daftar menu dan panduan alur kerja administrator",
        icon: Map,
      },
      {
        href: "/dashboard/sekolah",
        label: "Data Sekolah",
        description: "Identitas madrasah, jenjang, alamat, dan kepala sekolah",
        icon: School,
      },
      {
        href: "/dashboard/langganan",
        label: "Langganan",
        description: "Status paket, kuota siswa, dan pembayaran",
        icon: Crown,
      },
      {
        href: "/dashboard/admin/ubah-password",
        label: "Ubah Password",
        description: "Ganti sandi login administrator",
        icon: LockKeyhole,
      },
      {
        href: "/dashboard/bantuan-superadmin",
        label: "Bantuan Superadmin",
        description: "Hubungi superadmin via email atau WhatsApp",
        icon: Headphones,
      },
    ],
  },
  {
    id: "master",
    title: "Master data",
    icon: Calendar,
    items: [
      {
        href: "/dashboard/tahun-ajaran",
        label: "Tahun Ajaran",
        description: "Buat dan aktifkan tahun ajaran berjalan",
        icon: Calendar,
      },
      {
        href: "/dashboard/semester",
        label: "Data Semester",
        description: "Semester per tahun ajaran (kunci input nilai rapor)",
        icon: Calendar,
      },
      {
        href: "/dashboard/kelas",
        label: "Data Kelas",
        description: "Kelas per tahun ajaran dan wali kelas",
        icon: Users,
      },
      {
        href: "/dashboard/bobot",
        label: "Bobot Nilai",
        description: "Bobot ujian, rapor, dan KKM penilaian ijazah",
        icon: SlidersHorizontal,
      },
      {
        href: "/dashboard/mapel",
        label: "Mapel",
        description: "Mata pelajaran dan urutan mapel ijazah",
        icon: BookOpen,
      },
    ],
  },
  {
    id: "personil",
    title: "Data personil",
    icon: GraduationCap,
    items: [
      {
        href: "/dashboard/guru",
        label: "Data Guru",
        description: "Akun guru, penugasan, dan kartu login PIN",
        icon: GraduationCap,
      },
      {
        href: "/dashboard/tugas-tambahan-guru",
        label: "Tugas tambahan guru",
        description: "Guru mengajar di madrasah satminkal lain",
        icon: Briefcase,
      },
      {
        href: "/dashboard/siswa",
        label: "Data Siswa",
        description: "Siswa, kelas, NISN, dan akun login siswa",
        icon: Users,
      },
      {
        href: "/dashboard/import-master-siswa",
        label: "Import Master Siswa",
        description:
          "Unduh template atau unggah data siswa (termasuk ekspor PDUM Kemenag)",
        icon: FileUp,
      },
      {
        href: "/dashboard/skl-siswa",
        label: "SKL Siswa",
        description: "Surat keterangan lulus dan data cetak SKL",
        icon: ScrollText,
      },
      {
        href: "/dashboard/penelusuran-alumni",
        label: "Penelusuran Alumni",
        description: "Formulir penelusuran (tracer study) kelulusan siswa",
        icon: BookUser,
      },
    ],
  },
  {
    id: "nilai",
    title: "Input nilai",
    icon: ClipboardList,
    items: [
      {
        href: "/dashboard/input/nilai-ujian",
        label: "Ujian Tertulis & Praktek",
        description: "Input nilai ujian per mapel dan kelas",
        icon: ClipboardList,
      },
      {
        href: "/dashboard/input/nilai-rapor",
        label: "Rapor Multi Semester",
        description: "Input nilai rapor per semester",
        icon: BookOpen,
      },
      {
        href: "/dashboard/cek-validasi-nilai",
        label: "Cek Validasi Nilai",
        description: "Pantau kelengkapan nilai ujian dan rapor per siswa dan mapel",
        icon: ClipboardCheck,
      },
      {
        href: "/dashboard/pengaturan-input-nilai",
        label: "Pengaturan Input dan Kirim Nilai",
        description: "Kunci kirim nilai ujian dan rapor",
        icon: LockKeyhole,
      },
      {
        href: "/dashboard/status-kirim-nilai",
        label: "Status Kirim Nilai",
        description: "Pantau guru yang sudah mengirim nilai",
        icon: Send,
      },
    ],
  },
  {
    id: "cetak",
    title: "Cetak & kelulusan",
    icon: Printer,
    items: [
      {
        href: "/dashboard/pengaturan-cetak-nilai",
        label: "Pengaturan Cetak Nilai",
        description: "Kop surat, tanggal cetak, dan tanda tangan",
        icon: Printer,
      },
      {
        href: "/dashboard/kelengkapan-cetak-siswa",
        label: "Kelengkapan Cetak Siswa",
        description: "Kelengkapan data siswa untuk dokumen cetak",
        icon: ListChecks,
      },
      {
        href: "/dashboard/cetak-nilai",
        label: "Cetak Nilai",
        description: "Cetak leger dan dokumen nilai",
        icon: Stamp,
      },
      {
        href: "/dashboard/pengaturan-kelulusan",
        label: "Pengaturan Kelulusan",
        description: "Pengumuman kelulusan dan visibilitas rekap siswa",
        icon: CalendarClock,
      },
      {
        href: "/dashboard/pengumuman",
        label: "Pengumuman Siswa",
        description: "Pengumuman untuk portal siswa",
        icon: Megaphone,
      },
      {
        href: "/dashboard/rekap-nilai-ijazah",
        label: "Rekap Nilai Ijazah",
        description: "Rekapitulasi nilai ijazah dan status kelulusan",
        icon: FileSpreadsheet,
      },
      {
        href: "/dashboard/cek-peringkat",
        label: "Cek Peringkat Siswa",
        description: "Lihat peringkat siswa di tiap kelas",
        icon: Crown,
      },
    ],
  },
];

/** Urutan langkah onboarding untuk tab Panduan Flow. */
export const ADMIN_ONBOARDING_FLOW: SiteMapFlowStep[] = [
  {
    order: 1,
    title: "Isi Data Sekolah",
    description:
      "Lengkapi identitas madrasah, jenjang, alamat, dan data kepala sekolah. Tanpa ini, fitur lain belum siap dipakai.",
    href: "/dashboard/sekolah",
    buttonLabel: "Data Sekolah",
    info: "Mulai dari sini setiap tahun ajaran baru jika ada perubahan data madrasah.",
  },
  {
    order: 2,
    title: "Atur Tahun Ajaran",
    description: "Buat tahun ajaran yang sedang berjalan dan tandai sebagai aktif.",
    href: "/dashboard/tahun-ajaran",
    buttonLabel: "Tahun Ajaran",
  },
  {
    order: 3,
    title: "Data Semester",
    description: "Pastikan semester untuk tahun ajaran aktif sudah lengkap.",
    href: "/dashboard/semester",
    buttonLabel: "Data Semester",
  },
  {
    order: 4,
    title: "Data Kelas",
    description: "Buat kelas per tahun ajaran; tentukan wali kelas bila perlu.",
    href: "/dashboard/kelas",
    buttonLabel: "Data Kelas",
  },
  {
    order: 5,
    title: "Bobot Nilai",
    description: "Atur bobot ujian, bobot rapor, dan KKM sesuai kebijakan madrasah.",
    href: "/dashboard/bobot",
    buttonLabel: "Bobot Nilai",
  },
  {
    order: 6,
    title: "Mapel",
    description: "Tambahkan mata pelajaran dan urutan mapel untuk rekap ijazah.",
    href: "/dashboard/mapel",
    buttonLabel: "Mapel",
  },
  {
    order: 7,
    title: "Data Siswa",
    description: "Impor atau input siswa, tempatkan ke kelas, dan aktifkan akun login.",
    href: "/dashboard/siswa",
    buttonLabel: "Data Siswa",
  },
  {
    order: 8,
    title: "Data Guru",
    description: "Daftarkan guru, penugasan mengajar, dan kartu login (PIN/sandi).",
    href: "/dashboard/guru",
    buttonLabel: "Data Guru",
    info: "Guru diperlukan sebelum input nilai dan status kirim nilai.",
  },
  {
    order: 9,
    title: "Input Nilai Ujian",
    description: "Admin atau guru mengisi nilai ujian tertulis dan praktik per mapel.",
    href: "/dashboard/input/nilai-ujian",
    buttonLabel: "Nilai Ujian",
  },
  {
    order: 10,
    title: "Input Nilai Rapor",
    description: "Lengkapi nilai rapor multi semester sesuai jenjang.",
    href: "/dashboard/input/nilai-rapor",
    buttonLabel: "Nilai Rapor",
  },
  {
    order: 11,
    title: "Pengaturan & Status Kirim Nilai",
    description: "Atur kunci kirim nilai dan pantau guru yang sudah mengirim.",
    href: "/dashboard/pengaturan-input-nilai",
    buttonLabel: "Pengaturan Input",
  },
  {
    order: 12,
    title: "Kelengkapan Cetak & Pengaturan",
    description: "Siapkan kop cetak, kelengkapan data siswa, dan pengaturan kelulusan.",
    href: "/dashboard/pengaturan-cetak-nilai",
    buttonLabel: "Pengaturan Cetak",
  },
  {
    order: 13,
    title: "Rekap Nilai Ijazah",
    description: "Hitung rekap ijazah, cek kelulusan, dan siapkan SKL bila diperlukan.",
    href: "/dashboard/rekap-nilai-ijazah",
    buttonLabel: "Rekap Nilai Ijazah",
  },
];

export const ADMIN_FLOW_META: SiteMapFlowMeta = {
  title: "Alur persiapan nilai ijazah",
  subtitle:
    "Langkah yang disarankan untuk Administrator Sekolah dari awal tahun ajaran hingga rekap nilai ijazah.",
  icon: TrendingUp,
};

/** Kelompok menu sidebar admin — selaras dengan tab Daftar Menu di Peta Situs. */
export type AdminSidebarNavSection = {
  id: string;
  title: string;
  items: {
    href: string;
    label: string;
    icon: import("lucide-react").LucideIcon;
  }[];
};

export const ADMIN_SIDEBAR_NAV_SECTIONS: AdminSidebarNavSection[] =
  ADMIN_SITE_MAP_SECTIONS.map((section) => ({
    id: section.id,
    title: section.title,
    items: section.items.map((item) => ({
      href: item.href,
      label: item.label,
      icon: item.icon,
    })),
  }));
