import { redirect } from "next/navigation";

import { auth } from "@/auth";

import { ForgotPasswordForm } from "./ForgotPasswordForm";

export default async function LupaSandiPage() {
  const session = await auth();
  if (session?.user) redirect("/");

  return (
    <div className="app-shell">
      <ForgotPasswordForm />
    </div>
  );
}
