import type { RateLimitAdapter, RateLimitResult } from "../types";

export class UpstashAdapter implements RateLimitAdapter {
  async check(): Promise<RateLimitResult> {
    throw new Error("UpstashAdapter: not implemented");
  }
}
