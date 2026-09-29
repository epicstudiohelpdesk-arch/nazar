CREATE TABLE "analytics_cohort_definitions" (
	"id" varchar(64) PRIMARY KEY NOT NULL,
	"name" varchar(128) NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"activation_event" varchar(64) NOT NULL,
	"criteria" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "analytics_daily_metrics" (
	"id" uuid PRIMARY KEY NOT NULL,
	"metric_date" varchar(10) NOT NULL,
	"metric_name" varchar(64) NOT NULL,
	"dimension" varchar(64) DEFAULT 'total' NOT NULL,
	"dimension_value" varchar(64) DEFAULT 'all' NOT NULL,
	"value" double precision NOT NULL,
	"computed_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "analytics_event_quarantine" (
	"id" uuid PRIMARY KEY NOT NULL,
	"event_id" varchar(64) NOT NULL,
	"event_name" varchar(64),
	"failure_reason" varchar(128) NOT NULL,
	"raw_payload" jsonb NOT NULL,
	"source" varchar(32) NOT NULL,
	"error_details" text,
	"received_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "analytics_events" (
	"id" uuid PRIMARY KEY NOT NULL,
	"event_name" varchar(64) NOT NULL,
	"event_version" integer DEFAULT 1 NOT NULL,
	"occurred_at" timestamp with time zone NOT NULL,
	"received_at" timestamp with time zone DEFAULT now() NOT NULL,
	"producer" varchar(16) NOT NULL,
	"actor_user_id" uuid,
	"anonymous_id" varchar(64),
	"session_id" varchar(64),
	"device_id" varchar(64),
	"platform" varchar(16),
	"app_version" varchar(32),
	"locale" varchar(16),
	"request_id" varchar(64),
	"privacy_class" varchar(16) DEFAULT 'INTERNAL' NOT NULL,
	"properties" jsonb NOT NULL,
	"context" jsonb,
	"ingestion_status" varchar(16) DEFAULT 'ACCEPTED' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "analytics_experiment_assignments" (
	"id" uuid PRIMARY KEY NOT NULL,
	"experiment_id" varchar(64) NOT NULL,
	"subject_id" varchar(128) NOT NULL,
	"variant" varchar(32) NOT NULL,
	"assigned_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "analytics_experiment_definitions" (
	"id" varchar(64) PRIMARY KEY NOT NULL,
	"name" varchar(128) NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"status" varchar(32) DEFAULT 'ACTIVE' NOT NULL,
	"variants" jsonb NOT NULL,
	"traffic_percentage" integer DEFAULT 100 NOT NULL,
	"salt" varchar(64) NOT NULL,
	"start_at" timestamp with time zone,
	"end_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "analytics_experiment_exposures" (
	"id" uuid PRIMARY KEY NOT NULL,
	"experiment_id" varchar(64) NOT NULL,
	"subject_id" varchar(128) NOT NULL,
	"variant" varchar(32) NOT NULL,
	"exposed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"properties" jsonb
);
--> statement-breakpoint
CREATE TABLE "analytics_funnel_definitions" (
	"id" varchar(64) PRIMARY KEY NOT NULL,
	"name" varchar(128) NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"steps" jsonb NOT NULL,
	"window_seconds" integer DEFAULT 86400 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "analytics_events" ADD CONSTRAINT "analytics_events_actor_user_id_users_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "idx_analytics_daily_metric_unique" ON "analytics_daily_metrics" USING btree ("metric_date","metric_name","dimension","dimension_value");--> statement-breakpoint
CREATE INDEX "idx_analytics_daily_metric_date" ON "analytics_daily_metrics" USING btree ("metric_date");--> statement-breakpoint
CREATE INDEX "idx_analytics_quarantine_received" ON "analytics_event_quarantine" USING btree ("received_at");--> statement-breakpoint
CREATE INDEX "idx_analytics_quarantine_reason" ON "analytics_event_quarantine" USING btree ("failure_reason");--> statement-breakpoint
CREATE INDEX "idx_analytics_events_occurred_at" ON "analytics_events" USING btree ("occurred_at");--> statement-breakpoint
CREATE INDEX "idx_analytics_events_name_occurred" ON "analytics_events" USING btree ("event_name","occurred_at");--> statement-breakpoint
CREATE INDEX "idx_analytics_events_actor_occurred" ON "analytics_events" USING btree ("actor_user_id","occurred_at");--> statement-breakpoint
CREATE INDEX "idx_analytics_events_anonymous" ON "analytics_events" USING btree ("anonymous_id");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_exp_assign_unique" ON "analytics_experiment_assignments" USING btree ("experiment_id","subject_id");--> statement-breakpoint
CREATE INDEX "idx_exp_assign_experiment" ON "analytics_experiment_assignments" USING btree ("experiment_id");--> statement-breakpoint
CREATE INDEX "idx_exp_exposures_exp_variant" ON "analytics_experiment_exposures" USING btree ("experiment_id","variant","exposed_at");--> statement-breakpoint
CREATE INDEX "idx_exp_exposures_subject" ON "analytics_experiment_exposures" USING btree ("subject_id");