-- CreateEnum
CREATE TYPE "GuruTugasTambahanStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED');

-- AlterTable
ALTER TABLE "School" ADD COLUMN "isSatminkal" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "User" ADD COLUMN "activeSchoolId" TEXT;

-- DropIndex: satu user boleh beberapa baris Teacher (beda sekolah)
DROP INDEX IF EXISTS "Teacher_userId_key";

-- CreateIndex
CREATE UNIQUE INDEX "Teacher_schoolId_userId_key" ON "Teacher"("schoolId", "userId");

-- CreateIndex
CREATE INDEX "Teacher_userId_idx" ON "Teacher"("userId");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_activeSchoolId_fkey" FOREIGN KEY ("activeSchoolId") REFERENCES "School"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateTable
CREATE TABLE "GuruTugasTambahanRequest" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "homeTeacherId" TEXT NOT NULL,
    "hostSchoolId" TEXT NOT NULL,
    "initiatedByUserId" TEXT NOT NULL,
    "initiatedBySchoolId" TEXT NOT NULL,
    "status" "GuruTugasTambahanStatus" NOT NULL DEFAULT 'PENDING',
    "decidedByUserId" TEXT,
    "decidedBySchoolId" TEXT,
    "decidedAt" TIMESTAMP(3),
    "rejectReason" TEXT,

    CONSTRAINT "GuruTugasTambahanRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "GuruTugasTambahanRequest_status_hostSchoolId_idx" ON "GuruTugasTambahanRequest"("status", "hostSchoolId");

-- CreateIndex
CREATE INDEX "GuruTugasTambahanRequest_status_initiatedBySchoolId_idx" ON "GuruTugasTambahanRequest"("status", "initiatedBySchoolId");

-- CreateIndex
CREATE INDEX "GuruTugasTambahanRequest_homeTeacherId_hostSchoolId_idx" ON "GuruTugasTambahanRequest"("homeTeacherId", "hostSchoolId");

-- AddForeignKey
ALTER TABLE "GuruTugasTambahanRequest" ADD CONSTRAINT "GuruTugasTambahanRequest_homeTeacherId_fkey" FOREIGN KEY ("homeTeacherId") REFERENCES "Teacher"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GuruTugasTambahanRequest" ADD CONSTRAINT "GuruTugasTambahanRequest_hostSchoolId_fkey" FOREIGN KEY ("hostSchoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GuruTugasTambahanRequest" ADD CONSTRAINT "GuruTugasTambahanRequest_initiatedByUserId_fkey" FOREIGN KEY ("initiatedByUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GuruTugasTambahanRequest" ADD CONSTRAINT "GuruTugasTambahanRequest_decidedByUserId_fkey" FOREIGN KEY ("decidedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
