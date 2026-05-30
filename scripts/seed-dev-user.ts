import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envFile = path.join(__dirname, "..", ".env.local");
if (fs.existsSync(envFile)) process.loadEnvFile(envFile);

const DEV_USER_ID = "00000000-0000-0000-0000-000000000001";
const DEV_WORKSPACE_ID = "00000000-0000-0000-0000-000000000001";

async function main() {
  const { db } = await import("@/db");
  const { users, workspaces } = await import("@/db/schema");
  const { eq } = await import("drizzle-orm");

  const existingUser = await db
    .select()
    .from(users)
    .where(eq(users.id, DEV_USER_ID))
    .limit(1);
  if (existingUser.length === 0) {
    await db
      .insert(users)
      .values({ id: DEV_USER_ID, email: "dev@localhost", name: "Dev User" });
    console.log("inserted dev user");
  } else {
    console.log("dev user already exists");
  }

  const existingWs = await db
    .select()
    .from(workspaces)
    .where(eq(workspaces.id, DEV_WORKSPACE_ID))
    .limit(1);
  if (existingWs.length === 0) {
    await db.insert(workspaces).values({
      id: DEV_WORKSPACE_ID,
      name: "Dev Workspace",
      slug: "dev",
      ownerId: DEV_USER_ID,
    });
    console.log("inserted dev workspace");
  } else {
    console.log("dev workspace already exists");
  }

  console.log("seed complete");
  process.exit(0);
}

main();
