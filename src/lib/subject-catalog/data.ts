import type { SchoolLevel } from "@prisma/client";

import type { CatalogSubject, SubjectCatalogMeta } from "@/lib/subject-catalog/types";

/** Mapel agama Islam khas madrasah (MI–MA) — kode standar Kemenag. */
const KEMENAG_AGAMA_MI_MTS: CatalogSubject[] = [
  { kode: "QH", nama: "Al Qur'an Hadis", kelompok: "Agama" },
  { kode: "AA", nama: "Akidah Akhlak", kelompok: "Agama" },
  { kode: "FIK", nama: "Fiqih", kelompok: "Agama" },
  { kode: "SKI", nama: "Sejarah Kebudayaan Islam", kelompok: "Agama" },
  { kode: "BAR", nama: "Bahasa Arab", kelompok: "Agama" },
  { kode: "PAI", nama: "Pendidikan Agama Islam", kelompok: "Agama" },
];

const KEMENAG_AGAMA_MA: CatalogSubject[] = [
  ...KEMENAG_AGAMA_MI_MTS,
  { kode: "BSRA", nama: "Bahasa dan Sastra Arab", kelompok: "Agama" },
];

const MI_SUBJECTS: CatalogSubject[] = [
  ...KEMENAG_AGAMA_MI_MTS,
  { kode: "BIND", nama: "Bahasa Indonesia", kelompok: "A" },
  { kode: "MTK", nama: "Matematika", kelompok: "A" },
  { kode: "IPA", nama: "Ilmu Pengetahuan Alam", kelompok: "A" },
  { kode: "IPS", nama: "Ilmu Pengetahuan Sosial", kelompok: "A" },
  { kode: "SBDP", nama: "Seni Budaya dan Prakarya", kelompok: "B" },
  { kode: "PJOK", nama: "Pendidikan Jasmani, Olahraga, dan Kesehatan", kelompok: "B" },
  { kode: "BING", nama: "Bahasa Inggris", kelompok: "B" },
  { kode: "MLOK", nama: "Muatan Lokal", kelompok: "Muatan Lokal" },
];

const MTS_SUBJECTS: CatalogSubject[] = [
  ...KEMENAG_AGAMA_MI_MTS,
  { kode: "BIND", nama: "Bahasa Indonesia", kelompok: "A" },
  { kode: "MTK", nama: "Matematika", kelompok: "A" },
  { kode: "IPA", nama: "Ilmu Pengetahuan Alam", kelompok: "A" },
  { kode: "IPS", nama: "Ilmu Pengetahuan Sosial", kelompok: "A" },
  { kode: "PKN", nama: "Pendidikan Pancasila", kelompok: "Umum" },
  { kode: "BING", nama: "Bahasa Inggris", kelompok: "B" },
  { kode: "SBDP", nama: "Seni Budaya dan Prakarya", kelompok: "B" },
  { kode: "PJOK", nama: "Pendidikan Jasmani, Olahraga, dan Kesehatan", kelompok: "B" },
  { kode: "PRA", nama: "Prakarya", kelompok: "B" },
  { kode: "INF", nama: "Informatika", kelompok: "B" },
  { kode: "BD", nama: "Bahasa Daerah", kelompok: "Muatan Lokal" },
  { kode: "MLOK", nama: "Muatan Lokal", kelompok: "Muatan Lokal" },
];

const MA_SUBJECTS: CatalogSubject[] = [
  ...KEMENAG_AGAMA_MA,
  { kode: "BIND", nama: "Bahasa Indonesia", kelompok: "A" },
  { kode: "MTK", nama: "Matematika", kelompok: "A" },
  { kode: "PKN", nama: "Pendidikan Pancasila", kelompok: "Umum" },
  { kode: "BING", nama: "Bahasa Inggris", kelompok: "A" },
  { kode: "BIO", nama: "Biologi", kelompok: "A" },
  { kode: "FIS", nama: "Fisika", kelompok: "A" },
  { kode: "KIM", nama: "Kimia", kelompok: "A" },
  { kode: "EKO", nama: "Ekonomi", kelompok: "B" },
  { kode: "GEO", nama: "Geografi", kelompok: "B" },
  { kode: "SEJ", nama: "Sejarah", kelompok: "B" },
  { kode: "SOS", nama: "Sosiologi", kelompok: "B" },
  { kode: "SBU", nama: "Seni Budaya", kelompok: "B" },
  { kode: "PJOK", nama: "Pendidikan Jasmani, Olahraga, dan Kesehatan", kelompok: "B" },
  { kode: "INF", nama: "Informatika", kelompok: "B" },
  { kode: "BD", nama: "Bahasa Daerah", kelompok: "Muatan Lokal" },
  { kode: "MLOK", nama: "Muatan Lokal", kelompok: "Muatan Lokal" },
];

