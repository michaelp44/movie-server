import "server-only";

import { getRateLimitHashSecret } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";
import type { RateLimitResult } from "@/lib/types";

import { hashRateLimitIdentifier } from "./hash";
import { consumeLocalRateLimit } from "./local";
import { fallbackRequest, isFallbackConfigured } from "@/lib/fallback/client";

const ACTION_PATTERN = /^[a-z0-9][a-z0-9:_-]{0,63}$/;

export class RateLimitError extends Error {
  constructor(message: string, cause?: unknown) {
    super(message);
    this.name = "RateLimitError";
    this.cause = cause;
  }
}
function validateArguments(
  action: string,
  identifier: string,
  limit: number,
  windowSeconds: number,
): void {
  if (!ACTION_PATTERN.test(action)) throw new TypeError("Invalid rate-limit action");
  if (!identifier.trim() || identifier.length > 512) {
    throw new TypeError("Invalid rate-limit identifier");
  }
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > 10_000) {
    throw new RangeError("Invalid rate-limit request limit");
  }
  if (!Number.isSafeInteger(windowSeconds) || windowSeconds < 1 || windowSeconds > 86_400) {
    throw new RangeError("Invalid rate-limit window");
  }
}

/**
 * Atomically consumes a fixed-window limit in Supabase. A process-local
 * fallback is used only when Supabase is unconfigured outside production.
 */
export async function consumeRateLimit(
  action: string,
  identifier: string,
  limit: number,
  windowSeconds: number,
): Promise<RateLimitResult> {
  validateArguments(action, identifier, limit, windowSeconds);

  const identifierHash = hashRateLimitIdentifier(identifier, getRateLimitHashSecret());
  const client = createAdminClient({ optional: true });

  if (!client) {
    if (isFallbackConfigured()) {
      const result = await fallbackRequest<{ allowed: boolean; remaining: number; resetAt: string }>("/v1/rate-limit", { method: "POST", body: { action, identifierHash, limit, windowSeconds } });
      return { ...result, resetAt: new Date(result.resetAt) };
    }
    if (process.env.NODE_ENV === "production") {
      throw new RateLimitError("Supabase rate limiting is not configured");
    }
    return consumeLocalRateLimit(action, identifierHash, limit, windowSeconds);
  }

  let data, error;
  try {
    ({ data, error } = await client.rpc("consume_rate_limit", { p_action: action, p_identifier_hash: identifierHash, p_limit: limit, p_window_seconds: windowSeconds }));
  } catch (cause) {
    if (!isFallbackConfigured()) throw new RateLimitError("Unable to consume rate limit", cause);
    const result = await fallbackRequest<{ allowed: boolean; remaining: number; resetAt: string }>("/v1/rate-limit", { method: "POST", body: { action, identifierHash, limit, windowSeconds } });
    return { ...result, resetAt: new Date(result.resetAt) };
  }

  const result = data?.[0];
  if (error || !result) {
    if (isFallbackConfigured()) {
      const fallback = await fallbackRequest<{ allowed: boolean; remaining: number; resetAt: string }>("/v1/rate-limit", { method: "POST", body: { action, identifierHash, limit, windowSeconds } });
      return { ...fallback, resetAt: new Date(fallback.resetAt) };
    }
    throw new RateLimitError("Unable to consume rate limit", error);
  }

  return {
    allowed: result.allowed,
    remaining: result.remaining,
    resetAt: new Date(result.reset_at),
  };
}
