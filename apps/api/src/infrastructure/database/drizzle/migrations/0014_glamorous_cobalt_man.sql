CREATE TABLE "profile_audio_prompts" (
	"id" uuid PRIMARY KEY NOT NULL,
	"profile_id" uuid NOT NULL,
	"prompt_definition_id" uuid NOT NULL,
	"audio_url" text NOT NULL,
	"duration_seconds" integer NOT NULL,
	"waveform_peaks" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "photo_bandit_stats" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"media_id" uuid NOT NULL,
	"impressions" integer DEFAULT 0 NOT NULL,
	"likes" integer DEFAULT 0 NOT NULL,
	"score" double precision DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "post_date_feedbacks" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"match_id" uuid NOT NULL,
	"did_meet" boolean NOT NULL,
	"would_see_again" boolean,
	"sentiment_tags" jsonb,
	"private_notes" text,
	"close_match" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "date_checkins" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"match_id" uuid NOT NULL,
	"meeting_location" varchar(255) NOT NULL,
	"meeting_at" timestamp with time zone NOT NULL,
	"check_in_deadline" timestamp with time zone NOT NULL,
	"emergency_contact_name" varchar(128) NOT NULL,
	"emergency_contact_phone" varchar(32) NOT NULL,
	"status" varchar(16) DEFAULT 'SCHEDULED' NOT NULL,
	"checked_in_at" timestamp with time zone,
	"sos_triggered_at" timestamp with time zone,
	"sos_latitude" double precision,
	"sos_longitude" double precision,
	"sos_note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "call_sessions" (
	"id" uuid PRIMARY KEY NOT NULL,
	"conversation_id" uuid NOT NULL,
	"caller_user_id" uuid NOT NULL,
	"callee_user_id" uuid NOT NULL,
	"call_type" varchar(16) NOT NULL,
	"status" varchar(16) DEFAULT 'RINGING' NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"ended_at" timestamp with time zone,
	"duration_seconds" integer DEFAULT 0,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "blocked_contacts" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"phone_hash" varchar(64) NOT NULL,
	"label" varchar(128),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "photo_verifications" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"gesture" varchar(32) NOT NULL,
	"selfie_photo_url" text NOT NULL,
	"status" varchar(16) DEFAULT 'APPROVED' NOT NULL,
	"challenge_token" varchar(255) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"resolved_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "matches" DROP CONSTRAINT "chk_matches_status";--> statement-breakpoint
ALTER TABLE "messages" DROP CONSTRAINT "chk_messages_type";--> statement-breakpoint
ALTER TABLE "profiles" ADD COLUMN "relationship_intent" varchar(32);--> statement-breakpoint
ALTER TABLE "profiles" ADD COLUMN "family_plans" varchar(32);--> statement-breakpoint
ALTER TABLE "profiles" ADD COLUMN "is_verified" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "profiles" ADD COLUMN "verified_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "profiles" ADD COLUMN "incognito_mode" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "profiles" ADD COLUMN "smart_photos" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "profiles" ADD COLUMN "travel_mode" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "profiles" ADD COLUMN "travel_latitude" double precision;--> statement-breakpoint
ALTER TABLE "profiles" ADD COLUMN "travel_longitude" double precision;--> statement-breakpoint
ALTER TABLE "profiles" ADD COLUMN "travel_city" varchar(128);--> statement-breakpoint
ALTER TABLE "profiles" ADD COLUMN "travel_country" varchar(128);--> statement-breakpoint
ALTER TABLE "profile_preferences" ADD COLUMN "age_is_dealbreaker" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "profile_preferences" ADD COLUMN "distance_is_dealbreaker" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "profile_preferences" ADD COLUMN "intent_is_dealbreaker" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "profile_preferences" ADD COLUMN "family_plans" varchar(32);--> statement-breakpoint
ALTER TABLE "profile_preferences" ADD COLUMN "family_plans_is_dealbreaker" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "user_interactions" ADD COLUMN "target_attachment_type" varchar(16) DEFAULT 'PROFILE' NOT NULL;--> statement-breakpoint
ALTER TABLE "user_interactions" ADD COLUMN "target_attachment_id" uuid;--> statement-breakpoint
ALTER TABLE "user_interactions" ADD COLUMN "comment" text;--> statement-breakpoint
ALTER TABLE "matches" ADD COLUMN "expires_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "messages" ADD COLUMN "media_url" text;--> statement-breakpoint
ALTER TABLE "messages" ADD COLUMN "duration_seconds" integer;--> statement-breakpoint
ALTER TABLE "messages" ADD COLUMN "waveform_peaks" jsonb;--> statement-breakpoint
ALTER TABLE "event_rsvps" ADD COLUMN "looking_for_plus_one" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "event_rsvps" ADD COLUMN "plus_one_note" varchar(255);--> statement-breakpoint
ALTER TABLE "profile_audio_prompts" ADD CONSTRAINT "profile_audio_prompts_profile_id_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "profile_audio_prompts" ADD CONSTRAINT "profile_audio_prompts_prompt_definition_id_profile_prompt_definitions_id_fk" FOREIGN KEY ("prompt_definition_id") REFERENCES "public"."profile_prompt_definitions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "photo_bandit_stats" ADD CONSTRAINT "photo_bandit_stats_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "photo_bandit_stats" ADD CONSTRAINT "photo_bandit_stats_media_id_profile_media_id_fk" FOREIGN KEY ("media_id") REFERENCES "public"."profile_media"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "post_date_feedbacks" ADD CONSTRAINT "post_date_feedbacks_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "post_date_feedbacks" ADD CONSTRAINT "post_date_feedbacks_match_id_matches_id_fk" FOREIGN KEY ("match_id") REFERENCES "public"."matches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "date_checkins" ADD CONSTRAINT "date_checkins_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "date_checkins" ADD CONSTRAINT "date_checkins_match_id_matches_id_fk" FOREIGN KEY ("match_id") REFERENCES "public"."matches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "call_sessions" ADD CONSTRAINT "call_sessions_conversation_id_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "call_sessions" ADD CONSTRAINT "call_sessions_caller_user_id_users_id_fk" FOREIGN KEY ("caller_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "call_sessions" ADD CONSTRAINT "call_sessions_callee_user_id_users_id_fk" FOREIGN KEY ("callee_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "blocked_contacts" ADD CONSTRAINT "blocked_contacts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "photo_verifications" ADD CONSTRAINT "photo_verifications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "idx_profile_audio_prompts_unique" ON "profile_audio_prompts" USING btree ("profile_id","prompt_definition_id");--> statement-breakpoint
CREATE INDEX "idx_profile_audio_prompts_profile_id" ON "profile_audio_prompts" USING btree ("profile_id");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_photo_bandit_user_media" ON "photo_bandit_stats" USING btree ("user_id","media_id");--> statement-breakpoint
CREATE INDEX "idx_photo_bandit_user_score" ON "photo_bandit_stats" USING btree ("user_id","score");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_post_date_feedbacks_user_match" ON "post_date_feedbacks" USING btree ("user_id","match_id");--> statement-breakpoint
CREATE INDEX "idx_post_date_feedbacks_match_id" ON "post_date_feedbacks" USING btree ("match_id");--> statement-breakpoint
CREATE INDEX "idx_post_date_feedbacks_user_id" ON "post_date_feedbacks" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_date_checkins_user" ON "date_checkins" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_date_checkins_match" ON "date_checkins" USING btree ("match_id");--> statement-breakpoint
CREATE INDEX "idx_date_checkins_status" ON "date_checkins" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_date_checkins_deadline" ON "date_checkins" USING btree ("check_in_deadline");--> statement-breakpoint
CREATE INDEX "idx_call_sessions_conversation" ON "call_sessions" USING btree ("conversation_id");--> statement-breakpoint
CREATE INDEX "idx_call_sessions_caller" ON "call_sessions" USING btree ("caller_user_id");--> statement-breakpoint
CREATE INDEX "idx_call_sessions_callee" ON "call_sessions" USING btree ("callee_user_id");--> statement-breakpoint
CREATE INDEX "idx_call_sessions_status" ON "call_sessions" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_blocked_contacts_user_phone_hash" ON "blocked_contacts" USING btree ("user_id","phone_hash");--> statement-breakpoint
CREATE INDEX "idx_blocked_contacts_user_id" ON "blocked_contacts" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_blocked_contacts_phone_hash" ON "blocked_contacts" USING btree ("phone_hash");--> statement-breakpoint
CREATE INDEX "idx_photo_verifications_user_id" ON "photo_verifications" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_photo_verifications_status" ON "photo_verifications" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_matches_status_expires_at" ON "matches" USING btree ("status","expires_at");--> statement-breakpoint
CREATE INDEX "idx_event_rsvps_plus_one" ON "event_rsvps" USING btree ("event_id","looking_for_plus_one");--> statement-breakpoint
ALTER TABLE "matches" ADD CONSTRAINT "chk_matches_status" CHECK ("matches"."status" IN ('ACTIVE', 'QUEUED', 'EXPIRED', 'UNMATCHED'));--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "chk_messages_type" CHECK ("messages"."message_type" IN ('TEXT', 'IMAGE', 'AUDIO', 'SYSTEM'));