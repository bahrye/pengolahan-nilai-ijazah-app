import { prisma } from "@/lib/prisma";
import { fetchGuruSchoolContextRowsForUser } from "@/server/guru-school-contexts";
import { isSchoolLoginAllowed } from "@/server/subscription-access";

export type GuruLoginSchoolResult =
  | { ok: true }
  | { ok: false; reason: "no_assignment" | "subscription_blocked" };

/**
 * Pilih konteks sekolah guru yang boleh login (langganan aktif) dan simpan ke `activeSchoolId`.
 */
export async function applyGuruLoginSchoolContext(
  userId: string,
  homeSchoolId: string | null,
): Promise<GuruLoginSchoolResult> {
  const contexts = await fetchGuruSchoolContextRowsForUser(userId, homeSchoolId);
  if (contexts.length === 0) {
    return { ok: false, reason: "no_assignment" };
  }

  const subscribed = [];
  for (const ctx of contexts) {
    if (await isSchoolLoginAllowed(ctx.schoolId)) {
      subscribed.push(ctx);
    }
  }
  if (subscribed.length === 0) {
    return { ok: false, reason: "subscription_blocked" };
  }

  const chosen = subscribed.find((c) => c.isHome) ?? subscribed[0];
  if (!chosen) {
    return { ok: false, reason: "no_assignment" };
  }

  const nextActive =
    homeSchoolId != null && chosen.schoolId === homeSchoolId ? null : chosen.schoolId;

  await prisma.user.update({
    where: { id: userId },
    data: { activeSchoolId: nextActive },
  });

  return { ok: true };
}
