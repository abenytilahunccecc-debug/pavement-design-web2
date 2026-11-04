-- Lock the tables against Supabase's public Data API (PostgREST).
--
-- The app never uses that API: the NestJS backend connects with the database owner role
-- (the Supabase "postgres" user in DATABASE_URL), checks the signed-in user itself and only
-- returns that user's own projects and designs. Table owners are not subject to RLS, so the
-- backend keeps working unchanged.
--
-- Supabase, however, also exposes every table in the "public" schema to its "anon" and
-- "authenticated" roles. Enabling RLS with NO policies denies those roles every row, and
-- revoking their privileges removes the tables from the API completely.
--
-- Any table added in a later migration needs the same two statements.

ALTER TABLE "users" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "projects" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "designs" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "_prisma_migrations" ENABLE ROW LEVEL SECURITY;

-- The anon / authenticated roles exist only on Supabase (not in the local Docker database).
DO $$
DECLARE
  api_role TEXT;
BEGIN
  FOREACH api_role IN ARRAY ARRAY['anon', 'authenticated'] LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = api_role) THEN
      EXECUTE format('REVOKE ALL ON TABLE "users", "projects", "designs", "_prisma_migrations" FROM %I', api_role);
    END IF;
  END LOOP;
END
$$;
