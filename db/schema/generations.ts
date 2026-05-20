import { pgTable, uuid, text, timestamp, jsonb } from "drizzle-orm/pg-core";
import { users } from "./users";
import { workspaces } from "./workspaces";
import { templates } from "./templates";

export const generations = pgTable("generations", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id),
  workspaceId: uuid("workspace_id")
    .notNull()
    .references(() => workspaces.id),
  templateId: uuid("template_id")
    .notNull()
    .references(() => templates.id),
  config: jsonb("config").notNull(),
  artifactUrl: text("artifact_url"),
  sdkVersion: text("sdk_version").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
