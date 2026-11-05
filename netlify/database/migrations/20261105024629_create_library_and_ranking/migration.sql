CREATE TABLE "library_books" (
	"id" text PRIMARY KEY,
	"title" text NOT NULL,
	"author" text DEFAULT '' NOT NULL,
	"subject" text DEFAULT '' NOT NULL,
	"exam" text DEFAULT '' NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"file_name" text NOT NULL,
	"size_bytes" integer NOT NULL,
	"parts" integer NOT NULL,
	"status" text DEFAULT 'uploading' NOT NULL,
	"uploaded_by" text NOT NULL,
	"uploaded_by_name" text DEFAULT '' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ranking_stats" (
	"user_id" text PRIMARY KEY,
	"display_name" text NOT NULL,
	"exam" text DEFAULT '' NOT NULL,
	"total_minutes" integer DEFAULT 0 NOT NULL,
	"week_key" text DEFAULT '' NOT NULL,
	"week_minutes" integer DEFAULT 0 NOT NULL,
	"month_key" text DEFAULT '' NOT NULL,
	"month_minutes" integer DEFAULT 0 NOT NULL,
	"topics_done" integer DEFAULT 0 NOT NULL,
	"streak_days" integer DEFAULT 0 NOT NULL,
	"questions_correct" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