const SD_SUBJECTS: CatalogSubject[] = [
  { kode: "PABP", nama: "Pendidikan Agama dan Budi Pekerti", kelompok: "Agama" },
  { kode: "PPKN", nama: "Pendidikan Pancasila", kelompok: "Umum" },
  { kode: "BIND", nama: "Bahasa Indonesia", kelompok: "A" },
  { kode: "MTK", nama: "Matematika", kelompok: "A" },
  { kode: "IPA", nama: "Ilmu Pengetahuan Alam", kelompok: "A" },
  { kode: "IPS", nama: "Ilmu Pengetahuan Sosial", kelompok: "A" },
  { kode: "SB", nama: "Seni Budaya", kelompok: "B" },
  { kode: "PJOK", nama: "Pendidikan Jasmani, Olahraga, dan Kesehatan", kelompok: "B" },
  { kode: "BING", nama: "Bahasa Inggris", kelompok: "B" },
  { kode: "MLOK", nama: "Muatan Lokal", kelompok: "Muatan Lokal" },
];

const SMP_SUBJECTS: CatalogSubject[] = [
  { kode: "PABP", nama: "Pendidikan Agama dan Budi Pekerti", kelompok: "Agama" },
  { kode: "PPKN", nama: "Pendidikan Pancasila", kelompok: "Umum" },
  { kode: "BIND", nama: "Bahasa Indonesia", kelompok: "A" },
  { kode: "MTK", nama: "Matematika", kelompok: "A" },
  { kode: "IPA", nama: "Ilmu Pengetahuan Alam", kelompok: "A" },
  { kode: "IPS", nama: "Ilmu Pengetahuan Sosial", kelompok: "A" },
  { kode: "BING", nama: "Bahasa Inggris", kelompok: "A" },
  { kode: "SB", nama: "Seni Budaya", kelompok: "B" },
  { kode: "PJOK", nama: "Pendidikan Jasmani, Olahraga, dan Kesehatan", kelompok: "B" },
  { kode: "PRA", nama: "Prakarya", kelompok: "B" },
  { kode: "INF", nama: "Informatika", kelompok: "B" },
  { kode: "BD", nama: "Bahasa Daerah", kelompok: "Muatan Lokal" },
  { kode: "MLOK", nama: "Muatan Lokal", kelompok: "Muatan Lokal" },
];

const SMA_SUBJECTS: CatalogSubject[] = [
  { kode: "PABP", nama: "Pendidikan Agama dan Budi Pekerti", kelompok: "Agama" },
  { kode: "PPKN", nama: "Pendidikan Pancasila", kelompok: "Umum" },
  { kode: "BIND", nama: "Bahasa Indonesia", kelompok: "A" },
  { kode: "MTK", nama: "Matematika", kelompok: "A" },
  { kode: "SEJIND", nama: "Sejarah Indonesia", kelompok: "A" },
  { kode: "BING", nama: "Bahasa Inggris", kelompok: "A" },
  { kode: "BIO", nama: "Biologi", kelompok: "A" },
  { kode: "FIS", nama: "Fisika", kelompok: "A" },
  { kode: "KIM", nama: "Kimia", kelompok: "A" },
  { kode: "EKO", nama: "Ekonomi", kelompok: "B" },
  { kode: "GEO", nama: "Geografi", kelompok: "B" },
  { kode: "SEJ", nama: "Sejarah", kelompok: "B" },
  { kode: "SOS", nama: "Sosiologi", kelompok: "B" },
  { kode: "ANT", nama: "Antropologi", kelompok: "B" },
  { kode: "SBU", nama: "Seni Budaya", kelompok: "B" },
  { kode: "PJOK", nama: "Pendidikan Jasmani, Olahraga, dan Kesehatan", kelompok: "B" },
  { kode: "INF", nama: "Informatika", kelompok: "B" },
  { kode: "BD", nama: "Bahasa Daerah", kelompok: "Muatan Lokal" },
  { kode: "MLOK", nama: "Muatan Lokal", kelompok: "Muatan Lokal" },
];

