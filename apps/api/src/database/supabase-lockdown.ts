import type { QueryRunner } from 'typeorm';

export async function lockdownSupabaseTables(queryRunner: QueryRunner) {
  await queryRunner.query(`
    DO $lockdown$
    DECLARE
      target record;
      role_name text;
    BEGIN
      FOR target IN
        SELECT schemaname, tablename
        FROM pg_tables
        WHERE schemaname = 'public' AND tablename LIKE 'skedulei\\_%' ESCAPE '\\'
      LOOP
        EXECUTE format('ALTER TABLE %I.%I ENABLE ROW LEVEL SECURITY', target.schemaname, target.tablename);
        FOREACH role_name IN ARRAY ARRAY['anon', 'authenticated'] LOOP
          IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = role_name) THEN
            EXECUTE format('REVOKE ALL ON TABLE %I.%I FROM %I', target.schemaname, target.tablename, role_name);
          END IF;
        END LOOP;
      END LOOP;
    END
    $lockdown$;
  `);
}

export async function disableSupabaseRls(queryRunner: QueryRunner) {
  await queryRunner.query(`
    DO $lockdown$
    DECLARE
      target record;
    BEGIN
      FOR target IN
        SELECT schemaname, tablename
        FROM pg_tables
        WHERE schemaname = 'public' AND tablename LIKE 'skedulei\\_%' ESCAPE '\\'
      LOOP
        EXECUTE format('ALTER TABLE %I.%I DISABLE ROW LEVEL SECURITY', target.schemaname, target.tablename);
      END LOOP;
    END
    $lockdown$;
  `);
}
