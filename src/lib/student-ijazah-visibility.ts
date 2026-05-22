import type { IjazahRekapVisibility } from "@prisma/client";

/**
 * True = tampilkan nilai/status sebagai **** di rekap ijazah siswa.
 */
export function shouldMaskStudentIjazahRekap(input: {
  graduationAnnouncementAt: Date | null;
  ijazahRekapVisibility: IjazahRekapVisibility;
  graduationAnnouncementAckAt: Date | null;
  now: Date;
}): boolean {
  const { graduationAnnouncementAt, ijazahRekapVisibility, graduationAnnouncementAckAt, now } =
    input;
  if (!graduationAnnouncementAt) {
    return true;
  }
  if (now.getTime() < graduationAnnouncementAt.getTime()) {
    return true;
  }
  if (ijazahRekapVisibility === "AT_ANNOUNCEMENT_TIME") {
    return false;
  }
  return graduationAnnouncementAckAt == null;
}

/**
 * Jika mengembalikan string: siswa belum boleh mengunduh SKL (alasan untuk ditampilkan).
 * `null` = boleh lanjut cek berkas di Drive.
 */
export function getStudentSklDownloadBlockReason(input: {
  sklActive: boolean;
  graduationAnnouncementAt: Date | null;
  /** Mengikuti `ijazahRekapVisibility` di Pengaturan kelulusan. */
  ijazahRekapVisibility: IjazahRekapVisibility;
  graduationAnnouncementAckAt: Date | null;
  now: Date;
}): string | null {
  if (!input.sklActive) {
    return "SKL saat ini dinonaktifkan oleh pihak sekolah. Silakan kembali lagi nanti atau hubungi staf sekolah jika ada pertanyaan.";
  }
  const masked = shouldMaskStudentIjazahRekap({
    graduationAnnouncementAt: input.graduationAnnouncementAt,
    ijazahRekapVisibility: input.ijazahRekapVisibility,
    graduationAnnouncementAckAt: input.graduationAnnouncementAckAt,
    now: input.now,
  });
  if (!masked) return null;

  if (!input.graduationAnnouncementAt) {
    return "Unduhan SKL akan dibuka setelah sekolah menetapkan jadwal waktu pengumuman di menu Pengaturan kelulusan.";
  }
  if (input.now.getTime() < input.graduationAnnouncementAt.getTime()) {
    return "Unduhan SKL dibuka setelah waktu pengumuman kelulusan. Silakan kembali lagi sesuai jadwal dari sekolah.";
  }
  if (input.ijazahRekapVisibility === "AFTER_CHECK_ANNOUNCEMENT") {
    return "Buka menu Pengumuman terlebih dahulu dan pastikan Anda sudah menandai sudah membaca pengumuman, lalu kembali ke halaman ini untuk memeriksa lagi.";
  }
  return "SKL belum dapat diunduh saat ini. Silakan coba lagi beberapa saat atau hubungi sekolah.";
}
