import path from "node:path";
import { fileURLToPath } from "node:url";
import fs from "node:fs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const envFile = path.join(root, ".env.local");

if (fs.existsSync(envFile)) {
  process.loadEnvFile(envFile);
}

// lib/env.ts validates DATABASE_URL at module load time. Unit tests that don't
// touch the DB (all tests here except CI integration tests) still need the env
// schema to parse. Provide a syntactically valid placeholder when no real URL
// is configured; actual DB calls only happen via lazy imports in generate.ts
// and only execute in CI where DATABASE_URL is the real Neon secret.
if (!process.env["DATABASE_URL"]) {
  process.env["DATABASE_URL"] = "postgresql://localhost:5432/placeholder";
}
