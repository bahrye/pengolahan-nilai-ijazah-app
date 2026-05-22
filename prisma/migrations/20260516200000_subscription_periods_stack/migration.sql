-- AlterTable
ALTER TABLE "SchoolSubscription" ADD COLUMN "studentQuotaAllowance" INTEGER NOT NULL DEFAULT 150;

-- CreateTable
CREATE TABLE "SchoolSubscriptionPeriod" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "package" "SubscriptionPlanPackage" NOT NULL,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "paymentId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SchoolSubscriptionPeriod_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SchoolSubscriptionPeriod_paymentId_key" ON "SchoolSubscriptionPeriod"("paymentId");

-- CreateIndex
CREATE INDEX "SchoolSubscriptionPeriod_schoolId_startsAt_idx" ON "SchoolSubscriptionPeriod"("schoolId", "startsAt");

-- CreateIndex
CREATE INDEX "SchoolSubscriptionPeriod_schoolId_endsAt_idx" ON "SchoolSubscriptionPeriod"("schoolId", "endsAt");

-- AddForeignKey
ALTER TABLE "SchoolSubscriptionPeriod" ADD CONSTRAINT "SchoolSubscriptionPeriod_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SchoolSubscriptionPeriod" ADD CONSTRAINT "SchoolSubscriptionPeriod_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "SubscriptionPayment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Backfill allowance dari paket aktif lama
UPDATE "SchoolSubscription" s
SET "studentQuotaAllowance" = CASE
  WHEN s."activePackage" = 'MONTHS_6' THEN 550
  WHEN s."activePackage" = 'MONTHS_3' THEN 300
  WHEN s."activePackage" = 'MONTHS_9' THEN 150
  ELSE 150
END
WHERE s."subscriptionEndsAt" IS NOT NULL
  AND s."subscriptionEndsAt" > NOW();

-- Backfill satu periode dari langganan aktif yang sudah ada
INSERT INTO "SchoolSubscriptionPeriod" ("id", "schoolId", "package", "startsAt", "endsAt", "createdAt")
SELECT
  'mig_' || s."schoolId",
  s."schoolId",
  COALESCE(s."activePackage", 'MONTHS_3'),
  COALESCE(s."updatedAt", s."createdAt", NOW()) - INTERVAL '1 month',
  s."subscriptionEndsAt",
  NOW()
FROM "SchoolSubscription" s
WHERE s."subscriptionEndsAt" IS NOT NULL
  AND s."subscriptionEndsAt" > NOW()
  AND NOT EXISTS (
    SELECT 1 FROM "SchoolSubscriptionPeriod" p WHERE p."schoolId" = s."schoolId"
  );

-- Backfill dari riwayat pembayaran disetujui (kronologis) untuk sekolah tanpa periode
DO $$
DECLARE
  r RECORD;
  pay RECORD;
  allowance INT;
BEGIN
  FOR r IN
    SELECT DISTINCT s."schoolId"
    FROM "SchoolSubscription" s
    WHERE NOT EXISTS (
      SELECT 1 FROM "SchoolSubscriptionPeriod" p WHERE p."schoolId" = s."schoolId"
    )
  LOOP
    allowance := 150;
    FOR pay IN
      SELECT p."id", p."package", p."reviewedAt", p."createdAt"
      FROM "SubscriptionPayment" p
      WHERE p."schoolId" = r."schoolId"
        AND p."status" = 'APPROVED'
      ORDER BY COALESCE(p."reviewedAt", p."createdAt") ASC
    LOOP
      -- Periode minimal; kuota allowance disesuaikan di bawah
      INSERT INTO "SchoolSubscriptionPeriod" ("id", "schoolId", "package", "startsAt", "endsAt", "paymentId", "createdAt")
      VALUES (
        'migpay_' || pay."id",
        r."schoolId",
        pay."package",
        COALESCE(pay."reviewedAt", pay."createdAt"),
        COALESCE(pay."reviewedAt", pay."createdAt") + (
          CASE pay."package"
            WHEN 'MONTHS_3' THEN INTERVAL '3 months'
            WHEN 'MONTHS_6' THEN INTERVAL '6 months'
            ELSE INTERVAL '9 months'
          END
        ),
        pay."id",
        NOW()
      )
      ON CONFLICT DO NOTHING;

      IF pay."package" = 'MONTHS_3' THEN
        IF allowance <= 150 THEN allowance := 300;
        ELSE allowance := allowance + 300;
        END IF;
      ELSIF pay."package" = 'MONTHS_6' THEN
        IF allowance <= 150 THEN allowance := 550;
        ELSE allowance := allowance + 550;
        END IF;
      END IF;
    END LOOP;

    UPDATE "SchoolSubscription"
    SET "studentQuotaAllowance" = allowance
    WHERE "schoolId" = r."schoolId";
  END LOOP;
END $$;
