import type { SchoolLevel } from "@prisma/client";

export type CatalogSubject = {
  kode: string;
  nama: string;
  kelompok: string;
};

export type SubjectCatalogMeta = {
  jenjang: SchoolLevel;
  track: "kemenag" | "dinas" | "paud" | "paket";
  trackLabel: string;
  description: string;
  subjects: CatalogSubject[];
};
