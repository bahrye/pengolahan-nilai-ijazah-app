-- Invariant aplikasi selain sekolah belum punya tahun ajaran: tepat satu baris aktif per schoolId.
-- Indeks ini memastikan paling banyak satu aktif per sekolah; logika aplikasi melarang menghapus aktivitas menjadi nol aktif secara eksplisit.

WITH ranked AS (
  SELECT id,
         ROW_NUMBER() OVER (
           PARTITION BY "schoolId"
           ORDER BY "updatedAt" DESC, id DESC
         ) AS rn
  FROM "AcademicYear"
  WHERE "isActive" = true
)
UPDATE "AcademicYear" AS ay
SET "isActive" = false
WHERE ay.id IN (SELECT id FROM ranked WHERE rn > 1);

CREATE UNIQUE INDEX IF NOT EXISTS "AcademicYear_one_active_per_school_idx"
ON "AcademicYear" ("schoolId")
WHERE "isActive" = true;
