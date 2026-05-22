import { LayoutGrid, TrendingUp } from "lucide-react";

import { buildGuruNavMenuItems } from "@/lib/guru-nav-items";

import type { SiteMapFlowMeta, SiteMapFlowStep, SiteMapSection } from "@/lib/site-map-types";

export function buildGuruSiteMapSections(isHomeroom: boolean): SiteMapSection[] {
  const menuItems = buildGuruNavMenuItems(isHomeroom);

  return [
    {
      id: "menu-guru",
      title: "Menu guru",
      icon: LayoutGrid,
      items: menuItems,
    },
  ];
}

export function buildGuruOnboardingFlow(isHomeroom: boolean): SiteMapFlowStep[] {
  const steps: SiteMapFlowStep[] = [
    {
      order: 1,
      title: "Input Nilai Ujian",
      description:
        "Isi nilai ujian tertulis dan praktik untuk setiap mapel dan kelas yang Anda ampu.",
      href: "/dashboard/input/nilai-ujian",
      buttonLabel: "Nilai Ujian",
    },
  ];

  if (isHomeroom) {
    steps.push(
      {
        order: 2,
        title: "Input Nilai Rapor",
        description: "Sebagai wali kelas, lengkapi nilai rapor multi semester untuk siswa.",
        href: "/dashboard/input/nilai-rapor",
        buttonLabel: "Nilai Rapor",
        info: "Menu ini hanya tampil jika Anda ditetapkan sebagai wali kelas.",
      },
      {
        order: 3,
        title: "Cek Validasi Nilai",
        description:
          "Pantau kelengkapan input nilai ujian dan rapor per siswa di kelas wali (semua mapel).",
        href: "/dashboard/cek-validasi-nilai",
        buttonLabel: "Cek Validasi Nilai",
      },
    );
  }

  steps.push(
    {
      order: isHomeroom ? 4 : 2,
      title: "Status Kirim Nilai",
      description:
        "Pastikan nilai sudah dikirim sesuai ketentuan administrator sebelum batas waktu.",
      href: "/dashboard/status-kirim-nilai",
      buttonLabel: "Status Kirim Nilai",
    },
    {
      order: isHomeroom ? 5 : 3,
      title: "Cetak Nilai",
      description: "Cetak dokumen nilai setelah data lengkap dan dikunci sesuai kebijakan sekolah.",
      href: "/dashboard/guru/cetak-nilai",
      buttonLabel: "Cetak Nilai",
    },
  );

  if (isHomeroom) {
    steps.push({
      order: 6,
      title: "Rekap Nilai Ijazah",
      description: "Tinjau rekap nilai ijazah kelas wali dan status kelengkapan data.",
      href: "/dashboard/rekap-nilai-ijazah",
      buttonLabel: "Rekap Nilai Ijazah",
    });
  }

  return steps.map((s, i) => ({ ...s, order: i + 1 }));
}

export const GURU_FLOW_META: SiteMapFlowMeta = {
  title: "Alur kerja guru",
  subtitle:
    "Urutan disarankan untuk mengisi nilai, mengirim, dan mencetak dokumen penilaian.",
  icon: TrendingUp,
};
