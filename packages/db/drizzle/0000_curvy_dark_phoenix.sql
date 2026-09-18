CREATE TABLE "completions" (
	"id" text PRIMARY KEY NOT NULL,
	"device_id" text NOT NULL,
	"roadmap_id" text NOT NULL,
	"task_id" text NOT NULL,
	"video_id" text NOT NULL,
	"title" text NOT NULL,
	"completed_at" timestamp with time zone NOT NULL,
	"auto" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "roadmaps" (
	"id" text PRIMARY KEY NOT NULL,
	"device_id" text NOT NULL,
	"title" text NOT NULL,
	"playlist_id" text NOT NULL,
	"tasks" jsonb NOT NULL,
	"plan" jsonb NOT NULL,
	"schedule" jsonb NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL,
	"synced_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "completions_device_idx" ON "completions" USING btree ("device_id");--> statement-breakpoint
CREATE INDEX "completions_roadmap_idx" ON "completions" USING btree ("roadmap_id");--> statement-breakpoint
CREATE INDEX "roadmaps_device_idx" ON "roadmaps" USING btree ("device_id");