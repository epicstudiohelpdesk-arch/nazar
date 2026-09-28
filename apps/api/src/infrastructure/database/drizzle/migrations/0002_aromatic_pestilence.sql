CREATE TABLE "profiles" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"display_name" varchar(64) NOT NULL,
	"date_of_birth" date NOT NULL,
	"gender" varchar(32) NOT NULL,
	"bio" text,
	"occupation" varchar(128),
	"education" varchar(128),
	"city" varchar(128),
	"country_code" varchar(2),
	"latitude" double precision,
	"longitude" double precision,
	"location" "geography",
	"visibility" varchar(16) DEFAULT 'DRAFT' NOT NULL,
	"completion_status" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "profiles_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE "profile_preferences" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"min_age" integer DEFAULT 18 NOT NULL,
	"max_age" integer DEFAULT 99 NOT NULL,
	"gender_preferences" jsonb NOT NULL,
	"max_distance_km" integer DEFAULT 50 NOT NULL,
	"relationship_intent" varchar(32) DEFAULT 'LONG_TERM' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "profile_preferences_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE "interests" (
	"id" uuid PRIMARY KEY NOT NULL,
	"name" varchar(64) NOT NULL,
	"slug" varchar(64) NOT NULL,
	"category" varchar(64) NOT NULL,
	"status" varchar(16) DEFAULT 'ACTIVE' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "interests_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "profile_interests" (
	"id" uuid PRIMARY KEY NOT NULL,
	"profile_id" uuid NOT NULL,
	"interest_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "profile_prompt_definitions" (
	"id" uuid PRIMARY KEY NOT NULL,
	"prompt" varchar(255) NOT NULL,
	"category" varchar(64) NOT NULL,
	"status" varchar(16) DEFAULT 'ACTIVE' NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "profile_prompts" (
	"id" uuid PRIMARY KEY NOT NULL,
	"profile_id" uuid NOT NULL,
	"prompt_definition_id" uuid NOT NULL,
	"answer" text NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "profile_media" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"profile_id" uuid NOT NULL,
	"object_key" varchar(255) NOT NULL,
	"media_type" varchar(16) DEFAULT 'IMAGE' NOT NULL,
	"mime_type" varchar(64) NOT NULL,
	"status" varchar(16) DEFAULT 'PENDING' NOT NULL,
	"width" integer,
	"height" integer,
	"size_bytes" integer,
	"checksum" varchar(64),
	"position" integer DEFAULT 0 NOT NULL,
	"is_primary" boolean DEFAULT false NOT NULL,
	"expires_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "profile_media_object_key_unique" UNIQUE("object_key")
);
--> statement-breakpoint
ALTER TABLE "profiles" ADD CONSTRAINT "profiles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "profile_preferences" ADD CONSTRAINT "profile_preferences_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "profile_interests" ADD CONSTRAINT "profile_interests_profile_id_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "profile_interests" ADD CONSTRAINT "profile_interests_interest_id_interests_id_fk" FOREIGN KEY ("interest_id") REFERENCES "public"."interests"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "profile_prompts" ADD CONSTRAINT "profile_prompts_profile_id_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "profile_prompts" ADD CONSTRAINT "profile_prompts_prompt_definition_id_profile_prompt_definitions_id_fk" FOREIGN KEY ("prompt_definition_id") REFERENCES "public"."profile_prompt_definitions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "profile_media" ADD CONSTRAINT "profile_media_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "profile_media" ADD CONSTRAINT "profile_media_profile_id_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "idx_profiles_user_id" ON "profiles" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_profiles_visibility" ON "profiles" USING btree ("visibility");--> statement-breakpoint
CREATE INDEX "idx_profiles_location" ON "profiles" USING gist ("location");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_profile_preferences_user_id" ON "profile_preferences" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_interests_slug" ON "interests" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "idx_interests_status" ON "interests" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_profile_interests_unique" ON "profile_interests" USING btree ("profile_id","interest_id");--> statement-breakpoint
CREATE INDEX "idx_profile_interests_profile_id" ON "profile_interests" USING btree ("profile_id");--> statement-breakpoint
CREATE INDEX "idx_profile_interests_interest_id" ON "profile_interests" USING btree ("interest_id");--> statement-breakpoint
CREATE INDEX "idx_prompt_definitions_status" ON "profile_prompt_definitions" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_profile_prompts_unique" ON "profile_prompts" USING btree ("profile_id","prompt_definition_id");--> statement-breakpoint
CREATE INDEX "idx_profile_prompts_profile_id" ON "profile_prompts" USING btree ("profile_id");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_profile_media_object_key" ON "profile_media" USING btree ("object_key");--> statement-breakpoint
CREATE INDEX "idx_profile_media_profile_id" ON "profile_media" USING btree ("profile_id");--> statement-breakpoint
CREATE INDEX "idx_profile_media_user_id" ON "profile_media" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_profile_media_status" ON "profile_media" USING btree ("status");