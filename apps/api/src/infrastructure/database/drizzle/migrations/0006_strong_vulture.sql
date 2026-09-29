CREATE TABLE "user_blocks" (
	"id" uuid PRIMARY KEY NOT NULL,
	"blocker_user_id" uuid NOT NULL,
	"blocked_user_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "moderation_cases" (
	"id" uuid PRIMARY KEY NOT NULL,
	"subject_user_id" uuid NOT NULL,
	"source_type" varchar(32) NOT NULL,
	"source_id" uuid,
	"case_type" varchar(64) NOT NULL,
	"status" varchar(32) DEFAULT 'OPEN' NOT NULL,
	"priority" varchar(16) DEFAULT 'NORMAL' NOT NULL,
	"assigned_to" uuid,
	"resolution_decision" varchar(64),
	"opened_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"resolved_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "moderation_case_events" (
	"id" uuid PRIMARY KEY NOT NULL,
	"case_id" uuid NOT NULL,
	"event_type" varchar(64) NOT NULL,
	"actor_user_id" uuid,
	"payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "reports" (
	"id" uuid PRIMARY KEY NOT NULL,
	"reporter_user_id" uuid NOT NULL,
	"target_type" varchar(32) NOT NULL,
	"target_id" uuid NOT NULL,
	"target_user_id" uuid,
	"reason_code" varchar(64) NOT NULL,
	"description" text,
	"metadata" jsonb,
	"status" varchar(32) DEFAULT 'OPEN' NOT NULL,
	"priority" varchar(16) DEFAULT 'NORMAL' NOT NULL,
	"moderation_case_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"resolved_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "user_restrictions" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"restriction_type" varchar(64) NOT NULL,
	"source_case_id" uuid,
	"reason_code" varchar(64) NOT NULL,
	"starts_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"revoked_at" timestamp with time zone,
	"revoked_by_user_id" uuid
);
--> statement-breakpoint
ALTER TABLE "user_blocks" ADD CONSTRAINT "user_blocks_blocker_user_id_users_id_fk" FOREIGN KEY ("blocker_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_blocks" ADD CONSTRAINT "user_blocks_blocked_user_id_users_id_fk" FOREIGN KEY ("blocked_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "moderation_cases" ADD CONSTRAINT "moderation_cases_subject_user_id_users_id_fk" FOREIGN KEY ("subject_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "moderation_case_events" ADD CONSTRAINT "moderation_case_events_case_id_moderation_cases_id_fk" FOREIGN KEY ("case_id") REFERENCES "public"."moderation_cases"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reports" ADD CONSTRAINT "reports_reporter_user_id_users_id_fk" FOREIGN KEY ("reporter_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reports" ADD CONSTRAINT "reports_target_user_id_users_id_fk" FOREIGN KEY ("target_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reports" ADD CONSTRAINT "reports_moderation_case_id_moderation_cases_id_fk" FOREIGN KEY ("moderation_case_id") REFERENCES "public"."moderation_cases"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_restrictions" ADD CONSTRAINT "user_restrictions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_restrictions" ADD CONSTRAINT "user_restrictions_source_case_id_moderation_cases_id_fk" FOREIGN KEY ("source_case_id") REFERENCES "public"."moderation_cases"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "idx_user_blocks_blocker_blocked" ON "user_blocks" USING btree ("blocker_user_id","blocked_user_id");--> statement-breakpoint
CREATE INDEX "idx_user_blocks_blocked_user" ON "user_blocks" USING btree ("blocked_user_id");--> statement-breakpoint
CREATE INDEX "idx_user_blocks_blocker_created" ON "user_blocks" USING btree ("blocker_user_id","created_at");--> statement-breakpoint
CREATE INDEX "idx_mod_cases_subject" ON "moderation_cases" USING btree ("subject_user_id");--> statement-breakpoint
CREATE INDEX "idx_mod_cases_status_priority" ON "moderation_cases" USING btree ("status","priority");--> statement-breakpoint
CREATE INDEX "idx_mod_cases_opened" ON "moderation_cases" USING btree ("opened_at");--> statement-breakpoint
CREATE INDEX "idx_case_events_case_created" ON "moderation_case_events" USING btree ("case_id","created_at");--> statement-breakpoint
CREATE INDEX "idx_reports_reporter_created" ON "reports" USING btree ("reporter_user_id","created_at");--> statement-breakpoint
CREATE INDEX "idx_reports_target" ON "reports" USING btree ("target_type","target_id");--> statement-breakpoint
CREATE INDEX "idx_reports_target_user" ON "reports" USING btree ("target_user_id");--> statement-breakpoint
CREATE INDEX "idx_reports_status_priority" ON "reports" USING btree ("status","priority");--> statement-breakpoint
CREATE INDEX "idx_reports_dedup" ON "reports" USING btree ("reporter_user_id","target_type","target_id","reason_code");--> statement-breakpoint
CREATE INDEX "idx_user_restrictions_active" ON "user_restrictions" USING btree ("user_id","restriction_type","revoked_at","expires_at");--> statement-breakpoint
CREATE INDEX "idx_user_restrictions_type" ON "user_restrictions" USING btree ("restriction_type");