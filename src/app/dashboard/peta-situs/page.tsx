import { auth } from "@/auth";
import { redirect } from "next/navigation";

import { prisma } from "@/lib/prisma";
import { getGuruIsHomeroom } from "@/server/guru-homeroom";

import { PetaSitusClient } from "./PetaSitusClient";

export default async function PetaSitusPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const role = session.user.role;

  const schoolId = session.user.schoolId;
  const schoolJenjang =
    schoolId != null
      ? (
          await prisma.school.findUnique({
            where: { id: schoolId },
            select: { jenjang: true },
          })
        )?.jenjang ?? null
      : null;

  if (role === "ADMIN_SEKOLAH") {
    return (
      <PetaSitusClient
        variant="admin"
        schoolJenjang={schoolJenjang}
        viewerRole="ADMIN_SEKOLAH"
        initialTab="flow"
      />
    );
  }

  if (role === "SUPERADMIN") {
    return (
      <PetaSitusClient
        variant="admin"
        schoolJenjang={schoolJenjang}
        viewerRole="SUPERADMIN"
      />
    );
  }

  if (role === "GURU") {
    const isHomeroom = schoolId
      ? await getGuruIsHomeroom(session.user.id, schoolId)
      : false;
    return (
      <PetaSitusClient
        variant="guru"
        isHomeroom={isHomeroom}
        schoolJenjang={schoolJenjang}
      />
    );
  }

  if (role === "SISWA") {
    return <PetaSitusClient variant="siswa" />;
  }

  redirect("/dashboard");
}
