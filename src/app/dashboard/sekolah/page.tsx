import type { SchoolLevel } from "@prisma/client";

import { SekolahForm } from "./SekolahForm";
import { loadSchoolFormData } from "@/server/school-loader";

export default async function SekolahPage() {
  const { school } = await loadSchoolFormData();
  const defaults = {
    jenjang: (school?.jenjang ?? "MTS") as SchoolLevel,
    namaSekolah: school?.namaSekolah ?? "",
    npsn: school?.npsn ?? "",
    nsm: school?.nsm ?? "",
    alamat: school?.alamat ?? "",
    provinsi: school?.provinsi ?? "",
    tipeKabupaten: (school?.tipeKabupaten ?? "Kabupaten") as "Kabupaten" | "Kota",
    kabupaten: school?.kabupaten ?? "",
    kecamatan: school?.kecamatan ?? "",
    tipeKelurahan: (school?.tipeKelurahan ?? "Kelurahan") as "Kelurahan" | "Desa",
    kelurahan: school?.kelurahan ?? "",
    kodePos: school?.kodePos ?? "",
    telepon: school?.telepon ?? "",
    email: school?.email ?? "",
    website: school?.website ?? "",
    namaKepsek: school?.namaKepsek ?? "",
    nipKepsek: school?.nipKepsek ?? "",
    raporSemesterCount: school?.raporSemesterCount ?? 5,
  };

  return <SekolahForm defaults={defaults} />;
}
