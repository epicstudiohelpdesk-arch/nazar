CREATE TABLE "communities" (
	"id" uuid PRIMARY KEY NOT NULL,
	"creator_id" uuid NOT NULL,
	"name" varchar(100) NOT NULL,
	"slug" varchar(120) NOT NULL,
	"description" text NOT NULL,
	"avatar_media_id" uuid,
	"cover_media_id" uuid,
	"privacy" varchar(32) DEFAULT 'PUBLIC' NOT NULL,
	"member_count" integer DEFAULT 1 NOT NULL,
	"rules" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "chk_communities_privacy" CHECK ("communities"."privacy" IN ('PUBLIC', 'PRIVATE', 'HIDDEN'))
);
--> statement-breakpoint
CREATE TABLE "community_memberships" (
	"id" uuid PRIMARY KEY NOT NULL,
	"community_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"role" varchar(32) DEFAULT 'MEMBER' NOT NULL,
	"status" varchar(32) DEFAULT 'ACTIVE' NOT NULL,
	"joined_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "chk_community_member_role" CHECK ("community_memberships"."role" IN ('OWNER', 'ADMIN', 'MODERATOR', 'MEMBER')),
	CONSTRAINT "chk_community_member_status" CHECK ("community_memberships"."status" IN ('ACTIVE', 'PENDING', 'BANNED', 'LEFT'))
);
--> statement-breakpoint
CREATE TABLE "post_comments" (
	"id" uuid PRIMARY KEY NOT NULL,
	"post_id" uuid NOT NULL,
	"author_id" uuid NOT NULL,
	"parent_id" uuid,
	"content" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "post_reactions" (
	"id" uuid PRIMARY KEY NOT NULL,
	"post_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"reaction_type" varchar(32) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "chk_post_reactions_type" CHECK ("post_reactions"."reaction_type" IN ('LIKE', 'LOVE', 'CELEBRATE', 'SUPPORT', 'LAUGH'))
);
--> statement-breakpoint
CREATE TABLE "posts" (
	"id" uuid PRIMARY KEY NOT NULL,
	"author_id" uuid NOT NULL,
	"community_id" uuid,
	"content" text NOT NULL,
	"media_ids" jsonb,
	"visibility" varchar(32) DEFAULT 'PUBLIC' NOT NULL,
	"like_count" integer DEFAULT 0 NOT NULL,
	"comment_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "chk_posts_visibility" CHECK ("posts"."visibility" IN ('PUBLIC', 'COMMUNITY', 'FOLLOWERS'))
);
--> statement-breakpoint
CREATE TABLE "event_rsvps" (
	"id" uuid PRIMARY KEY NOT NULL,
	"event_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"status" varchar(32) DEFAULT 'GOING' NOT NULL,
	"promoted_from_waitlist_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "chk_event_rsvps_status" CHECK ("event_rsvps"."status" IN ('GOING', 'INTERESTED', 'CANCELLED', 'WAITLISTED'))
);
--> statement-breakpoint
CREATE TABLE "events" (
	"id" uuid PRIMARY KEY NOT NULL,
	"organizer_id" uuid NOT NULL,
	"community_id" uuid,
	"title" varchar(150) NOT NULL,
	"description" text NOT NULL,
	"cover_media_id" uuid,
	"type" varchar(32) DEFAULT 'PHYSICAL' NOT NULL,
	"status" varchar(32) DEFAULT 'PUBLISHED' NOT NULL,
	"start_at" timestamp with time zone NOT NULL,
	"end_at" timestamp with time zone NOT NULL,
	"location_name" varchar(255) NOT NULL,
	"location_address" text,
	"location_url" varchar(500),
	"latitude" double precision,
	"longitude" double precision,
	"capacity" integer,
	"attendee_count" integer DEFAULT 0 NOT NULL,
	"waitlist_count" integer DEFAULT 0 NOT NULL,
	"is_waitlist_enabled" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "chk_events_type" CHECK ("events"."type" IN ('ONLINE', 'PHYSICAL')),
	CONSTRAINT "chk_events_status" CHECK ("events"."status" IN ('DRAFT', 'PUBLISHED', 'CANCELLED', 'COMPLETED', 'ARCHIVED'))
);
--> statement-breakpoint
ALTER TABLE "communities" ADD CONSTRAINT "communities_creator_id_users_id_fk" FOREIGN KEY ("creator_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "community_memberships" ADD CONSTRAINT "community_memberships_community_id_communities_id_fk" FOREIGN KEY ("community_id") REFERENCES "public"."communities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "community_memberships" ADD CONSTRAINT "community_memberships_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "post_comments" ADD CONSTRAINT "post_comments_post_id_posts_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."posts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "post_comments" ADD CONSTRAINT "post_comments_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "post_comments" ADD CONSTRAINT "post_comments_parent_id_post_comments_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."post_comments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "post_reactions" ADD CONSTRAINT "post_reactions_post_id_posts_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."posts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "post_reactions" ADD CONSTRAINT "post_reactions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "posts" ADD CONSTRAINT "posts_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "posts" ADD CONSTRAINT "posts_community_id_communities_id_fk" FOREIGN KEY ("community_id") REFERENCES "public"."communities"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_rsvps" ADD CONSTRAINT "event_rsvps_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_rsvps" ADD CONSTRAINT "event_rsvps_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_organizer_id_users_id_fk" FOREIGN KEY ("organizer_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_community_id_communities_id_fk" FOREIGN KEY ("community_id") REFERENCES "public"."communities"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "idx_communities_slug" ON "communities" USING btree ("slug");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_communities_name" ON "communities" USING btree ("name");--> statement-breakpoint
CREATE INDEX "idx_communities_creator" ON "communities" USING btree ("creator_id");--> statement-breakpoint
CREATE INDEX "idx_communities_privacy" ON "communities" USING btree ("privacy");--> statement-breakpoint
CREATE INDEX "idx_communities_created_at" ON "communities" USING btree ("created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_community_members_unique" ON "community_memberships" USING btree ("community_id","user_id");--> statement-breakpoint
CREATE INDEX "idx_community_members_user" ON "community_memberships" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_community_members_comm_status" ON "community_memberships" USING btree ("community_id","status");--> statement-breakpoint
CREATE INDEX "idx_post_comments_post" ON "post_comments" USING btree ("post_id");--> statement-breakpoint
CREATE INDEX "idx_post_comments_author" ON "post_comments" USING btree ("author_id");--> statement-breakpoint
CREATE INDEX "idx_post_comments_parent" ON "post_comments" USING btree ("parent_id");--> statement-breakpoint
CREATE INDEX "idx_post_comments_created_at" ON "post_comments" USING btree ("created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_post_reactions_unique" ON "post_reactions" USING btree ("post_id","user_id","reaction_type");--> statement-breakpoint
CREATE INDEX "idx_post_reactions_post" ON "post_reactions" USING btree ("post_id");--> statement-breakpoint
CREATE INDEX "idx_post_reactions_user" ON "post_reactions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_posts_author" ON "posts" USING btree ("author_id");--> statement-breakpoint
CREATE INDEX "idx_posts_community" ON "posts" USING btree ("community_id");--> statement-breakpoint
CREATE INDEX "idx_posts_created_at" ON "posts" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_posts_visibility" ON "posts" USING btree ("visibility");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_event_rsvps_unique" ON "event_rsvps" USING btree ("event_id","user_id");--> statement-breakpoint
CREATE INDEX "idx_event_rsvps_event_status" ON "event_rsvps" USING btree ("event_id","status");--> statement-breakpoint
CREATE INDEX "idx_event_rsvps_user" ON "event_rsvps" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_event_rsvps_created_at" ON "event_rsvps" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_events_organizer" ON "events" USING btree ("organizer_id");--> statement-breakpoint
CREATE INDEX "idx_events_community" ON "events" USING btree ("community_id");--> statement-breakpoint
CREATE INDEX "idx_events_status" ON "events" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_events_start_at" ON "events" USING btree ("start_at");