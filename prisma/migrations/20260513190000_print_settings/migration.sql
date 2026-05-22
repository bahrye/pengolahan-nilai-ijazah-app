-- CreateEnum
CREATE TYPE "PrintDateMode" AS ENUM ('AUTO_ON_SUBMIT', 'MANUAL');

-- AlterTable
ALTER TABLE "School" ADD COLUMN "printLetterheadUrl" TEXT,
ADD COLUMN "printLetterheadPublicId" TEXT,
ADD COLUMN "printSignaturePlace" TEXT,
ADD COLUMN "printDateMode" "PrintDateMode" NOT NULL DEFAULT 'AUTO_ON_SUBMIT',
ADD COLUMN "printManualDate" TIMESTAMP(3);
