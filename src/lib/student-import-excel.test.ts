import { describe, expect, it } from "vitest";

import {
  normalizeImportedClassName,
  parseBirthDateToIso,
} from "./student-import-excel";

describe("student-import-excel", () => {
  it("normalizeImportedClassName strips Kelas prefix", () => {
    expect(normalizeImportedClassName("Kelas 9")).toBe("9");
    expect(normalizeImportedClassName("kelas XII")).toBe("XII");
    expect(normalizeImportedClassName("IX.1")).toBe("IX.1");
    expect(normalizeImportedClassName("")).toBeNull();
  });

  it("parseBirthDateToIso accepts ISO and dd-mm-yyyy", () => {
    expect(parseBirthDateToIso("2011-06-04")).toBe("2011-06-04");
    expect(parseBirthDateToIso("04-06-2011")).toBe("2011-06-04");
    expect(parseBirthDateToIso("4/6/2011")).toBe("2011-06-04");
    expect(parseBirthDateToIso("")).toBeNull();
  });
});
