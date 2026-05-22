-- Isolasi tenant di Postgres (lapisan kedua, opsional).
-- Aktifkan di aplikasi: DATABASE_TENANT_RLS=1 + gunakan runInTenantTransaction / runWithRlsBypass.
-- Pemilik tabel (user Prisma default) masih melewati RLS kecuali FORCE ROW LEVEL SECURITY diaktifkan
-- pada role runtime terpisah (disarankan untuk produksi sensitif).

CREATE OR REPLACE FUNCTION app_rls_is_bypass() RETURNS boolean AS $$
  SELECT coalesce(nullif(current_setting('app.rls_bypass', true), ''), 'off') = 'on';
$$ LANGUAGE sql STABLE;

CREATE OR REPLACE FUNCTION app_rls_school_id() RETURNS text AS $$
  SELECT nullif(current_setting('app.current_school_id', true), '');
$$ LANGUAGE sql STABLE;

-- Kebijakan standar: baris milik sekolah sesi ATAU mode bypass (superadmin).
CREATE OR REPLACE FUNCTION app_rls_school_row_allowed(row_school_id text) RETURNS boolean AS $$
  SELECT app_rls_is_bypass()
    OR (app_rls_school_id() IS NOT NULL AND row_school_id = app_rls_school_id());
$$ LANGUAGE sql STABLE;

DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'AcademicYear',
    'ClassRoom',
    'Semester',
    'Teacher',
    'TeachingAssignment',
    'Student',
    'Subject',
    'SchoolGradingConfig',
    'GradeEntry',
    'ExamScoreLock',
    'RaporScoreLock',
    'SchoolSubscription',
    'SubscriptionPayment',
    'SchoolSubscriptionPeriod'
  ]
  LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS tenant_isolation ON %I', t);
    EXECUTE format(
      'CREATE POLICY tenant_isolation ON %I FOR ALL USING (app_rls_school_row_allowed("schoolId")) WITH CHECK (app_rls_school_row_allowed("schoolId"))',
      t
    );
  END LOOP;
END $$;

-- Sekolah: akses baris yang id-nya sama dengan konteks tenant.
ALTER TABLE "School" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "School";
CREATE POLICY tenant_isolation ON "School" FOR ALL
  USING (app_rls_is_bypass() OR "id" = app_rls_school_id())
  WITH CHECK (app_rls_is_bypass() OR "id" = app_rls_school_id());
