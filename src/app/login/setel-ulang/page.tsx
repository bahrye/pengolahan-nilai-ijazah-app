import Link from "next/link";
import { redirect } from "next/navigation";

import { auth } from "@/auth";

import { ResetPasswordForm } from "./ResetPasswordForm";

export default async function SetelUlangPage(props: {
  searchParams?: Promise<{ token?: string }>;
}) {
  const session = await auth();
  if (session?.user) redirect("/");

  const sp = (await props.searchParams) ?? {};
  const token = typeof sp.token === "string" ? sp.token.trim() : "";

  if (!token) {
    return (
      <div className="app-shell flex min-h-[100dvh] items-center justify-center px-4">
        <div className="ui-card ui-card-tight max-w-md text-center">
          <p className="font-semibold text-slate-900 dark:text-white">Tautan tidak ada atau salah</p>
          <p className="ui-muted mt-2 text-[13px]">
            Minta tautan baru lewat halaman lupa sandi atau hubungi admin.
          </p>
          <Link href="/login/lupa-sandi" className="ui-btn ui-btn-primary mt-5 inline-flex">
            Lupa sandi
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="app-shell">
      <ResetPasswordForm token={token} />
    </div>
  );
}
