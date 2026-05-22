import { redirect } from "next/navigation";

import { ChangeOwnPasswordForm } from "@/components/account/ChangeOwnPasswordForm";
import { prisma } from "@/lib/prisma";
import { changeAdminOwnPasswordAction } from "@/server/actions/admin-self-password";
import { requirePlatformSchoolAdmin } from "@/server/session";

export default async function UbahPasswordAdminPage() {
  const ctx = await requirePlatformSchoolAdmin();
  if (ctx.role !== "ADMIN_SEKOLAH") {
    redirect("/dashboard");
  }

  const user = await prisma.user.findUnique({
    where: { id: ctx.userId },
    select: { passwordHash: true },
  });
  if (!user?.passwordHash) {
    return (
      <div className="mx-auto w-full max-w-lg space-y-4">
        <h1 className="ui-page-title">Ubah password</h1>
        <div className="ui-card ui-card-tight border-amber-200/80 bg-amber-50/60 text-sm text-amber-950 dark:border-amber-900/50 dark:bg-amber-950/35 dark:text-amber-100">
          <p className="leading-relaxed">
            Akun Anda masuk lewat Google tanpa sandi terpisah. Kelola sandi di akun Google Anda, atau
            hubungi pengelola sistem.
          </p>
        </div>
      </div>
    );
  }

  return (
    <ChangeOwnPasswordForm
      description="Ganti sandi login email administrator sekolah. Sandi baru berlaku untuk masuk berikutnya."
      currentPasswordPlaceholder="Sandi saat ini"
      successMessage="Sandi administrator berhasil diubah."
      onSubmit={changeAdminOwnPasswordAction}
    />
  );
}
