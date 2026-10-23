import { createHmac } from "node:crypto";
import { describe, expect, it, vi } from "vitest";

import { cloudTemplatePayload, extractCloudQuickReplies, sendCloudTemplate, verifyCloudWebhookSignature } from "@/lib/rsvp/whatsapp-cloud";

describe("WhatsApp Cloud API preparation", () => {
  it("verifies webhook signatures over the raw request body", () => {
    const body = '{"entry":[]}';
    const signature = `sha256=${createHmac("sha256", "secret").update(body).digest("hex")}`;
    expect(verifyCloudWebhookSignature(body, signature, "secret")).toBe(true);
    expect(verifyCloudWebhookSignature(`${body} `, signature, "secret")).toBe(false);
    expect(verifyCloudWebhookSignature(body, "sha256=bad", "secret")).toBe(false);
  });

  it("builds a Hebrew template with three RSVP quick replies", () => {
    const payload = cloudTemplatePayload({
      recipient: "972503062269", templateName: "wedding_invitation", language: "he",
      bodyParameters: ["מיכאל", "10.12.2026"],
      quickReplyPayloads: ["rsvp_confirmed", "rsvp_declined", "rsvp_unsure"],
    });
    expect(payload.template.components).toHaveLength(4);
    expect(payload.template.components[1]).toMatchObject({ type: "button", index: "0" });
    expect(() => cloudTemplatePayload({ recipient: "0503062269", templateName: "wedding_invitation", language: "he", bodyParameters: [] })).toThrow();
  });

  it("does not pretend an API error was a successful send", async () => {
    const credentials = { accessToken: "test-token", phoneNumberId: "1234567890", apiVersion: "v23.0" };
    const request = { recipient: "972503062269", templateName: "wedding_invitation", language: "he", bodyParameters: [] };
    const failedFetch = vi.fn(async () => new Response("error", { status: 400 }));
    await expect(sendCloudTemplate(credentials, request, failedFetch as typeof fetch)).rejects.toThrow("(400)");
    const successFetch = vi.fn(async () => Response.json({ messages: [{ id: "wamid.123" }] }));
    await expect(sendCloudTemplate(credentials, request, successFetch as typeof fetch)).resolves.toBe("wamid.123");
  });

  it("extracts only recognized RSVP buttons with a correlated outbound message", () => {
    const event = { entry: [{ changes: [{ value: { messages: [
      { id: "wamid.in1", from: "972503062269", context: { id: "wamid.out1" }, button: { payload: "rsvp_confirmed" } },
      { id: "wamid.in2", from: "972503062269", context: { id: "wamid.out2" }, button: { payload: "unknown" } },
      { id: "wamid.in3", from: "972503062269", button: { payload: "rsvp_declined" } },
    ] } }] }] };
    expect(extractCloudQuickReplies(event)).toEqual([{ inboundMessageId: "wamid.in1", outboundMessageId: "wamid.out1", sender: "972503062269", choice: "confirmed" }]);
    expect(extractCloudQuickReplies(null)).toEqual([]);
  });
});
