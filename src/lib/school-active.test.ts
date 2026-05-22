import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    school: {
      findUnique: vi.fn(),
    },
  },
}));

import { prisma } from "@/lib/prisma";
import { isSchoolActiveForAccess } from "@/lib/school-active";

describe("isSchoolActiveForAccess", () => {
  it("false jika sekolah tidak aktif", async () => {
    vi.mocked(prisma.school.findUnique).mockResolvedValue({ isActive: false } as never);
    await expect(isSchoolActiveForAccess("school-1")).resolves.toBe(false);
  });

  it("true jika sekolah aktif", async () => {
    vi.mocked(prisma.school.findUnique).mockResolvedValue({ isActive: true } as never);
    await expect(isSchoolActiveForAccess("school-1")).resolves.toBe(true);
  });
});
