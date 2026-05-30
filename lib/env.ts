import { z } from "zod";

const schema = z
  .object({
    DATABASE_URL: z.string().url(),
    AUTH_PROVIDER: z.enum(["noop"]).default("noop"),
    STORAGE_PROVIDER: z.enum(["local"]).default("local"),
    RATE_LIMIT_PROVIDER: z.enum(["memory"]).default("memory"),
    NODE_ENV: z
      .enum(["development", "test", "production"])
      .default("development"),
    CHAT_FLOW_ENABLED: z.coerce.boolean().default(false),
    OPENAI_API_KEY: z.string().min(1).optional(),
    OPENAI_CLARIFY_MODEL: z.string().default("gpt-4.1-mini"),
    OPENAI_PLAN_MODEL: z.string().default("o4-mini"),
    OPENAI_CODEGEN_MODEL: z.string().default("gpt-4.1-mini"),
    OPENAI_MAX_TOKENS: z.coerce.number().int().positive().default(8192),
  })
  .superRefine((data, ctx) => {
    if (data.CHAT_FLOW_ENABLED && !data.OPENAI_API_KEY) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["OPENAI_API_KEY"],
        message: "OPENAI_API_KEY is required when CHAT_FLOW_ENABLED=true",
      });
    }
  });

export const env = schema.parse(process.env);
