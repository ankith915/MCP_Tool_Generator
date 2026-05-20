import { pgTable, uuid, text, timestamp } from "drizzle-orm/pg-core";
import { users } from "./users";

export const workspaces = pgTable("workspaces", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  ownerId: uuid("owner_id")
    .notNull()
    .references(() => users.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const workspaceMembers = pgTable("workspace_members", {
  id: uuid("id").primaryKey().defaultRandom(),
  workspaceId: uuid("workspace_id")
    .notNull()
    .references(() => workspaces.id),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id),
  role: text("role", {
    enum: ["owner", "admin", "developer", "viewer"],
  }).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
