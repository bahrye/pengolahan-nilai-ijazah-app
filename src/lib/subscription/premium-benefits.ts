import {
  BookOpen,
  ClipboardCheck,
  ClipboardList,
  Clock,
  Crown,
  FileSpreadsheet,
  GraduationCap,
  KeyRound,
  LockKeyhole,
  Megaphone,
  Printer,
  Send,
  Stamp,
  UserRound,
  Users,
} from "lucide-react";

import { localizeInstitutionInText } from "@/lib/school-terminology";

import type { SchoolLevel } from "@prisma/client";
import type { LucideIcon } from "lucide-react";

export type PremiumBenefitItem = {
  title: string;
  description: string;
  icon: LucideIcon;
};

export type PremiumBenefitCategory = {
  id: string;
  label: string;
  items: PremiumBenefitItem[];
};

/** Konten bagian «Keuntungan berlangganan» & daftar ringkas trial premium. */
const SUBSCRIPTION_PREMIUM_BENEFIT_CATEGORIES_BASE: PremiumBenefitCategory[] = [
  {
    id: "penilaian",
    label: "Penilaian oleh guru & wali kelas",
    items: [
      {
        icon: ClipboardList,
        title: "Input nilai ujian oleh guru mapel",
        description:
          "Setiap guru mengisi nilai ujian tertulis dan praktik untuk mapel serta kelas yang diampunya di madrasah masing-masing — data terpusat per sekolah.",
      },
      {
        icon: BookOpen,
        title: "Input nilai rapor oleh wali kelas",
        description:
          "Wali kelas melengkapi nilai rapor multi semester untuk seluruh siswa di kelasnya, tanpa menunggu admin menginput satu per satu.",
      },
      {
        icon: LockKeyhole,
        title: "Pengaturan input & kirim nilai",
        description:
          "Admin mengatur jadwal buka/tutup input dan batas waktu pengiriman nilai ujian maupun rapor.",
      },
      {
        icon: Send,
        title: "Status kirim nilai",
        description:
          "Pantau guru mana yang sudah mengirim nilai dan mana yang belum, agar rekap ijazah tidak tertinggal.",
      },
      {
        icon: ClipboardCheck,
        title: "Cek validasi kelengkapan nilai",
        description:
          "Wali kelas dan admin memantau nilai ujian/rapor per siswa dan mapel (terisi, kosong, atau diabaikan).",
      },
    ],
  },
  {
    id: "portal",
    label: "Portal guru & siswa",
    items: [
      {
        icon: KeyRound,
        title: "Login guru dan siswa aktif",
        description:
          "Guru dan siswa masuk dengan akun masing-masing; tidak perlu lagi berbagi satu akun admin untuk melihat nilai.",
      },
      {
        icon: UserRound,
        title: "Kartu login siswa",
        description:
          "Admin dapat mencetak atau mengunduh kartu berisi kredensial login siswa secara massal.",
      },
      {
        icon: Megaphone,
        title: "Pengumuman kelulusan untuk siswa",
        description:
          "Siswa membuka akunnya sendiri dan membaca pengumuman kelulusan yang dipublikasikan sekolah — transparan dan terdokumentasi.",
      },
      {
        icon: FileSpreadsheet,
        title: "Rekap nilai ijazah",
        description:
          "Guru wali, admin, dan siswa mengakses rekap nilai ijazah sesuai peran masing-masing.",
      },
    ],
  },
  {
    id: "cetak",
    label: "Cetak & dokumen resmi",
    items: [
      {
        icon: Stamp,
        title: "Cetak nilai & leger",
        description: "Cetak dokumen nilai per mapel atau per kelas setelah data lengkap.",
      },
      {
        icon: GraduationCap,
        title: "SKL & pengaturan kelulusan",
        description:
          "Kelola status kelulusan siswa, pratinjau SKL, dan kebijakan kapan siswa boleh mengunduh SKL.",
      },
      {
        icon: Printer,
        title: "Pengaturan cetak & kelengkapan siswa",
        description:
          "Atur kop surat, format cetak, dan pantau kelengkapan data sebelum pencetakan massal.",
      },
    ],
  },
  {
    id: "admin",
    label: "Kelola madrasah",
    items: [
      {
        icon: Users,
        title: "Data guru & penugasan",
        description:
          "Tambah guru, tetapkan mapel/kelas, wali kelas, dan tugas tambahan dalam satu sistem.",
      },
      {
        icon: Crown,
        title: "Semua menu administrasi premium",
        description:
          "Akses penuh menu premium: pengumuman, bobot, semester, dan fitur lanjutan lainnya.",
      },
    ],
  },
  {
    id: "kapasitas",
    label: "Kapasitas & kenyamanan",
    items: [
      {
        icon: Users,
        title: "Kuota penambahan siswa per paket",
        description:
          "Paket 3 bulan: hingga 300 siswa (kumulatif). Paket 6 bulan: hingga 550. Paket 9 bulan: tidak dibatasi selama masa aktif.",
      },
      {
        icon: Clock,
        title: "Tanpa batas waktu 3 jam per hari",
        description:
          "Paket gratis membatasi penggunaan admin 3 jam per hari; berlangganan menghilangkan batas tersebut.",
      },
    ],
  },
];

function localizePremiumCategories(
  categories: PremiumBenefitCategory[],
  jenjang: SchoolLevel | null,
): PremiumBenefitCategory[] {
  return categories.map((cat) => ({
    ...cat,
    label: localizeInstitutionInText(cat.label, jenjang),
    items: cat.items.map((item) => ({
      ...item,
      description: localizeInstitutionInText(item.description, jenjang),
    })),
  }));
}

/** Konten default (madrasah) — kompatibilitas impor lama. */
export const SUBSCRIPTION_PREMIUM_BENEFIT_CATEGORIES =
  SUBSCRIPTION_PREMIUM_BENEFIT_CATEGORIES_BASE;

export function getSubscriptionPremiumBenefitCategories(
  jenjang: SchoolLevel | null,
): PremiumBenefitCategory[] {
  return localizePremiumCategories(
    SUBSCRIPTION_PREMIUM_BENEFIT_CATEGORIES_BASE,
    jenjang,
  );
}

/** Judul singkat untuk modal trial (satu baris per fitur). */
export const PREMIUM_MENU_FEATURE_LABELS =
  SUBSCRIPTION_PREMIUM_BENEFIT_CATEGORIES.flatMap(
    (c) => c.items.map((i) => i.title),
  ) as readonly string[];
