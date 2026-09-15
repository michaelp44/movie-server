import "server-only";

import { createHmac, randomUUID } from "node:crypto";

type FallbackConfig = { url: string; secret: string };

function config(): FallbackConfig | null {
  const url = process.env.WEDDING_FALLBACK_URL?.replace(/\/$/, "");
  const secret = process.env.WEDDING_FALLBACK_SECRET;
  return url && secret && secret.length >= 32 ? { url, secret } : null;
}

export function isFallbackConfigured() { return config() !== null; }

export async function fallbackRequest<T>(pathname: string, init: { method?: "GET" | "POST"; body?: unknown; timeoutMs?: number } = {}): Promise<T> {
  const settings = config();
  if (!settings) throw new Error("Wedding fallback is not configured");
  const method = init.method ?? "GET";
  const body = init.body === undefined ? "" : JSON.stringify(init.body);
  const timestamp = Date.now().toString();
  const signature = createHmac("sha256", settings.secret).update(`${timestamp}.${body}`).digest("hex");
  const response = await fetch(`${settings.url}${pathname}`, {
    method,
    body: method === "POST" ? body : undefined,
    headers: { "content-type": "application/json", "x-wedding-timestamp": timestamp, "x-wedding-signature": signature },
    cache: "no-store",
    signal: AbortSignal.timeout(init.timeoutMs ?? 3500),
  });
  if (!response.ok) throw new Error(`Wedding fallback returned ${response.status}`);
  return await response.json() as T;
}

export function operationId() { return randomUUID(); }
