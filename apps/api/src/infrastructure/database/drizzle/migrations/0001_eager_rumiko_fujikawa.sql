CREATE TABLE "session_token_history" (
	"id" uuid PRIMARY KEY NOT NULL,
	"session_id" uuid NOT NULL,
	"token_hash" varchar(64) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_identities" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"provider" varchar(32) NOT NULL,
	"provider_subject" varchar(255) NOT NULL,
	"email" varchar(255),
	"email_verified" boolean DEFAULT false NOT NULL,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_used_at" timestamp with time zone,
	CONSTRAINT "uq_user_identities_provider_subject" UNIQUE("provider","provider_subject")
);
--> statement-breakpoint
CREATE TABLE "passkeys" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"credential_id" varchar(512) NOT NULL,
	"public_key" text NOT NULL,
	"counter" integer DEFAULT 0 NOT NULL,
	"device_type" varchar(32),
	"backed_up" boolean DEFAULT false NOT NULL,
	"transports" jsonb,
	"aaguid" varchar(64),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_used_at" timestamp with time zone,
	CONSTRAINT "passkeys_credential_id_unique" UNIQUE("credential_id")
);
--> statement-breakpoint
CREATE TABLE "otp_challenges" (
	"id" uuid PRIMARY KEY NOT NULL,
	"identifier" varchar(255) NOT NULL,
	"identifier_type" varchar(16) NOT NULL,
	"otp_hash" varchar(64) NOT NULL,
	"salt" varchar(32) NOT NULL,
	"attempt_count" integer DEFAULT 0 NOT NULL,
	"max_attempts" integer DEFAULT 5 NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"consumed_at" timestamp with time zone,
	"ip_address" varchar(64),
	"device_id" varchar(128),
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "passkey_challenges" (
	"id" uuid PRIMARY KEY NOT NULL,
	"challenge" varchar(255) NOT NULL,
	"user_id" uuid,
	"purpose" varchar(32) NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"consumed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "passkey_challenges_challenge_unique" UNIQUE("challenge")
);
--> statement-breakpoint
ALTER TABLE "sessions" ADD COLUMN "revocation_reason" varchar(64);--> statement-breakpoint
ALTER TABLE "sessions" ADD COLUMN "last_active_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "security_events" ADD COLUMN "session_id" uuid;--> statement-breakpoint
ALTER TABLE "security_events" ADD COLUMN "device_id" uuid;--> statement-breakpoint
ALTER TABLE "session_token_history" ADD CONSTRAINT "session_token_history_session_id_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_identities" ADD CONSTRAINT "user_identities_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "passkeys" ADD CONSTRAINT "passkeys_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "passkey_challenges" ADD CONSTRAINT "passkey_challenges_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_session_token_history_lookup" ON "session_token_history" USING btree ("session_id","token_hash");--> statement-breakpoint
CREATE INDEX "idx_session_token_history_token_hash" ON "session_token_history" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX "idx_user_identities_user_id" ON "user_identities" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_passkeys_user_id" ON "passkeys" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_passkeys_credential_id" ON "passkeys" USING btree ("credential_id");--> statement-breakpoint
CREATE INDEX "idx_otp_challenges_identifier" ON "otp_challenges" USING btree ("identifier","identifier_type");--> statement-breakpoint
CREATE INDEX "idx_otp_challenges_expires_at" ON "otp_challenges" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "idx_passkey_challenges_challenge" ON "passkey_challenges" USING btree ("challenge");--> statement-breakpoint
CREATE INDEX "idx_passkey_challenges_expires_at" ON "passkey_challenges" USING btree ("expires_at");