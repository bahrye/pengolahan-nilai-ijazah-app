"use client";

import { studentQuotaLabelForLimit } from "@/lib/subscription/student-quota";

import { useSubscriptionUsage } from "./SubscriptionUsageProvider";

export function StudentQuotaBanner({
  pendingAdds = 0,
  className = "",
}: {
  /** Perkiraan penambahan baru (mis. dari preview import). */
  pendingAdds?: number;
  className?: string;
}) {
  const usage = useSubscriptionUsage();
  if (!usage || usage.studentQuotaUnlimited) return null;

  const { studentAddsUsed, studentAddsRemaining, studentQuotaLimit } = usage;
  const limitLabel =
    usage.effectiveAccess?.studentQuotaAllowance != null
      ? `${usage.effectiveAccess.studentQuotaAllowance} siswa`
      : studentQuotaLabelForLimit(studentQuotaLimit);
  const afterPending =
    pendingAdds > 0
      ? Math.max(0, studentAddsRemaining - pendingAdds)
      : null;

  return (
    <p className={`ui-muted text-sm ${className}`.trim()}>
      Kuota penambahan siswa:{" "}
      <strong className="tabular-nums">{studentAddsRemaining}</strong> siswa lagi
      dapat ditambahkan ({studentAddsUsed}/{limitLabel} terpakai, kumulatif).
      {afterPending !== null && pendingAdds > 0 ? (
        <>
          {" "}
          Setelah import ini: sisa perkiraan{" "}
          <strong className="tabular-nums">{afterPending}</strong>.
        </>
      ) : null}
    </p>
  );
}
