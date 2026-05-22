-- CreateEnum
CREATE TYPE "SklModelSource" AS ENUM ('SYSTEM', 'GOOGLE_DRIVE');

-- AlterTable
ALTER TABLE "School" ADD COLUMN "sklModelSource" "SklModelSource" NOT NULL DEFAULT 'GOOGLE_DRIVE';
