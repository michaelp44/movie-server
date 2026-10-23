import { createHmac, randomUUID } from "node:crypto";
import { spawn, type ChildProcess } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const secret = "f".repeat(64);
const port = 24_000 + Math.floor(Math.random() * 1_000);
const origin = `http://127.0.0.1:${port}`;
let server: ChildProcess;
let dataDirectory: string;

async function signed(pathname: string, body: unknown) {
  const text = JSON.stringify(body);
  const timestamp = Date.now().toString();
  const signature = createHmac("sha256", secret).update(`${timestamp}.${text}`).digest("hex");
  return fetch(`${origin}${pathname}`, { method: "POST", body: text, headers: { "content-type": "application/json", "x-wedding-timestamp": timestamp, "x-wedding-signature": signature } });
}

async function signedGet(pathname: string) {
  const timestamp = Date.now().toString();
  const signature = createHmac("sha256", secret).update(`${timestamp}.`).digest("hex");
  return fetch(`${origin}${pathname}`, { headers: { "x-wedding-timestamp": timestamp, "x-wedding-signature": signature } });
}

describe("Mac fallback server", () => {
  beforeAll(async () => {
    dataDirectory = await mkdtemp(join(tmpdir(), "wedding-fallback-test-"));
    server = spawn(process.execPath, [join(process.cwd(), "fallback/server.mjs")], {
      env: { ...process.env, WEDDING_FALLBACK_PORT: String(port), WEDDING_FALLBACK_PUBLIC_URL: origin, WEDDING_FALLBACK_DATA_DIR: dataDirectory, WEDDING_FALLBACK_SECRET: secret },
      stdio: "ignore",
    });
    for (let attempt = 0; attempt < 30; attempt += 1) {
      try { if ((await fetch(`${origin}/health`)).ok) return; } catch { /* server is starting */ }
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
    throw new Error("Fallback server did not start");
  });

  afterAll(async () => {
    server?.kill("SIGTERM");
    await rm(dataDirectory, { recursive: true, force: true });
  });

  it("rejects unsigned private requests", async () => {
    expect((await fetch(`${origin}/v1/live`)).status).toBe(401);
  });

  it("stores an approved blessing and returns it to the wall", async () => {
    const id = randomUUID();
    expect((await signed("/v1/blessings", { id, operationId: id, displayName: "אורח בדיקה", message: "מזל טוב!", moderationStatus: "APPROVED" })).ok).toBe(true);
    const duplicate = await signed("/v1/blessings", { id: randomUUID(), operationId: randomUUID(), displayName: "אורח בדיקה", message: "מזל טוב!", moderationStatus: "APPROVED" });
    expect((await duplicate.json()).duplicate).toBe(true);
    const timestamp = Date.now().toString();
    const signature = createHmac("sha256", secret).update(`${timestamp}.`).digest("hex");
    const response = await fetch(`${origin}/v1/live`, { headers: { "x-wedding-timestamp": timestamp, "x-wedding-signature": signature } });
    const payload = await response.json() as { items: Array<{ id: string; message: string }> };
    expect(payload.items).toContainEqual(expect.objectContaining({ id: `blessing:${id}`, message: "מזל טוב!" }));
  });

  it("deduplicates repeated song requests", async () => {
    const input = { displayName: "אורח בדיקה", song: "Dancing Queen", artist: "ABBA" };
    const first = await signed("/v1/songs", { ...input, id: randomUUID(), operationId: randomUUID() });
    const second = await signed("/v1/songs", { ...input, id: randomUUID(), operationId: randomUUID() });
    expect((await first.json()).duplicate).toBe(false);
    expect((await second.json()).duplicate).toBe(true);
  });

  it("stores private invitation activity locally and makes it readable", async () => {
    const eventId = randomUUID();
    const invitationId = randomUUID();
    const createdAt = new Date().toISOString();
    const written = await signed("/v1/invitation-activity", {
      id: eventId,
      invitationId,
      displayName: "אורח בדיקה",
      eventType: "rsvp_saved",
      target: "declined",
      details: { numberConfirmed: 0 },
      createdAt,
    });
    expect(written.ok).toBe(true);
    const payload = await signedGet("/v1/invitation-activity").then((response) => response.json()) as { events: Array<Record<string, unknown>> };
    expect(payload.events).toContainEqual(expect.objectContaining({
      id: eventId,
      invitation_id: invitationId,
      display_name: "אורח בדיקה",
      event_type: "rsvp_saved",
      target: "declined",
      details: { numberConfirmed: 0 },
    }));
  });

  it("enforces rate-limit counters locally", async () => {
    const first = await signed("/v1/rate-limit", { action: "test", identifierHash: "a".repeat(64), limit: 1, windowSeconds: 60 });
    const second = await signed("/v1/rate-limit", { action: "test", identifierHash: "a".repeat(64), limit: 1, windowSeconds: 60 });
    expect((await first.json()).allowed).toBe(true);
    expect((await second.json()).allowed).toBe(false);
  });
});
