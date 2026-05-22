-- AlterTable
ALTER TABLE "SchoolSubscription" ADD COLUMN "activePackage" "SubscriptionPlanPackage";

-- Backfill: sekolah yang masih berlangganan — paket dari pembayaran terakhir yang disetujui
UPDATE "SchoolSubscription" s
SET "activePackage" = sub."package"
FROM (
  SELECT DISTINCT ON (p."schoolId")
    p."schoolId",
    p."package"
  FROM "SubscriptionPayment" p
  WHERE p."status" = 'APPROVED'
  ORDER BY p."schoolId", p."reviewedAt" DESC NULLS LAST, p."createdAt" DESC
) sub
WHERE s."schoolId" = sub."schoolId"
  AND s."subscriptionEndsAt" IS NOT NULL
  AND s."subscriptionEndsAt" > NOW()
  AND s."activePackage" IS NULL;
