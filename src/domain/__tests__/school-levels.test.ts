import { describe, expect, it } from "vitest";

import { mapBentukPendidikanToJenjang } from "../school-levels";

describe("mapBentukPendidikanToJenjang", () => {
  it("memetakan bentuk umum Kemdikbud", () => {
    expect(mapBentukPendidikanToJenjang("SD")).toBe("SD");
    expect(mapBentukPendidikanToJenjang("SMP")).toBe("SMP");
    expect(mapBentukPendidikanToJenjang("SMA")).toBe("SMA");
    expect(mapBentukPendidikanToJenjang("SMK")).toBe("SMK");
  });

  it("memetakan madrasah", () => {
    expect(mapBentukPendidikanToJenjang("MI")).toBe("MI");
    expect(mapBentukPendidikanToJenjang("MTs")).toBe("MTS");
    expect(mapBentukPendidikanToJenjang("MA")).toBe("MA");
    expect(mapBentukPendidikanToJenjang("MADRASAH ALIYAH")).toBe("MA");
  });

  it("memetakan PAUD & PKBM", () => {
    expect(mapBentukPendidikanToJenjang("TK")).toBe("TK");
    expect(mapBentukPendidikanToJenjang("KB")).toBe("KB");
    expect(mapBentukPendidikanToJenjang("PKBM")).toBe("PKBM");
  });

  it("SMA diutamakan sebelum MA (singkatan)", () => {
    expect(mapBentukPendidikanToJenjang("SMA")).toBe("SMA");
  });
});
