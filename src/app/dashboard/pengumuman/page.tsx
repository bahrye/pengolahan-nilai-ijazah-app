import { auth } from "@/auth";
import { redirect } from "next/navigation";

import { PengumumanSiswaClient } from "./PengumumanSiswaClient";

export default async function PengumumanPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const role = session.user.role;

  if (role === "SISWA") {
    return <PengumumanSiswaClient mode="siswa" />;
  }

  if (role === "ADMIN_SEKOLAH" || role === "SUPERADMIN") {
    return <PengumumanSiswaClient mode="admin-preview" />;
  }

  redirect("/dashboard");
}
