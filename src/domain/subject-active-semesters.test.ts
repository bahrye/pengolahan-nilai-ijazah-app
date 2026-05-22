import { describe, expect, it } from "vitest";

import {
  buildActiveSemesterKeysBySubject,
  countActiveSemesters,
  countActiveSemestersBySubject,
  isRaporSemesterActiveForSubject,
} from "./subject-active-semesters";

describe("subject-active-semesters", () => {
  const ordered = ["s1", "s2", "s3", "s4", "s5"];
  const subjA = "subj-mtk";

  it("counts semesters with any rapor activity", () => {
    const rows = [
      { subjectId: subjA, semesterKey: "s1" },
      { subjectId: subjA, semesterKey: "s3" },
    ];
    const active = buildActiveSemesterKeysBySubject(ordered, [subjA], rows);
    expect(countActiveSemesters(ordered, active.get(subjA)!)).toBe(2);
    expect(isRaporSemesterActiveForSubject("s2", active.get(subjA)!)).toBe(false);
    expect(isRaporSemesterActiveForSubject("s1", active.get(subjA)!)).toBe(true);
  });

  it("semester with no entries is not active", () => {
    const counts = countActiveSemestersBySubject(ordered, [subjA], [
      { subjectId: subjA, semesterKey: "s1" },
    ]);
    expect(counts.get(subjA)).toBe(1);
  });

  it("ignores semester keys outside tahun ajaran", () => {
    const active = buildActiveSemesterKeysBySubject(ordered, [subjA], [
      { subjectId: subjA, semesterKey: "legacy" },
    ]);
    expect(countActiveSemesters(ordered, active.get(subjA)!)).toBe(0);
  });
});