/** Mapel inti SMK (lintas jurusan); mapel kejuruan spesifik ditambah manual. */
const SMK_SUBJECTS: CatalogSubject[] = [
  { kode: "PABP", nama: "Pendidikan Agama dan Budi Pekerti", kelompok: "Agama" },
  { kode: "PPKN", nama: "Pendidikan Pancasila", kelompok: "Umum" },
  { kode: "BIND", nama: "Bahasa Indonesia", kelompok: "A" },
  { kode: "MTK", nama: "Matematika", kelompok: "A" },
  { kode: "SEJIND", nama: "Sejarah Indonesia", kelompok: "A" },
  { kode: "BING", nama: "Bahasa Inggris", kelompok: "A" },
  { kode: "IPA", nama: "Ilmu Pengetahuan Alam", kelompok: "A" },
  { kode: "IPS", nama: "Ilmu Pengetahuan Sosial", kelompok: "A" },
  { kode: "PJOK", nama: "Pendidikan Jasmani, Olahraga, dan Kesehatan", kelompok: "B" },
  { kode: "SBU", nama: "Seni Budaya", kelompok: "B" },
  { kode: "INF", nama: "Informatika", kelompok: "B" },
  { kode: "PKK", nama: "Prakarya dan Kewirausahaan", kelompok: "B" },
  { kode: "BD", nama: "Bahasa Daerah", kelompok: "Muatan Lokal" },
  { kode: "MLOK", nama: "Muatan Lokal", kelompok: "Muatan Lokal" },
];

const PAUD_SUBJECTS: CatalogSubject[] = [
  { kode: "NAB", nama: "Nilai Agama dan Budi Pekerti", kelompok: "Agama" },
  { kode: "JATI", nama: "Jati Diri", kelompok: "Umum" },
  { kode: "LIT", nama: "Literasi", kelompok: "A" },
  { kode: "MTK", nama: "Matematika", kelompok: "A" },
  { kode: "SAIN", nama: "Sains", kelompok: "A" },
  { kode: "SEN", nama: "Seni", kelompok: "B" },
  { kode: "GER", nama: "Gerak dan Olahraga", kelompok: "B" },
];

const PKBM_SUBJECTS: CatalogSubject[] = [
  { kode: "PABP", nama: "Pendidikan Agama dan Budi Pekerti", kelompok: "Agama" },
  { kode: "PPKN", nama: "Pendidikan Pancasila", kelompok: "Umum" },
  { kode: "BIND", nama: "Bahasa Indonesia", kelompok: "A" },
  { kode: "MTK", nama: "Matematika", kelompok: "A" },
  { kode: "IPA", nama: "Ilmu Pengetahuan Alam", kelompok: "A" },
  { kode: "IPS", nama: "Ilmu Pengetahuan Sosial", kelompok: "A" },
  { kode: "BING", nama: "Bahasa Inggris", kelompok: "B" },
  { kode: "SB", nama: "Seni Budaya", kelompok: "B" },
  { kode: "PJOK", nama: "Pendidikan Jasmani, Olahraga, dan Kesehatan", kelompok: "B" },
];

