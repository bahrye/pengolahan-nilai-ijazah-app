import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { requireTenantAdmin } from "@/server/session";

import { CekPeringkatClient } from "./CekPeringkatClient";

export default async function CekPeringkatPage() {
  const session = await auth();
  if (session?.user?.role === "GURU") {
    redirect("/dashboard");
  }

  const { schoolId } = await requireTenantAdmin();

  const activeYear = await prisma.academicYear.findFirst({
    where: { schoolId, isActive: true },
  });

  const classRooms = activeYear
    ? await prisma.classRoom.findMany({
        where: { academicYearId: activeYear.id, schoolId },
        orderBy: { name: "asc" },
        select: { id: true, name: true },
      })
    : [];

  return (
    <CekPeringkatClient
      classRooms={classRooms}
      activeYearLabel={activeYear?.label ?? "TA aktif"}
    />
  );
}
