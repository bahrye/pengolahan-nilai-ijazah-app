import { SCORE_TYPE } from "@/domain/scoreTypes";

/** Baris nilai rapor (pengetahuan / keterampilan) per mapel & semester. */
export type RaporSemesterActivityRow = {
  subjectId: string;
  semesterKey: string;
};

/**
 * Semester dianggap aktif untuk mapel jika ada minimal satu entri nilai rapor
 * (pengetahuan atau keterampilan) di semester tersebut — di seluruh siswa.
 */
export function buildActiveSemesterKeysBySubject(
  orderedSemesterKeys: readonly string[],
  subjectIds: readonly string[],
  activityRows: readonly RaporSemesterActivityRow[],
): Map<string, Set<string>> {
  const allowed = new Set(orderedSemesterKeys);
  const bySubject = new Map<string, Set<string>>();
  for (const subjectId of subjectIds) {
    bySubject.set(subjectId, new Set());
  }
  for (const row of activityRows) {
    if (!allowed.has(row.semesterKey)) continue;
    const set = bySubject.get(row.subjectId);
    if (set) set.add(row.semesterKey);
  }
  return bySubject;
}

/** Jumlah semester aktif = banyaknya semester (urutan TA) yang punya aktivitas nilai. */
export function countActiveSemesters(
  orderedSemesterKeys: readonly string[],
  activeKeys: ReadonlySet<string>,
): number {
  return orderedSemesterKeys.filter((k) => activeKeys.has(k)).length;
}

export function countActiveSemestersBySubject(
  orderedSemesterKeys: readonly string[],
  subjectIds: readonly string[],
  activityRows: readonly RaporSemesterActivityRow[],
): Map<string, number> {
  const activeBySubject = buildActiveSemesterKeysBySubject(
    orderedSemesterKeys,
    subjectIds,
    activityRows,
  );
  const counts = new Map<string, number>();
  for (const subjectId of subjectIds) {
    const keys = activeBySubject.get(subjectId) ?? new Set<string>();
    counts.set(subjectId, countActiveSemesters(orderedSemesterKeys, keys));
  }
  return counts;
}

export function isRaporSemesterActiveForSubject(
  semesterKey: string,
  activeKeys: ReadonlySet<string>,
): boolean {
  return activeKeys.has(semesterKey);
}

export const RAPOR_SCORE_TYPES = [
  SCORE_TYPE.PENGETAHUAN,
  SCORE_TYPE.KETERAMPILAN,
] as const;
