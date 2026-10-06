import { index, primaryKey, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const experiments = sqliteTable("experiments", {
  id: text("id").notNull(),
  userId: text("user_id").notNull(),
  model: text("model").notNull(),
  prompt: text("prompt").notNull(),
  output: text("output").notNull(),
  createdAt: text("created_at").notNull(),
}, (table) => [primaryKey({ columns: [table.userId, table.id] }), index("idx_experiments_user_created").on(table.userId, table.createdAt)]);
