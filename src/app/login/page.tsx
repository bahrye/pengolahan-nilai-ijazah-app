import { redirect } from "next/navigation";

import { auth, signOut } from "@/auth";
import { LOGIN_SIGNED_OUT_PATH } from "@/lib/auth-sign-out-path";

import { LoginExperience } from "./LoginExperience";

export default async function LoginPage(props: {
  searchParams?: Promise<{
    callbackUrl?: string;
    reset?: string;
    error?: string;
    signedOut?: string;
  }>;
}) {
  const session = await auth();
  const sp = (await props.searchParams) ?? {};
  const callbackUrl =
    sp.callbackUrl && sp.callbackUrl.startsWith("/") ? sp.callbackUrl : "/";
  const signedOut = sp.signedOut === "1";

  if (session?.user) {
    if (signedOut) {
      await signOut({ redirectTo: LOGIN_SIGNED_OUT_PATH });
    } else {
      redirect(callbackUrl);
    }
  }

  const passwordResetDone = sp.reset === "1";
  const googleNotRegistered = sp.error === "google_not_registered";
  const googleSubscriptionRequired = sp.error === "subscription_required";
  const googleAccountNotLinked = sp.error === "OAuthAccountNotLinked";
  const accountDeactivated = sp.error === "account_deactivated";
  const schoolDeactivated = sp.error === "school_deactivated";

  return (
    <div className="app-shell min-h-[100dvh]">
      <LoginExperience
        callbackUrl={callbackUrl}
        signedOut={signedOut}
        passwordResetDone={passwordResetDone}
        googleNotRegistered={googleNotRegistered}
        googleSubscriptionRequired={googleSubscriptionRequired}
        googleAccountNotLinked={googleAccountNotLinked}
        accountDeactivated={accountDeactivated}
        schoolDeactivated={schoolDeactivated}
      />
    </div>
  );
}
