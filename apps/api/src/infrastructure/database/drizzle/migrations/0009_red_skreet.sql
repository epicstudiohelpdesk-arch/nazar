CREATE TABLE "product_entitlements" (
	"id" uuid PRIMARY KEY NOT NULL,
	"product_id" uuid NOT NULL,
	"entitlement_code" varchar(64) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "product_provider_mappings" (
	"id" uuid PRIMARY KEY NOT NULL,
	"product_id" uuid NOT NULL,
	"provider" varchar(32) NOT NULL,
	"provider_product_id" varchar(128) NOT NULL,
	"environment" varchar(32) DEFAULT 'PRODUCTION' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "products" (
	"id" uuid PRIMARY KEY NOT NULL,
	"code" varchar(64) NOT NULL,
	"name" varchar(128) NOT NULL,
	"description" text,
	"product_type" varchar(32) NOT NULL,
	"status" varchar(32) DEFAULT 'ACTIVE' NOT NULL,
	"duration_days" integer,
	"base_price_minor" integer DEFAULT 0 NOT NULL,
	"base_currency" varchar(3) DEFAULT 'INR' NOT NULL,
	"metadata" jsonb DEFAULT '{}',
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "products_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "subscriptions" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	"provider" varchar(32) NOT NULL,
	"provider_subscription_id" varchar(255),
	"provider_original_transaction_id" varchar(255) NOT NULL,
	"status" varchar(32) DEFAULT 'PENDING' NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"current_period_start" timestamp with time zone NOT NULL,
	"current_period_end" timestamp with time zone NOT NULL,
	"cancelled_at" timestamp with time zone,
	"expires_at" timestamp with time zone,
	"auto_renew_enabled" boolean DEFAULT true NOT NULL,
	"grace_period_until" timestamp with time zone,
	"metadata" jsonb DEFAULT '{}',
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payment_transactions" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	"subscription_id" uuid,
	"provider" varchar(32) NOT NULL,
	"provider_transaction_id" varchar(255) NOT NULL,
	"provider_original_transaction_id" varchar(255),
	"transaction_type" varchar(32) NOT NULL,
	"status" varchar(32) DEFAULT 'PENDING' NOT NULL,
	"amount_minor" integer DEFAULT 0 NOT NULL,
	"currency" varchar(3) DEFAULT 'INR' NOT NULL,
	"provider_created_at" timestamp with time zone,
	"verified_at" timestamp with time zone,
	"provider_metadata" jsonb DEFAULT '{}',
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "entitlements" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"entitlement_code" varchar(64) NOT NULL,
	"source_type" varchar(32) NOT NULL,
	"source_id" varchar(255),
	"status" varchar(32) DEFAULT 'ACTIVE' NOT NULL,
	"starts_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone,
	"revoked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "billing_webhook_events" (
	"id" uuid PRIMARY KEY NOT NULL,
	"provider" varchar(32) NOT NULL,
	"provider_event_id" varchar(255) NOT NULL,
	"event_type" varchar(64) NOT NULL,
	"payload_hash" varchar(64) NOT NULL,
	"raw_payload" jsonb NOT NULL,
	"received_at" timestamp with time zone DEFAULT now() NOT NULL,
	"processed_at" timestamp with time zone,
	"status" varchar(32) DEFAULT 'PENDING' NOT NULL,
	"attempt_count" integer DEFAULT 0 NOT NULL,
	"last_error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "product_entitlements" ADD CONSTRAINT "product_entitlements_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_provider_mappings" ADD CONSTRAINT "product_provider_mappings_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_transactions" ADD CONSTRAINT "payment_transactions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_transactions" ADD CONSTRAINT "payment_transactions_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_transactions" ADD CONSTRAINT "payment_transactions_subscription_id_subscriptions_id_fk" FOREIGN KEY ("subscription_id") REFERENCES "public"."subscriptions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "entitlements" ADD CONSTRAINT "entitlements_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "idx_product_entitlement_unique" ON "product_entitlements" USING btree ("product_id","entitlement_code");--> statement-breakpoint
CREATE INDEX "idx_product_entitlement_product_id" ON "product_entitlements" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX "idx_product_entitlement_code" ON "product_entitlements" USING btree ("entitlement_code");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_product_provider_env" ON "product_provider_mappings" USING btree ("provider","provider_product_id","environment");--> statement-breakpoint
CREATE INDEX "idx_product_provider_mapping_product_id" ON "product_provider_mappings" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX "idx_products_status" ON "products" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_products_product_type" ON "products" USING btree ("product_type");--> statement-breakpoint
CREATE INDEX "idx_subscriptions_user_id" ON "subscriptions" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_subscriptions_provider_orig_tx" ON "subscriptions" USING btree ("provider","provider_original_transaction_id");--> statement-breakpoint
CREATE INDEX "idx_subscriptions_provider_sub_id" ON "subscriptions" USING btree ("provider","provider_subscription_id");--> statement-breakpoint
CREATE INDEX "idx_subscriptions_status_expires" ON "subscriptions" USING btree ("status","expires_at");--> statement-breakpoint
CREATE INDEX "idx_payment_tx_user_created" ON "payment_transactions" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_payment_tx_provider_tx_id" ON "payment_transactions" USING btree ("provider","provider_transaction_id");--> statement-breakpoint
CREATE INDEX "idx_payment_tx_sub_created" ON "payment_transactions" USING btree ("subscription_id","created_at");--> statement-breakpoint
CREATE INDEX "idx_entitlements_user_code" ON "entitlements" USING btree ("user_id","entitlement_code");--> statement-breakpoint
CREATE INDEX "idx_entitlements_user_expires" ON "entitlements" USING btree ("user_id","expires_at");--> statement-breakpoint
CREATE INDEX "idx_entitlements_user_revoked" ON "entitlements" USING btree ("user_id","revoked_at");--> statement-breakpoint
CREATE INDEX "idx_entitlements_source" ON "entitlements" USING btree ("source_type","source_id");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_billing_webhook_provider_event_id" ON "billing_webhook_events" USING btree ("provider","provider_event_id");--> statement-breakpoint
CREATE INDEX "idx_billing_webhook_status_created" ON "billing_webhook_events" USING btree ("status","created_at");