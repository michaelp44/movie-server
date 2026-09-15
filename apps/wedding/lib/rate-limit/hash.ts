import { createHmac } from "node:crypto";

/** Keeps IP addresses and phone numbers out of the rate-limit table. */
export function hashRateLimitIdentifier(identifier: string, secret: string): string {
  if (Buffer.byteLength(secret, "utf8") < 32) {
    throw new TypeError("Rate-limit hash secret must contain at least 32 bytes");
  }

  return createHmac("sha256", secret).update(identifier, "utf8").digest("hex");
}
