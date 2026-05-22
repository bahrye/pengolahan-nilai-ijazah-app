"use server";

import { SCHOOL_LEVEL_LABEL } from "@/domain/school-levels";
import {
  catalogSubjectKey,
  getSubjectCatalogForJenjang,
  type CatalogSubject,
  type SubjectCatalogMeta,
} from "@/lib/subject-catalog";
import { prisma } from "@/lib/prisma";
import { requireTenantAdmin } from "@/server/session";

import type { SchoolLevel } from "@prisma/client";

export type SubjectCatalogPayload = SubjectCatalogMeta & {
  jenjangLabel: string;
  existingCodes: string[];
};

export async function getSubjectCatalogForSchoolAction(): Promise<
  | { ok: true; data: SubjectCatalogPayload }
  | { ok: false; message: string }
> {
  try {
    const { schoolId } = await requireTenantAdmin();
    const school = await prisma.school.findUnique({
      where: { id: schoolId },
      select: { jenjang: true },
    });
    if (!school?.jenjang) {
      return {
        ok: false,
        message:
          "Jenjang sekolah belum diatur. Lengkapi data sekolah terlebih dahulu di menu Data Sekolah.",
      };
    }

    const catalog = getSubjectCatalogForJenjang(school.jenjang);
    const existing = await prisma.subject.findMany({
      where: { schoolId },
      select: { code: true },
    });
    const existingCodes = existing.map((s) => catalogSubjectKey(s.code));

    return {
      ok: true,
      data: {
        ...catalog,
        jenjangLabel: SCHOOL_LEVEL_LABEL[school.jenjang],
        existingCodes,
      },
    };
  } catch (e) {
    return { ok: false, message: (e as Error).message };
  }
}

export async function getSubjectCatalogByJenjangAction(
  jenjang: SchoolLevel,
): Promise<SubjectCatalogPayload> {
  const { schoolId } = await requireTenantAdmin();
  const catalog = getSubjectCatalogForJenjang(jenjang);
  const existing = await prisma.subject.findMany({
    where: { schoolId },
    select: { code: true },
  });
  return {
    ...catalog,
    jenjangLabel: SCHOOL_LEVEL_LABEL[jenjang],
    existingCodes: existing.map((s) => catalogSubjectKey(s.code)),
  };
}

export type CatalogImportItem = CatalogSubject;
