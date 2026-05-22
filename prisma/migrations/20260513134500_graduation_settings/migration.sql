-- CreateEnum
CREATE TYPE "IjazahRekapVisibility" AS ENUM ('AT_ANNOUNCEMENT_TIME', 'AFTER_CHECK_ANNOUNCEMENT');

-- AlterTable
ALTER TABLE "School" ADD COLUMN "graduationAnnouncementAt" TIMESTAMP(3),
ADD COLUMN "ijazahRekapVisibility" "IjazahRekapVisibility" NOT NULL DEFAULT 'AFTER_CHECK_ANNOUNCEMENT';

-- AlterTable
ALTER TABLE "Student" ADD COLUMN "graduationAnnouncementAckAt" TIMESTAMP(3);
