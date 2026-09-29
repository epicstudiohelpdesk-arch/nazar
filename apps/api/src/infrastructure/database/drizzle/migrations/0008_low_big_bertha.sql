CREATE TABLE "notification_preferences" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"match_notifications_enabled" boolean DEFAULT true NOT NULL,
	"message_notifications_enabled" boolean DEFAULT true NOT NULL,
	"like_notifications_enabled" boolean DEFAULT true NOT NULL,
	"safety_notifications_enabled" boolean DEFAULT true NOT NULL,
	"system_notifications_enabled" boolean DEFAULT true NOT NULL,
	"message_preview_enabled" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"source_event_id" uuid,
	"type" varchar(64) NOT NULL,
	"title" varchar(256) NOT NULL,
	"body" text NOT NULL,
	"data" jsonb,
	"priority" varchar(16) DEFAULT 'NORMAL' NOT NULL,
	"read_at" timestamp with time zone,
	"expires_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notification_delivery_jobs" (
	"id" uuid PRIMARY KEY NOT NULL,
	"notification_id" uuid NOT NULL,
	"device_id" uuid NOT NULL,
	"status" varchar(32) DEFAULT 'PENDING' NOT NULL,
	"attempt_count" integer DEFAULT 0 NOT NULL,
	"max_attempts" integer DEFAULT 5 NOT NULL,
	"available_at" timestamp with time zone DEFAULT now() NOT NULL,
	"locked_at" timestamp with time zone,
	"locked_by" varchar(128),
	"last_attempt_at" timestamp with time zone,
	"next_attempt_at" timestamp with time zone,
	"provider" varchar(16) NOT NULL,
	"provider_message_id" varchar(256),
	"last_error_code" varchar(64),
	"last_error_message" text,
	"last_error_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "devices" ALTER COLUMN "push_token" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "devices" ADD COLUMN "push_provider" varchar(16) DEFAULT 'APNS' NOT NULL;--> statement-breakpoint
ALTER TABLE "devices" ADD COLUMN "device_identifier" varchar(256);--> statement-breakpoint
ALTER TABLE "devices" ADD COLUMN "os_version" varchar(32);--> statement-breakpoint
ALTER TABLE "devices" ADD COLUMN "locale" varchar(32);--> statement-breakpoint
ALTER TABLE "devices" ADD COLUMN "timezone" varchar(64);--> statement-breakpoint
ALTER TABLE "devices" ADD COLUMN "last_seen_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "devices" ADD COLUMN "revoked_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "notification_preferences" ADD CONSTRAINT "notification_preferences_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_delivery_jobs" ADD CONSTRAINT "notification_delivery_jobs_notification_id_notifications_id_fk" FOREIGN KEY ("notification_id") REFERENCES "public"."notifications"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_delivery_jobs" ADD CONSTRAINT "notification_delivery_jobs_device_id_devices_id_fk" FOREIGN KEY ("device_id") REFERENCES "public"."devices"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "idx_notif_prefs_user_id" ON "notification_preferences" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_notifications_user_created" ON "notifications" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "idx_notifications_user_read" ON "notifications" USING btree ("user_id","read_at");--> statement-breakpoint
CREATE INDEX "idx_notifications_user_type" ON "notifications" USING btree ("user_id","type");--> statement-breakpoint
CREATE INDEX "idx_notifications_expires" ON "notifications" USING btree ("expires_at");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_notifications_event_user_type" ON "notifications" USING btree ("source_event_id","user_id","type");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_delivery_jobs_notif_device" ON "notification_delivery_jobs" USING btree ("notification_id","device_id");--> statement-breakpoint
CREATE INDEX "idx_delivery_jobs_status_available" ON "notification_delivery_jobs" USING btree ("status","available_at");--> statement-breakpoint
CREATE INDEX "idx_delivery_jobs_device" ON "notification_delivery_jobs" USING btree ("device_id");--> statement-breakpoint
CREATE INDEX "idx_delivery_jobs_locked" ON "notification_delivery_jobs" USING btree ("status","locked_at");--> statement-breakpoint
CREATE INDEX "idx_devices_platform_provider" ON "devices" USING btree ("platform","push_provider");--> statement-breakpoint
CREATE INDEX "idx_devices_push_token" ON "devices" USING btree ("push_token");--> statement-breakpoint
CREATE INDEX "idx_devices_identifier" ON "devices" USING btree ("device_identifier");--> statement-breakpoint
CREATE INDEX "idx_devices_user_revoked" ON "devices" USING btree ("user_id","revoked_at");