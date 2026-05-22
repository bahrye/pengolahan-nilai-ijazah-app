import type { KabupatenType, KelurahanType, SchoolLevel } from "@prisma/client";

export type NpsnSekolahPreview = {
  npsn: string;
  nama: string;
  bentukPendidikan: string;
  alamatJalan: string | null;
  namaDesaDagri: string | null;
  namaKecamatanDagri: string | null;
  namaKabupatenDagri: string | null;
  namaProvinsiDagri: string | null;
  /** Sumber data untuk UI pendaftaran (NPSN). */
  sumberData: string;
  /** Jika true: kecamatan & desa/kelurahan tidak diisi dari referensi (wajib di halaman edit data sekolah). */
  omitDesaKec?: boolean;
  /** `regency_name` mentah (api.co.id) untuk membedakan Kab. vs Kota sebelum label dibersihkan. */
  regencyNameRaw?: string | null;
};

export type SchoolCreateFromNpsn = {
  npsn: string;
  namaSekolah: string;
  jenjang: SchoolLevel | null;
  alamat: string | null;
  provinsi: string;
  tipeKabupaten: KabupatenType;
  kabupaten: string;
  kecamatan: string;
  tipeKelurahan: KelurahanType;
  kelurahan: string;
};
