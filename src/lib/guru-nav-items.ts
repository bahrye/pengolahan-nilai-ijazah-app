import {
  BookOpen,
  ClipboardCheck,
  ClipboardList,
  FileSpreadsheet,
  LockKeyhole,
  Map,
  Send,
  Stamp,
} from "lucide-react";

import type { SiteMapSection } from "@/lib/site-map-types";

/** Urutan menu sidebar guru; item wali kelas disisipkan setelah ujian/rapor. */
export function buildGuruNavMenuItems(isHomeroom: boolean): SiteMapSection["items"] {
  const items: SiteMapSection["items"] = [
    {
      href: "/dashboard/peta-situs",
      label: "Peta Situs",
      description: "Daftar menu dan panduan alur kerja guru",
      icon: Map,
    },
    {
      href: "/dashboard/input/nilai-ujian",
      label: "Input Nilai Ujian",
      description: "Isi nilai ujian tertulis dan praktik mapel yang diampu",
      icon: ClipboardList,
    },
  ];

  if (isHomeroom) {
    items.push(
      {
        href: "/dashboard/input/nilai-rapor",
        label: "Input Nilai Rapor",
        description: "Lengkapi nilai rapor multi semester untuk kelas wali",
        icon: BookOpen,
      },
      {
        href: "/dashboard/cek-validasi-nilai",
        label: "Cek Validasi Nilai",
        description: "Pantau kelengkapan nilai ujian dan rapor siswa kelas wali",
        icon: ClipboardCheck,
      },
    );
  }

  items.push(
    {
      href: "/dashboard/status-kirim-nilai",
      label: "Status Kirim Nilai",
      description: "Pantau status pengiriman nilai ke administrator",
      icon: Send,
    },
    {
      href: "/dashboard/guru/cetak-nilai",
      label: "Cetak Nilai",
      description: "Cetak leger nilai mapel atau kelas yang diampu",
      icon: Stamp,
    },
  );

  if (isHomeroom) {
    items.push({
      href: "/dashboard/rekap-nilai-ijazah",
      label: "Rekap Nilai Ijazah",
      description: "Rekapitulasi nilai ijazah kelas wali kelas",
      icon: FileSpreadsheet,
    });
  }

  items.push({
    href: "/dashboard/guru/ubah-password",
    label: "Ubah Password",
    description: "Ganti sandi login guru (jika tidak memakai PIN default)",
    icon: LockKeyhole,
  });

  return items;
}
