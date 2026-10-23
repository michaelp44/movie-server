import { createHmac, timingSafeEqual } from "node:crypto";

export type CloudTemplateRequest = {
  recipient: string;
  templateName: string;
  language: string;
  bodyParameters: string[];
  quickReplyPayloads?: string[];
};

export type CloudApiCredentials = {
  accessToken: string;
  phoneNumberId: string;
  apiVersion: string;
};

export type CloudQuickReply = {
  inboundMessageId: string;
  outboundMessageId: string;
  sender: string;
  choice: "confirmed" | "declined" | "maybe";
};

const choiceByPayload: Record<string, CloudQuickReply["choice"]> = {
  rsvp_confirmed: "confirmed",
  rsvp_declined: "declined",
  rsvp_unsure: "maybe",
};

export function extractCloudQuickReplies(payload: unknown): CloudQuickReply[] {
  if (!payload || typeof payload !== "object") return [];
  const entries = (payload as { entry?: unknown }).entry;
  if (!Array.isArray(entries)) return [];
  const replies: CloudQuickReply[] = [];
  for (const entry of entries) {
    const changes = entry?.changes;
    if (!Array.isArray(changes)) continue;
    for (const change of changes) {
      const messages = change?.value?.messages;
      if (!Array.isArray(messages)) continue;
      for (const message of messages) {
        const payloadText = message?.button?.payload;
        const choice = typeof payloadText === "string" ? choiceByPayload[payloadText] : undefined;
        const inboundMessageId = message?.id;
        const outboundMessageId = message?.context?.id;
        const sender = message?.from;
        if (choice && typeof inboundMessageId === "string" && inboundMessageId.startsWith("wamid.")
          && typeof outboundMessageId === "string" && outboundMessageId.startsWith("wamid.")
          && typeof sender === "string" && /^972\d{8,9}$/.test(sender)) {
          replies.push({ inboundMessageId, outboundMessageId, sender, choice });
        }
      }
    }
  }
  return replies;
}

export function verifyCloudWebhookSignature(rawBody: string, signature: string | null, appSecret: string): boolean {
  if (!appSecret || !signature || !/^sha256=[a-f0-9]{64}$/i.test(signature)) return false;
  const expected = createHmac("sha256", appSecret).update(rawBody).digest();
  const received = Buffer.from(signature.slice(7), "hex");
  return received.length === expected.length && timingSafeEqual(received, expected);
}

export function cloudTemplatePayload(request: CloudTemplateRequest) {
  if (!/^972\d{8,9}$/.test(request.recipient)) throw new Error("Invalid WhatsApp recipient");
  if (!/^[a-z0-9_]{1,512}$/.test(request.templateName)) throw new Error("Invalid WhatsApp template name");
  if (!/^[a-z]{2}(?:_[A-Z]{2})?$/.test(request.language)) throw new Error("Invalid WhatsApp template language");
  if (request.bodyParameters.length > 10 || request.bodyParameters.some((value) => !value || value.length > 1024)) {
    throw new Error("Invalid WhatsApp template parameters");
  }
  if ((request.quickReplyPayloads?.length ?? 0) > 3 || request.quickReplyPayloads?.some((value) => !/^[a-zA-Z0-9_-]{1,128}$/.test(value))) {
    throw new Error("Invalid WhatsApp button payload");
  }
  return {
    messaging_product: "whatsapp",
    to: request.recipient,
    type: "template",
    template: {
      name: request.templateName,
      language: { code: request.language },
      components: [
        ...(request.bodyParameters.length ? [{ type: "body", parameters: request.bodyParameters.map((text) => ({ type: "text", text })) }] : []),
        ...(request.quickReplyPayloads ?? []).map((payload, index) => ({
          type: "button", sub_type: "quick_reply", index: String(index), parameters: [{ type: "payload", payload }],
        })),
      ],
    },
  };
}

export async function sendCloudTemplate(
  credentials: CloudApiCredentials,
  request: CloudTemplateRequest,
  fetcher: typeof fetch = fetch,
): Promise<string> {
  if (!credentials.accessToken || !/^\d{5,30}$/.test(credentials.phoneNumberId) || !/^v\d+\.\d+$/.test(credentials.apiVersion)) {
    throw new Error("WhatsApp Cloud API is not configured");
  }
  const response = await fetcher(`https://graph.facebook.com/${credentials.apiVersion}/${credentials.phoneNumberId}/messages`, {
    method: "POST",
    headers: { Authorization: `Bearer ${credentials.accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify(cloudTemplatePayload(request)),
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) throw new Error(`WhatsApp Cloud API rejected the message (${response.status})`);
  const result: unknown = await response.json();
  const id = (result as { messages?: { id?: unknown }[] })?.messages?.[0]?.id;
  if (typeof id !== "string" || !id.startsWith("wamid.")) throw new Error("WhatsApp Cloud API returned no message ID");
  return id;
}
