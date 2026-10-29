CREATE EXTENSION IF NOT EXISTS pgcrypto;
--> statement-breakpoint
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
--> statement-breakpoint
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'nazar_app_role') THEN
    CREATE ROLE nazar_app_role;
  END IF;
  GRANT USAGE ON SCHEMA public TO nazar_app_role;
  GRANT ALL ON ALL TABLES IN SCHEMA public TO nazar_app_role;
  GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO nazar_app_role;
  GRANT ALL ON ALL ROUTINES IN SCHEMA public TO nazar_app_role;
  ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO nazar_app_role;
  ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO nazar_app_role;
  ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON ROUTINES TO nazar_app_role;
  EXECUTE format('GRANT nazar_app_role TO %I', CURRENT_USER);
END $$;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION current_app_user_id() RETURNS uuid AS $$
BEGIN
  RETURN NULLIF(current_setting('app.current_user_id', true), '')::uuid;
EXCEPTION
  WHEN OTHERS THEN
    RETURN NULL;
END;
$$ LANGUAGE plpgsql STABLE;
--> statement-breakpoint
ALTER TABLE "profiles" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "profiles" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'profiles' AND policyname = 'profiles_tenant_isolation') THEN
    CREATE POLICY profiles_tenant_isolation ON "profiles"
      FOR ALL
      USING (current_app_user_id() IS NULL OR current_setting('app.is_admin', true) = 'true' OR user_id = current_app_user_id());
  END IF;
END $$;
--> statement-breakpoint
ALTER TABLE "sessions" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "sessions" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'sessions' AND policyname = 'sessions_tenant_isolation') THEN
    CREATE POLICY sessions_tenant_isolation ON "sessions"
      FOR ALL
      USING (current_app_user_id() IS NULL OR current_setting('app.is_admin', true) = 'true' OR user_id = current_app_user_id());
  END IF;
END $$;
--> statement-breakpoint
ALTER TABLE "matches" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "matches" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'matches' AND policyname = 'matches_tenant_isolation') THEN
    CREATE POLICY matches_tenant_isolation ON "matches"
      FOR ALL
      USING (current_app_user_id() IS NULL OR current_setting('app.is_admin', true) = 'true' OR user_a_id = current_app_user_id() OR user_b_id = current_app_user_id());
  END IF;
END $$;
--> statement-breakpoint
ALTER TABLE "conversations" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "conversations" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'conversations' AND policyname = 'conversations_tenant_isolation') THEN
    CREATE POLICY conversations_tenant_isolation ON "conversations"
      FOR ALL
      USING (current_app_user_id() IS NULL OR current_setting('app.is_admin', true) = 'true' OR EXISTS (
        SELECT 1 FROM "matches" m
        WHERE m.id = conversations.match_id
        AND (m.user_a_id = current_app_user_id() OR m.user_b_id = current_app_user_id())
      ));
  END IF;
END $$;
--> statement-breakpoint
ALTER TABLE "messages" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "messages" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'messages' AND policyname = 'messages_tenant_isolation') THEN
    CREATE POLICY messages_tenant_isolation ON "messages"
      FOR ALL
      USING (current_app_user_id() IS NULL OR current_setting('app.is_admin', true) = 'true' OR sender_user_id = current_app_user_id() OR EXISTS (
        SELECT 1 FROM "conversations" c
        JOIN "matches" m ON m.id = c.match_id
        WHERE c.id = messages.conversation_id
        AND (m.user_a_id = current_app_user_id() OR m.user_b_id = current_app_user_id())
      ));
  END IF;
END $$;
--> statement-breakpoint
ALTER TABLE "notifications" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "notifications" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'notifications' AND policyname = 'notifications_tenant_isolation') THEN
    CREATE POLICY notifications_tenant_isolation ON "notifications"
      FOR ALL
      USING (current_app_user_id() IS NULL OR current_setting('app.is_admin', true) = 'true' OR user_id = current_app_user_id());
  END IF;
END $$;
--> statement-breakpoint
ALTER TABLE "devices" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "devices" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'devices' AND policyname = 'devices_tenant_isolation') THEN
    CREATE POLICY devices_tenant_isolation ON "devices"
      FOR ALL
      USING (current_app_user_id() IS NULL OR current_setting('app.is_admin', true) = 'true' OR user_id = current_app_user_id());
  END IF;
END $$;
--> statement-breakpoint
ALTER TABLE "date_checkins" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "date_checkins" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'date_checkins' AND policyname = 'date_checkins_tenant_isolation') THEN
    CREATE POLICY date_checkins_tenant_isolation ON "date_checkins"
      FOR ALL
      USING (current_app_user_id() IS NULL OR current_setting('app.is_admin', true) = 'true' OR user_id = current_app_user_id());
  END IF;
END $$;
