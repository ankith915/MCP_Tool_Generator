import { env } from "@/lib/env";
import { InMemoryAdapter } from "./adapters/memory";
import type { RateLimitAdapter } from "./types";

function createAdapter(): RateLimitAdapter {
  switch (env.RATE_LIMIT_PROVIDER) {
    case "memory":
      return new InMemoryAdapter();
    default:
      throw new Error(`Unknown RATE_LIMIT_PROVIDER: ${env.RATE_LIMIT_PROVIDER}`);
  }
}

export const rateLimit: RateLimitAdapter = createAdapter();
export type { RateLimitAdapter, RateLimitResult } from "./types";
