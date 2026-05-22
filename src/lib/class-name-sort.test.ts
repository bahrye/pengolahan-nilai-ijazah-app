import { describe, expect, it } from "vitest";

import {
  compareClassName,
  lowestClassLabel,
  uniqueClassLabelsSorted,
} from "./class-name-sort";

describe("compareClassName", () => {
  it("orders numeric grades ascending", () => {
    expect(compareClassName("6", "7")).toBeLessThan(0);
    expect(compareClassName("10", "9")).toBeGreaterThan(0);
  });

  it("orders roman numerals ascending", () => {
    expect(compareClassName("X", "XI")).toBeLessThan(0);
  });
});

describe("uniqueClassLabelsSorted", () => {
  it("returns lowest class first", () => {
    const sorted = uniqueClassLabelsSorted([
      { classLabel: "9" },
      { classLabel: "6" },
      { classLabel: "7" },
    ]);
    expect(sorted[0]).toBe("6");
    expect(lowestClassLabel([{ classLabel: "9" }, { classLabel: "6" }])).toBe("6");
  });
});
