import {
  Download,
  FileSpreadsheet,
  LayoutGrid,
  Map,
  Megaphone,
  TrendingUp,
} from "lucide-react";

import type { SiteMapFlowMeta, SiteMapFlowStep, SiteMapSection } from "@/lib/site-map-types";

export const SISWA_SITE_MAP_SECTIONS: SiteMapSection[] = [
  {
    id: "menu-siswa",
    title: "Menu siswa",
    icon: LayoutGrid,
    items: [
      {
        href: "/dashboard/peta-situs",
        label: "Peta Situs",
        description: "Daftar menu dan panduan portal siswa",
        icon: Map,
      },
      {
        href: "/dashboard/pengumuman",
        label: "Pengumuman",
        description: "Informasi dan pengumuman dari madrasah",
        icon: Megaphone,
      },
      {
        href: "/dashboard/rekap-nilai-ijazah",
        label: "Rekap Nilai Ijazah",
        description: "Lihat rekap nilai ijazah dan status kelulusan",
        icon: FileSpreadsheet,
      },
      {
        href: "/dashboard/skl-unduh",
        label: "Unduh SKL",
        description: "Unduh Surat Keterangan Lulus bila sudah tersedia",
        icon: Download,
      },
    ],
  },
];

export const SISWA_ONBOARDING_FLOW: SiteMapFlowStep[] = [
  {
    order: 1,
    title: "Baca Pengumuman",
    description: "Periksa pengumuman terbaru dari madrasah terkait jadwal dan kelulusan.",
    href: "/dashboard/pengumuman",
    buttonLabel: "Pengumuman",
  },
  {
    order: 2,
    title: "Rekap Nilai Ijazah",
    description: "Lihat rekap nilai ijazah setelah administrator mempublikasikannya.",
    href: "/dashboard/rekap-nilai-ijazah",
    buttonLabel: "Rekap Nilai Ijazah",
    info: "Rekap dapat disembunyikan hingga pengaturan kelulusan diaktifkan admin.",
  },
  {
    order: 3,
    title: "Unduh SKL",
    description: "Unduh Surat Keterangan Lulus jika sudah diunggah untuk akun Anda.",
    href: "/dashboard/skl-unduh",
    buttonLabel: "Unduh SKL",
  },
];

export const SISWA_FLOW_META: SiteMapFlowMeta = {
  title: "Alur portal siswa",
  subtitle: "Langkah untuk memantau pengumuman, nilai ijazah, dan dokumen kelulusan.",
  icon: TrendingUp,
};
