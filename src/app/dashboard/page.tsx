import { redirect } from "next/navigation";

import { auth } from "@/auth";

export default async function DashboardIndexPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const r = session.user.role;
  if (r === "SISWA") redirect("/dashboard/pengumuman");
  if (r === "GURU") redirect("/dashboard/input/nilai-ujian");
  if (r === "ADMIN_SEKOLAH") redirect("/dashboard/peta-situs");
  redirect("/dashboard/sekolah");
}
