CREATE TABLE "recommendation_experiment_assignments" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"experiment_id" varchar(64) NOT NULL,
	"variant" varchar(32) NOT NULL,
	"model_version" varchar(32) NOT NULL,
	"assigned_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "recommendation_exposures" (
	"id" uuid PRIMARY KEY NOT NULL,
	"viewer_user_id" uuid NOT NULL,
	"candidate_user_id" uuid NOT NULL,
	"recommendation_mode" varchar(32) NOT NULL,
	"recommendation_version" varchar(32) DEFAULT 'v1' NOT NULL,
	"feature_version" varchar(32) DEFAULT 'v1' NOT NULL,
	"rank_position" integer NOT NULL,
	"score" double precision NOT NULL,
	"request_id" varchar(64) NOT NULL,
	"surfaced_at" timestamp with time zone DEFAULT now() NOT NULL,
	"metadata" jsonb
);
--> statement-breakpoint
CREATE TABLE "recommendation_model_versions" (
	"id" uuid PRIMARY KEY NOT NULL,
	"version" varchar(32) NOT NULL,
	"name" varchar(100) NOT NULL,
	"mode" varchar(32) NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"weights" jsonb NOT NULL,
	"config" jsonb NOT NULL,
	"rollout_percentage" integer DEFAULT 100 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"activated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_recommendation_features" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"feature_version" varchar(32) DEFAULT 'v1' NOT NULL,
	"features" jsonb NOT NULL,
	"computed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "recommendation_experiment_assignments" ADD CONSTRAINT "recommendation_experiment_assignments_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recommendation_exposures" ADD CONSTRAINT "recommendation_exposures_viewer_user_id_users_id_fk" FOREIGN KEY ("viewer_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recommendation_exposures" ADD CONSTRAINT "recommendation_exposures_candidate_user_id_users_id_fk" FOREIGN KEY ("candidate_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_recommendation_features" ADD CONSTRAINT "user_recommendation_features_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "idx_rec_exp_user_experiment" ON "recommendation_experiment_assignments" USING btree ("user_id","experiment_id");--> statement-breakpoint
CREATE INDEX "idx_rec_exp_experiment_variant" ON "recommendation_experiment_assignments" USING btree ("experiment_id","variant");--> statement-breakpoint
CREATE INDEX "idx_rec_exposures_viewer_candidate" ON "recommendation_exposures" USING btree ("viewer_user_id","candidate_user_id","surfaced_at");--> statement-breakpoint
CREATE INDEX "idx_rec_exposures_viewer_surfaced" ON "recommendation_exposures" USING btree ("viewer_user_id","surfaced_at");--> statement-breakpoint
CREATE INDEX "idx_rec_exposures_request" ON "recommendation_exposures" USING btree ("request_id");--> statement-breakpoint
CREATE INDEX "idx_rec_exposures_candidate" ON "recommendation_exposures" USING btree ("candidate_user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_rec_model_version_mode" ON "recommendation_model_versions" USING btree ("version","mode");--> statement-breakpoint
CREATE INDEX "idx_rec_model_is_active" ON "recommendation_model_versions" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "idx_user_rec_features_computed_at" ON "user_recommendation_features" USING btree ("computed_at");--> statement-breakpoint
CREATE INDEX "idx_user_rec_features_version" ON "user_recommendation_features" USING btree ("feature_version");