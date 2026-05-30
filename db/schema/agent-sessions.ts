import { pgTable, uuid, text, timestamp, jsonb } from "drizzle-orm/pg-core";
import { users } from "./users";
import { workspaces } from "./workspaces";

export const agentSessions = pgTable("agent_sessions", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id),
  workspaceId: uuid("workspace_id")
    .notNull()
    .references(() => workspaces.id),
  status: text("status", {
    enum: ["clarifying", "planning", "approved", "generated", "abandoned"],
  })
    .notNull()
    .default("clarifying"),
  summary: jsonb("summary").notNull().default({}),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const agentMessages = pgTable("agent_messages", {
  id: uuid("id").primaryKey().defaultRandom(),
  sessionId: uuid("session_id")
    .notNull()
    .references(() => agentSessions.id),
  role: text("role", {
    enum: ["user", "clarification", "plan", "system"],
  }).notNull(),
  content: text("content").notNull(),
  structured: jsonb("structured"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
