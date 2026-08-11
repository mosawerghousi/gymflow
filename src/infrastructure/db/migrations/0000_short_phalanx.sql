CREATE TYPE "public"."checkin_method" AS ENUM('manual', 'code', 'qr');--> statement-breakpoint
CREATE TYPE "public"."membership_status" AS ENUM('active', 'frozen', 'expired', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."session_status" AS ENUM('booked', 'completed', 'no_show', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."shift_position" AS ENUM('front_desk', 'floor', 'training', 'cleaning', 'management');--> statement-breakpoint
CREATE TYPE "public"."shift_status" AS ENUM('scheduled', 'completed', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."swap_status" AS ENUM('pending', 'approved', 'rejected', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('admin', 'staff', 'trainer');--> statement-breakpoint
CREATE TABLE "app_settings" (
	"key" varchar(64) PRIMARY KEY NOT NULL,
	"value" text NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "audit_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"actor_user_id" uuid,
	"action" varchar(64) NOT NULL,
	"entity_type" varchar(32) NOT NULL,
	"entity_id" uuid,
	"summary" text NOT NULL,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "checkins" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"member_id" uuid NOT NULL,
	"checked_in_at" timestamp with time zone DEFAULT now() NOT NULL,
	"checked_out_at" timestamp with time zone,
	"method" "checkin_method" DEFAULT 'manual' NOT NULL,
	"recorded_by_user_id" uuid,
	"kiosk_token_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "demo_resets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ran_at" timestamp with time zone DEFAULT now() NOT NULL,
	"duration_ms" integer NOT NULL,
	"summary" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "kiosk_tokens" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(80) NOT NULL,
	"token_hash" text NOT NULL,
	"token_prefix" varchar(12) NOT NULL,
	"created_by_user_id" uuid,
	"last_used_at" timestamp with time zone,
	"revoked_at" timestamp with time zone,
	"is_seed" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "members" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"member_code" varchar(16) NOT NULL,
	"first_name" varchar(80) NOT NULL,
	"last_name" varchar(80) NOT NULL,
	"email" varchar(160),
	"phone" varchar(40),
	"plan_id" uuid,
	"status" "membership_status" DEFAULT 'expired' NOT NULL,
	"joined_at" timestamp with time zone DEFAULT now() NOT NULL,
	"membership_starts_at" timestamp with time zone,
	"membership_ends_at" timestamp with time zone,
	"frozen_at" timestamp with time zone,
	"notes" text,
	"is_seed" boolean DEFAULT false NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "membership_plans" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(80) NOT NULL,
	"description" text,
	"price_cents" integer NOT NULL,
	"duration_days" integer NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "operating_hours" (
	"day_of_week" smallint NOT NULL,
	"opens_at" varchar(5) NOT NULL,
	"closes_at" varchar(5) NOT NULL,
	"is_closed" boolean DEFAULT false NOT NULL,
	CONSTRAINT "operating_hours_day_of_week_pk" PRIMARY KEY("day_of_week")
);
--> statement-breakpoint
CREATE TABLE "shift_swap_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"shift_id" uuid NOT NULL,
	"requested_by_user_id" uuid NOT NULL,
	"target_user_id" uuid,
	"status" "swap_status" DEFAULT 'pending' NOT NULL,
	"reason" text,
	"resolved_by_user_id" uuid,
	"resolved_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "shifts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"starts_at" timestamp with time zone NOT NULL,
	"ends_at" timestamp with time zone NOT NULL,
	"position" "shift_position" DEFAULT 'front_desk' NOT NULL,
	"status" "shift_status" DEFAULT 'scheduled' NOT NULL,
	"notes" text,
	"created_by_user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "trainer_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"trainer_id" uuid NOT NULL,
	"member_id" uuid NOT NULL,
	"starts_at" timestamp with time zone NOT NULL,
	"ends_at" timestamp with time zone NOT NULL,
	"status" "session_status" DEFAULT 'booked' NOT NULL,
	"notes" text,
	"booked_by_user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(120) NOT NULL,
	"email" varchar(160) NOT NULL,
	"password_hash" text NOT NULL,
	"role" "user_role" DEFAULT 'staff' NOT NULL,
	"is_demo" boolean DEFAULT false NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_actor_user_id_users_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "checkins" ADD CONSTRAINT "checkins_member_id_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."members"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "checkins" ADD CONSTRAINT "checkins_recorded_by_user_id_users_id_fk" FOREIGN KEY ("recorded_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "checkins" ADD CONSTRAINT "checkins_kiosk_token_id_kiosk_tokens_id_fk" FOREIGN KEY ("kiosk_token_id") REFERENCES "public"."kiosk_tokens"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kiosk_tokens" ADD CONSTRAINT "kiosk_tokens_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "members" ADD CONSTRAINT "members_plan_id_membership_plans_id_fk" FOREIGN KEY ("plan_id") REFERENCES "public"."membership_plans"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shift_swap_requests" ADD CONSTRAINT "shift_swap_requests_shift_id_shifts_id_fk" FOREIGN KEY ("shift_id") REFERENCES "public"."shifts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shift_swap_requests" ADD CONSTRAINT "shift_swap_requests_requested_by_user_id_users_id_fk" FOREIGN KEY ("requested_by_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shift_swap_requests" ADD CONSTRAINT "shift_swap_requests_target_user_id_users_id_fk" FOREIGN KEY ("target_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shift_swap_requests" ADD CONSTRAINT "shift_swap_requests_resolved_by_user_id_users_id_fk" FOREIGN KEY ("resolved_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shifts" ADD CONSTRAINT "shifts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shifts" ADD CONSTRAINT "shifts_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trainer_sessions" ADD CONSTRAINT "trainer_sessions_trainer_id_users_id_fk" FOREIGN KEY ("trainer_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trainer_sessions" ADD CONSTRAINT "trainer_sessions_member_id_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."members"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trainer_sessions" ADD CONSTRAINT "trainer_sessions_booked_by_user_id_users_id_fk" FOREIGN KEY ("booked_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "audit_entity_idx" ON "audit_log" USING btree ("entity_type","entity_id","created_at");--> statement-breakpoint
CREATE INDEX "audit_created_at_idx" ON "audit_log" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "checkins_member_idx" ON "checkins" USING btree ("member_id","checked_in_at");--> statement-breakpoint
CREATE INDEX "checkins_checked_in_at_idx" ON "checkins" USING btree ("checked_in_at");--> statement-breakpoint
CREATE UNIQUE INDEX "kiosk_tokens_hash_unique" ON "kiosk_tokens" USING btree ("token_hash");--> statement-breakpoint
CREATE UNIQUE INDEX "members_code_unique" ON "members" USING btree ("member_code");--> statement-breakpoint
CREATE INDEX "members_status_idx" ON "members" USING btree ("status");--> statement-breakpoint
CREATE INDEX "members_plan_idx" ON "members" USING btree ("plan_id");--> statement-breakpoint
CREATE INDEX "members_ends_at_idx" ON "members" USING btree ("membership_ends_at");--> statement-breakpoint
CREATE INDEX "members_joined_at_idx" ON "members" USING btree ("joined_at");--> statement-breakpoint
CREATE INDEX "swap_requests_status_idx" ON "shift_swap_requests" USING btree ("status","shift_id");--> statement-breakpoint
CREATE INDEX "shifts_user_range_idx" ON "shifts" USING btree ("user_id","starts_at");--> statement-breakpoint
CREATE INDEX "shifts_starts_at_idx" ON "shifts" USING btree ("starts_at");--> statement-breakpoint
CREATE INDEX "sessions_trainer_range_idx" ON "trainer_sessions" USING btree ("trainer_id","starts_at");--> statement-breakpoint
CREATE INDEX "sessions_member_idx" ON "trainer_sessions" USING btree ("member_id");--> statement-breakpoint
CREATE UNIQUE INDEX "users_email_unique" ON "users" USING btree ("email");