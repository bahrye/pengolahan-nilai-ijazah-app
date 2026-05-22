-- CreateEnum
CREATE TYPE "SubscriptionPlanPackage" AS ENUM ('MONTHS_3', 'MONTHS_6', 'MONTHS_9');

-- CreateEnum
CREATE TYPE "SubscriptionTransferVia" AS ENUM ('SHOPEEPAY', 'SEABANK');

-- CreateEnum
CREATE TYPE "SubscriptionPayerCategory" AS ENUM ('EWALLET', 'BANK');

-- CreateEnum
CREATE TYPE "SubscriptionPaymentStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateTable
CREATE TABLE "SchoolSubscription" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "subscriptionEndsAt" TIMESTAMP(3),
    "studentAddsUsed" INTEGER NOT NULL DEFAULT 0,
    "freeUsageDate" TEXT,
    "freeUsageSeconds" INTEGER NOT NULL DEFAULT 0,
    "lastAccessAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SchoolSubscription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SubscriptionPayment" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "package" "SubscriptionPlanPackage" NOT NULL,
    "amountRp" INTEGER NOT NULL,
    "payerCategory" "SubscriptionPayerCategory" NOT NULL,
    "payerProvider" TEXT NOT NULL,
    "transferVia" "SubscriptionTransferVia" NOT NULL,
    "proofUrl" TEXT NOT NULL,
    "proofPublicId" TEXT,
    "status" "SubscriptionPaymentStatus" NOT NULL DEFAULT 'PENDING',
    "schoolNameSnapshot" TEXT NOT NULL,
    "npsnSnapshot" TEXT,
    "submittedByUserId" TEXT NOT NULL,
    "reviewedAt" TIMESTAMP(3),
    "reviewedByUserId" TEXT,
    "rejectNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SubscriptionPayment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SchoolSubscription_schoolId_key" ON "SchoolSubscription"("schoolId");

-- CreateIndex
CREATE INDEX "SubscriptionPayment_schoolId_status_idx" ON "SubscriptionPayment"("schoolId", "status");

-- AddForeignKey
ALTER TABLE "SchoolSubscription" ADD CONSTRAINT "SchoolSubscription_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubscriptionPayment" ADD CONSTRAINT "SubscriptionPayment_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Backfill subscription row for existing schools
INSERT INTO "SchoolSubscription" ("id", "schoolId", "studentAddsUsed", "freeUsageSeconds", "createdAt", "updatedAt")
SELECT 'sub_' || s."id", s."id", 0, 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "School" s
WHERE NOT EXISTS (
  SELECT 1 FROM "SchoolSubscription" sub WHERE sub."schoolId" = s."id"
);
