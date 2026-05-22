import type { SubscriptionPlanPackage } from "@prisma/client";

export const FREE_TRIAL_DAYS = 60;
export const PREMIUM_TRIAL_DAYS = 3;
export const FREE_DAILY_LIMIT_SECONDS = 6 * 60 * 60;
export const FREE_STUDENT_ADD_QUOTA = 150;
export const FREE_MAX_ACADEMIC_YEARS = 1;

export { PREMIUM_MENU_FEATURE_LABELS } from "@/lib/subscription/premium-benefits";

/** Menu admin yang boleh diakses tanpa langganan aktif. */
export const FREE_ADMIN_MENU_HREFS = [
  "/dashboard/peta-situs",
  "/dashboard/sekolah",
  "/dashboard/siswa",
  "/dashboard/import-master-siswa",
  "/dashboard/mapel",
  "/dashboard/bobot",
  "/dashboard/kelas",
  "/dashboard/semester",
  "/dashboard/tahun-ajaran",
  "/dashboard/input/nilai-ujian",
  "/dashboard/input/nilai-rapor",
  "/dashboard/cek-validasi-nilai",
  "/dashboard/rekap-nilai-ijazah",
  "/dashboard/cek-peringkat",
  "/dashboard/pengumuman",
  "/dashboard/langganan",
  "/dashboard/admin/ubah-password",
  "/dashboard/bantuan-superadmin",
] as const;

export type SubscriptionPackageOption = {
  package: SubscriptionPlanPackage;
  label: string;
  months: number;
  priceRp: number;
};

export const SUBSCRIPTION_PACKAGES: SubscriptionPackageOption[] = [
  { package: "MONTHS_3", label: "Paket 3 bulan", months: 3, priceRp: 15_000 },
  { package: "MONTHS_6", label: "Paket 6 bulan", months: 6, priceRp: 30_000 },
  { package: "MONTHS_9", label: "Paket 9 bulan", months: 9, priceRp: 45_000 },
];

export const PAYMENT_DESTINATIONS = {
  shopeepay: {
    label: "ShopeePay",
    number: "081543276033",
    holder: "Syamsul Bahri",
    transferVia: "SHOPEEPAY" as const,
  },
  seabank: {
    label: "SeaBank",
    number: "901997128798",
    holder: "Syamsul Bahri",
    transferVia: "SEABANK" as const,
  },
};

export const EWALLET_PROVIDERS = [
  "OVO",
  "GoPay",
  "DANA",
  "ShopeePay",
  "LinkAja",
  "Jenius",
  "Lainnya",
] as const;

export const BANK_PROVIDERS = [
  "BRI",
  "BNI",
  "BCA",
  "Mandiri",
  "SeaBank",
  "BTN",
  "BSI",
  "Lainnya",
] as const;

export function isFreeAdminPath(pathname: string): boolean {
  return FREE_ADMIN_MENU_HREFS.some(
    (href) => pathname === href || pathname.startsWith(`${href}/`),
  );
}

/** Pesan saat login guru/siswa ditolak karena sekolah belum berlangganan. */
export const SCHOOL_LOGIN_SUBSCRIPTION_BLOCKED_MESSAGE =
  "Login guru dan siswa tidak tersedia karena sekolah belum memiliki langganan aktif. Minta Administrator Sekolah untuk berlangganan melalui menu Langganan di dashboard admin.";

export function isPremiumAdminPath(pathname: string): boolean {
  if (!pathname.startsWith("/dashboard")) return false;
  if (pathname.startsWith("/dashboard/guru")) return true;
  return !isFreeAdminPath(pathname);
}
