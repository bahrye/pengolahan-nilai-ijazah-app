"use server";

import { prisma } from "@/lib/prisma";
import { requireAuthStrict } from "@/server/session";

export async function verifyAdminSessionActiveAction(): Promise<
  { ok: true } | { ok: false; reason: "deactivated" }
> {
  const session = await requireAuthStrict();
  if (session.user.role !== "ADMIN_SEKOLAH") {
    return { ok: true };
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { isActive: true },
  });

  if (!user?.isActive) {
    return { ok: false, reason: "deactivated" };
  }

  return { ok: true };
}
