import { redirect } from "next/navigation";

import { auth } from "@/auth";

import { LoginSiswaExperience } from "./LoginSiswaExperience";

export default async function LoginSiswaPage(props: {
  searchParams?: Promise<{ callbackUrl?: string }>;
}) {
  const session = await auth();
  const sp = (await props.searchParams) ?? {};
  const callbackUrl =
    sp.callbackUrl && sp.callbackUrl.startsWith("/") ? sp.callbackUrl : "/";
  if (session?.user) {
    if (session.user.role === "SISWA") redirect(callbackUrl);
    redirect("/dashboard");
  }

  return (
    <div className="app-shell min-h-[100dvh]">
      <LoginSiswaExperience callbackUrl={callbackUrl} />
    </div>
  );
}
