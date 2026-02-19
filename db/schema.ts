import { pgTable, serial, text, timestamp } from "drizzle-orm/pg-core"

export const postsTable = pgTable("posts_table", {
  id: serial("id").primaryKey(),
  collection: text("collection").notNull(),
  url: text("url").notNull(),
  imageUrl: text("image_url").notNull(),
  videoUrl: text("video_url"),
  comment: text("comment").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
})
