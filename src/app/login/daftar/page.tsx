import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, AlertTriangle } from "lucide-react";

import { auth } from "@/auth";
import { getPlatformMaintenance } from "@/lib/platform-maintenance";

import { RegisterForm } from "./RegisterForm";

export default async function DaftarPage(props: {
  searchParams?: Promise<{ callbackUrl?: string }>;
}) {
  const session = await auth();
  const sp = (await props.searchParams) ?? {};
  const callbackUrl =
    sp.callbackUrl && sp.callbackUrl.startsWith("/") ? sp.callbackUrl : "/";
  if (session?.user) redirect(callbackUrl);

  const maintenance = await getPlatformMaintenance();

  if (!maintenance.isRegistrationOpen) {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center p-4 bg-slate-50 dark:bg-slate-950">
        <div className="ui-card w-full max-w-md text-center space-y-6 shadow-xl">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-900/30">
            <AlertTriangle className="h-8 w-8 text-amber-600 dark:text-amber-500" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100 mb-2">
              Registrasi Ditutup
            </h1>
            <p className="text-slate-600 dark:text-slate-400">
              Mohon maaf, saat ini registrasi akun telah ditutup oleh sistem.
              Silakan hubungi administrator jika Anda memiliki pertanyaan.
            </p>
          </div>
          <div className="pt-4">
            <Link
              href="/login"
              className="ui-btn ui-btn-primary inline-flex w-full items-center justify-center gap-2"
            >
              <ArrowLeft className="h-4 w-4" />
              Kembali ke Login
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="app-shell">
      <RegisterForm callbackUrl={callbackUrl} />
    </div>
  );
}
