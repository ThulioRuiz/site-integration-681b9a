import { integer, pgTable, text, timestamp } from "drizzle-orm/pg-core";

/** PDFs enviados para a biblioteca compartilhada. O arquivo fica no Netlify Blobs, em partes. */
export const libraryBooks = pgTable("library_books", {
  id: text().primaryKey(),
  title: text().notNull(),
  author: text().notNull().default(""),
  subject: text().notNull().default(""),
  exam: text().notNull().default(""),
  description: text().notNull().default(""),
  fileName: text("file_name").notNull(),
  sizeBytes: integer("size_bytes").notNull(),
  parts: integer().notNull(),
  /** "uploading" enquanto as partes chegam; "ready" quando o PDF está completo. */
  status: text().notNull().default("uploading"),
  uploadedBy: text("uploaded_by").notNull(),
  uploadedByName: text("uploaded_by_name").notNull().default(""),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

/** Resumo de estudo de cada usuário usado no ranking. */
export const rankingStats = pgTable("ranking_stats", {
  userId: text("user_id").primaryKey(),
  displayName: text("display_name").notNull(),
  exam: text().notNull().default(""),
  totalMinutes: integer("total_minutes").notNull().default(0),
  weekKey: text("week_key").notNull().default(""),
  weekMinutes: integer("week_minutes").notNull().default(0),
  monthKey: text("month_key").notNull().default(""),
  monthMinutes: integer("month_minutes").notNull().default(0),
  topicsDone: integer("topics_done").notNull().default(0),
  streakDays: integer("streak_days").notNull().default(0),
  questionsCorrect: integer("questions_correct").notNull().default(0),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});
