import { describe, expect, it } from "vitest";

import {
  examScoreTypesForSubject,
  gradeValidationCellKey,
  isRaporSemesterIgnoredForSubject,
  validateExamAspectCell,
  validateRaporAspectCell,
} from "./grade-validation";
import { SCORE_TYPE } from "./scoreTypes";

describe("grade-validation", () => {
  it("examScoreTypesForSubject", () => {
    expect(examScoreTypesForSubject("Ujian Madrasah")).toEqual([
      SCORE_TYPE.UJIAN_MADRASAH,
    ]);
    expect(examScoreTypesForSubject("Ujian Sekolah")).toEqual([
      SCORE_TYPE.UJIAN_MADRASAH,
    ]);
    expect(examScoreTypesForSubject("Ujian Praktek")).toEqual([
      SCORE_TYPE.UJIAN_PRAKTEK,
    ]);
    expect(examScoreTypesForSubject("Keduanya")).toEqual([
      SCORE_TYPE.UJIAN_MADRASAH,
      SCORE_TYPE.UJIAN_PRAKTEK,
    ]);
  });

  it("gradeValidationCellKey", () => {
    expect(gradeValidationCellKey("MAT", "tertulis")).toBe("MAT|tertulis");
    expect(gradeValidationCellKey("IPA", "pengetahuan")).toBe("IPA|pengetahuan");
  });

  it("validateExamAspectCell", () => {
    expect(validateExamAspectCell("Ujian Madrasah", "tertulis", 80)).toBe(
      "filled",
    );
    expect(validateExamAspectCell("Ujian Madrasah", "praktek", 90)).toBe(
      "ignored",
    );
    expect(validateExamAspectCell("Ujian Madrasah", "tertulis", null)).toBe(
      "empty",
    );
    expect(validateExamAspectCell("Keduanya", "tertulis", 80)).toBe("filled");
    expect(validateExamAspectCell("Keduanya", "praktek", undefined)).toBe(
      "empty",
    );
  });

  it("isRaporSemesterIgnoredForSubject (legacy index rule)", () => {
    expect(isRaporSemesterIgnoredForSubject(3, 3, 5)).toBe(true);
    expect(isRaporSemesterIgnoredForSubject(2, 3, 5)).toBe(false);
  });

  it("validateRaporAspectCell", () => {
    expect(
      validateRaporAspectCell(
        { semesterActiveForSubject: false, aspectMode: "BOTH" },
        "pengetahuan",
        null,
      ),
    ).toBe("ignored");

    expect(
      validateRaporAspectCell(
        { semesterActiveForSubject: true, aspectMode: "BOTH" },
        "pengetahuan",
        88,
      ),
    ).toBe("filled");

    expect(
      validateRaporAspectCell(
        { semesterActiveForSubject: true, aspectMode: "PENGETAHUAN_ONLY" },
        "keterampilan",
        90,
      ),
    ).toBe("ignored");

    expect(
      validateRaporAspectCell(
        { semesterActiveForSubject: true, aspectMode: "PENGETAHUAN_ONLY" },
        "pengetahuan",
        null,
      ),
    ).toBe("empty");

    expect(
      validateRaporAspectCell(
        {
          semesterActiveForSubject: true,
          aspectMode: "BOTH",
          peerScore: 88,
        },
        "keterampilan",
        undefined,
      ),
    ).toBe("ignored");

    expect(
      validateRaporAspectCell(
        {
          semesterActiveForSubject: true,
          aspectMode: "BOTH",
          peerScore: undefined,
        },
        "pengetahuan",
        undefined,
      ),
    ).toBe("empty");
  });
});
