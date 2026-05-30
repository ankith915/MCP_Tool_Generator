import { pgTable, uuid, text, timestamp, integer } from "drizzle-orm/pg-core";

export const templates = pgTable("templates", {
  id: uuid("id").primaryKey().defaultRandom(),
  language: text("language", {
    enum: ["typescript", "python"],
  }).notNull(),
  framework: text("framework", {
    enum: ["sdk", "fastmcp", "fastapi-mcp", "fastapi-official-mcp", "fastmcp-fastapi"],
  }).notNull(),
  transport: text("transport", {
    enum: ["streamable-http", "stdio"],
  }).notNull(),
  version: integer("version").notNull().default(1),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
