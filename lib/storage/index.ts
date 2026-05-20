import { env } from "@/lib/env";
import { LocalAdapter } from "./adapters/local";
import type { StorageAdapter } from "./types";

function createAdapter(): StorageAdapter {
  switch (env.STORAGE_PROVIDER) {
    case "local":
      return new LocalAdapter();
    default:
      throw new Error(`Unknown STORAGE_PROVIDER: ${env.STORAGE_PROVIDER}`);
  }
}

export const storage: StorageAdapter = createAdapter();
export type { StorageAdapter } from "./types";
