import { redirect } from "next/navigation";

import { auth } from "@/auth";

import { BantuanSuperadminClient } from "./BantuanSuperadminClient";

export default async function BantuanSuperadminPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const role = session.user.role;
  if (role !== "ADMIN_SEKOLAH" && role !== "SUPERADMIN") {
    redirect("/dashboard");
  }

  return <BantuanSuperadminClient />;
}
