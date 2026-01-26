CREATE TABLE "posts_table" (
	"id" serial PRIMARY KEY NOT NULL,
	"collection" text NOT NULL,
	"url" text NOT NULL,
	"image_url" text NOT NULL,
	"comment" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
