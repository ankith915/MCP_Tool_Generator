import { z } from "zod";

const schema = z.object({
  DATABASE_URL: z.string().url(),
  AUTH_PROVIDER: z.enum(["noop"]).default("noop"),
  STORAGE_PROVIDER: z.enum(["local"]).default("local"),
  RATE_LIMIT_PROVIDER: z.enum(["memory"]).default("memory"),
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
});

export const env = schema.parse(process.env);
