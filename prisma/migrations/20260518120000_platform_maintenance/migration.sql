-- CreateTable
CREATE TABLE "PlatformMaintenance" (
    "id" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "endsAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlatformMaintenance_pkey" PRIMARY KEY ("id")
);

-- Satu baris default agar superadmin bisa langsung mengatur maintenance
INSERT INTO "PlatformMaintenance" ("id", "isActive", "updatedAt")
VALUES ('global', false, CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO NOTHING;
