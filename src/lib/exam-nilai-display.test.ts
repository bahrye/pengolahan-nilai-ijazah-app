import { describe, expect, it } from "vitest";

import { formatExamNilaiPrint, roundExamNilaiForPrint } from "@/lib/exam-nilai-display";

describe("roundExamNilaiForPrint", () => {
  it("membulatkan ke bilangan bulat terdekat", () => {
    expect(roundExamNilaiForPrint(93.64)).toBe(94);
    expect(roundExamNilaiForPrint(95.5)).toBe(96);
    expect(roundExamNilaiForPrint(93.4)).toBe(93);
  });
});

describe("formatExamNilaiPrint", () => {
  it("menampilkan tanpa desimal", () => {
    expect(formatExamNilaiPrint(93.64)).toBe("94");
    expect(formatExamNilaiPrint(95.5)).toBe("96");
  });
});
