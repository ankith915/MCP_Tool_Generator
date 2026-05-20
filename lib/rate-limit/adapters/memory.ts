import type { RateLimitAdapter, RateLimitResult } from "../types";

interface Bucket {
  count: number;
  resetAt: number;
}

export class InMemoryAdapter implements RateLimitAdapter {
  private buckets = new Map<string, Bucket>();

  async check(
    key: string,
    limit: number,
    windowMs: number,
  ): Promise<RateLimitResult> {
    const now = Date.now();
    const existing = this.buckets.get(key);

    if (!existing || now > existing.resetAt) {
      this.buckets.set(key, { count: 1, resetAt: now + windowMs });
      return { allowed: true, remaining: limit - 1, resetAt: now + windowMs };
    }

    existing.count++;
    return {
      allowed: existing.count <= limit,
      remaining: Math.max(0, limit - existing.count),
      resetAt: existing.resetAt,
    };
  }
}