const CATALOG_BY_LEVEL: Record<SchoolLevel, SubjectCatalogMeta> = {
  MI: {
    jenjang: "MI",
    track: "kemenag",
    trackLabel: "Kemenag — Madrasah Ibtidaiyah",
    description:
      "Mapel standar madrasah dasar termasuk agama khas (Akidah Akhlak, Fiqih, SKI, Al-Qur'an Hadits, Bahasa Arab). Jenis ujian bisa disesuaikan setelah impor.",
    subjects: MI_SUBJECTS,
  },
  MTS: {
    jenjang: "MTS",
    track: "kemenag",
    trackLabel: "Kemenag — Madrasah Tsanawiyah",
    description:
      "Mapel standar madrasah menengah pertama termasuk muatan agama Islam dan mapel wajib Kurikulum Merdeka setara SMP.",
    subjects: MTS_SUBJECTS,
  },
  MA: {
    jenjang: "MA",
    track: "kemenag",
    trackLabel: "Kemenag — Madrasah Aliyah",
    description:
      "Mapel standar madrasah menengah atas termasuk agama khas dan peminatan IPA/IPS umum. Jenis ujian diset default Keduanya.",
    subjects: MA_SUBJECTS,
  },
  SD: {
    jenjang: "SD",
    track: "dinas",
    trackLabel: "Dinas — Sekolah Dasar",
    description: "Mapel wajib Kurikulum Merdeka jenjang SD (Kemendikdasmen).",
    subjects: SD_SUBJECTS,
  },
  SDLB: {
    jenjang: "SDLB",
    track: "dinas",
    trackLabel: "Dinas — SD Luar Biasa",
    description: "Paket mapel setara SD untuk satuan pendidikan SDLB.",
    subjects: SD_SUBJECTS,
  },
  SMP: {
    jenjang: "SMP",
    track: "dinas",
    trackLabel: "Dinas — SMP",
    description: "Mapel wajib Kurikulum Merdeka jenjang SMP.",
    subjects: SMP_SUBJECTS,
  },
  SMPLB: {
    jenjang: "SMPLB",
    track: "dinas",
    trackLabel: "Dinas — SMP Luar Biasa",
    description: "Paket mapel setara SMP untuk satuan pendidikan SMPLB.",
    subjects: SMP_SUBJECTS,
  },
  SMA: {
    jenjang: "SMA",
    track: "dinas",
    trackLabel: "Dinas — SMA",
    description:
      "Mapel wajib dan umum jenjang SMA (termasuk peminatan IPA/IPS umum). Mapel pilihan khusus bisa ditambah manual.",
    subjects: SMA_SUBJECTS,
  },
  SMALB: {
    jenjang: "SMALB",
    track: "dinas",
    trackLabel: "Dinas — SMA Luar Biasa",
    description: "Paket mapel setara SMA untuk satuan pendidikan SMALB.",
    subjects: SMA_SUBJECTS,
  },
  SMK: {
    jenjang: "SMK",
    track: "dinas",
    trackLabel: "Dinas — SMK",
    description:
      "Mapel inti lintas jurusan SMK. Mapel produktif/kejuruan (RPL, TKJ, AKL, dll.) silakan tambah manual atau impor Excel.",
    subjects: SMK_SUBJECTS,
  },
  KB: {
    jenjang: "KB",
    track: "paud",
    trackLabel: "PAUD — Kelompok Bermain",
    description: "Muatan pembelajaran PAUD (Kurikulum Merdeka).",
    subjects: PAUD_SUBJECTS,
  },
  TK: {
    jenjang: "TK",
    track: "paud",
    trackLabel: "PAUD — Taman Kanak-kanak",
    description: "Muatan pembelajaran PAUD (Kurikulum Merdeka).",
    subjects: PAUD_SUBJECTS,
  },
  RA: {
    jenjang: "RA",
    track: "paud",
    trackLabel: "PAUD — Raudhatul Athfal",
    description: "Muatan pembelajaran PAUD (Kurikulum Merdeka).",
    subjects: PAUD_SUBJECTS,
  },
  TPA: {
    jenjang: "TPA",
    track: "paud",
    trackLabel: "PAUD — TPA / sederajat",
    description: "Muatan pembelajaran PAUD (Kurikulum Merdeka).",
    subjects: PAUD_SUBJECTS,
  },
  PKBM: {
    jenjang: "PKBM",
    track: "paket",
    trackLabel: "PKBM — Paket kesetaraan",
    description:
      "Paket mapel umum untuk PKBM (paket A setara). Sesuaikan dengan program paket B/C jika diperlukan.",
    subjects: PKBM_SUBJECTS,
  },
  SLB: {
    jenjang: "SLB",
    track: "paket",
    trackLabel: "SLB — Sekolah Luar Biasa",
    description:
      "Paket mapel umum dasar; sesuaikan dengan jenjang setara dan kebutuhan peserta didik.",
    subjects: PKBM_SUBJECTS,
  },
};

export function getSubjectCatalogForJenjang(
  jenjang: SchoolLevel,
): SubjectCatalogMeta {
  return CATALOG_BY_LEVEL[jenjang];
}

export function catalogSubjectKey(kode: string): string {
  return kode.trim().toUpperCase();
}
