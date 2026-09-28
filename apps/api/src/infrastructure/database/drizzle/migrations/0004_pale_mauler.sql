CREATE TABLE "user_interactions" (
	"id" uuid PRIMARY KEY NOT NULL,
	"actor_user_id" uuid NOT NULL,
	"target_user_id" uuid NOT NULL,
	"type" varchar(16) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "chk_user_interactions_no_self" CHECK ("user_interactions"."actor_user_id" <> "user_interactions"."target_user_id"),
	CONSTRAINT "chk_user_interactions_type" CHECK ("user_interactions"."type" IN ('LIKE', 'PASS'))
);
--> statement-breakpoint
CREATE TABLE "matches" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_a_id" uuid NOT NULL,
	"user_b_id" uuid NOT NULL,
	"status" varchar(16) DEFAULT 'ACTIVE' NOT NULL,
	"matched_at" timestamp with time zone DEFAULT now() NOT NULL,
	"unmatched_by_user_id" uuid,
	"unmatched_at" timestamp with time zone,
	"unmatched_reason" varchar(256),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "chk_matches_normalized_pair" CHECK ("matches"."user_a_id" < "matches"."user_b_id"),
	CONSTRAINT "chk_matches_status" CHECK ("matches"."status" IN ('ACTIVE', 'UNMATCHED'))
);
--> statement-breakpoint
ALTER TABLE "user_interactions" ADD CONSTRAINT "user_interactions_actor_user_id_users_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_interactions" ADD CONSTRAINT "user_interactions_target_user_id_users_id_fk" FOREIGN KEY ("target_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "matches" ADD CONSTRAINT "matches_user_a_id_users_id_fk" FOREIGN KEY ("user_a_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "matches" ADD CONSTRAINT "matches_user_b_id_users_id_fk" FOREIGN KEY ("user_b_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "matches" ADD CONSTRAINT "matches_unmatched_by_user_id_users_id_fk" FOREIGN KEY ("unmatched_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "idx_user_interactions_actor_target" ON "user_interactions" USING btree ("actor_user_id","target_user_id");--> statement-breakpoint
CREATE INDEX "idx_user_interactions_actor_type" ON "user_interactions" USING btree ("actor_user_id","type");--> statement-breakpoint
CREATE INDEX "idx_user_interactions_target_type" ON "user_interactions" USING btree ("target_user_id","type");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_matches_user_a_user_b" ON "matches" USING btree ("user_a_id","user_b_id");--> statement-breakpoint
CREATE INDEX "idx_matches_user_a_status" ON "matches" USING btree ("user_a_id","status");--> statement-breakpoint
CREATE INDEX "idx_matches_user_b_status" ON "matches" USING btree ("user_b_id","status");--> statement-breakpoint
CREATE INDEX "idx_matches_status_matched_at" ON "matches" USING btree ("status","matched_at");