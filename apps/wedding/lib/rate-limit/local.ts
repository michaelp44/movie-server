import type { RateLimitResult } from "@/lib/types";

interface LocalBucket {
  count: number;
  resetAtMs: number;
}
const buckets = new Map<string, LocalBucket>();

/** Non-distributed fallback for local development and unit tests only. */
export function consumeLocalRateLimit(
  action: string,
  identifierHash: string,
  limit: number,
  windowSeconds: number,
  now: Date = new Date(),
): RateLimitResult {
  const windowMs = windowSeconds * 1000;
  const bucketStart = Math.floor(now.getTime() / windowMs) * windowMs;
  const resetAtMs = bucketStart + windowMs;
  const key = `${action}:${identifierHash}:${bucketStart}`;
  const current = buckets.get(key);
  const count = (current?.count ?? 0) + 1;

  buckets.set(key, { count, resetAtMs });

  // Keep the development process bounded during long hot-reload sessions.
  if (buckets.size > 1_000) {
    for (const [bucketKey, bucket] of buckets) {
      if (bucket.resetAtMs <= now.getTime()) buckets.delete(bucketKey);
    }
  }

  return {
    allowed: count <= limit,
    remaining: Math.max(0, limit - count),
    resetAt: new Date(resetAtMs),
  };
}

export function clearLocalRateLimits(): void {
  buckets.clear();
}
