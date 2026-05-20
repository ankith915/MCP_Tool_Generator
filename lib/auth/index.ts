import { env } from "@/lib/env";
import { NoopAuthAdapter } from "./adapters/noop";
import type { AuthAdapter } from "./types";

function createAdapter(): AuthAdapter {
  switch (env.AUTH_PROVIDER) {
    case "noop":
      return new NoopAuthAdapter();
    default:
      throw new Error(`Unknown AUTH_PROVIDER: ${env.AUTH_PROVIDER}`);
  }
}

const adapter = createAdapter();
export const getCurrentUser = adapter.getCurrentUser.bind(adapter);
export type { User } from "./types";
