-- CreateEnum
CREATE TYPE "ExamInputPolicy" AS ENUM ('LOCKED', 'OPEN', 'LIMITED');

-- AlterTable
ALTER TABLE "School" ADD COLUMN "examInputPolicy" "ExamInputPolicy" NOT NULL DEFAULT 'OPEN',
ADD COLUMN "examInputWindowStart" TIMESTAMP(3),
ADD COLUMN "examInputWindowEnd" TIMESTAMP(3);
