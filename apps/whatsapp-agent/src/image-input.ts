import type { RecentMessage, RecentMessageImage } from './types.js';

const SUPPORTED_IMAGE_MIME_TYPES = new Set<RecentMessageImage['mimeType']>([
  'image/jpeg',
  'image/png',
  'image/webp',
]);

export interface DownloadedMessageMedia {
  mimetype: string;
  data: string;
  filesize?: number | null;
}

export type VisionInputContent = Array<
  | { type: 'input_text'; text: string }
  | { type: 'input_image'; image_url: string; detail: 'auto' }
>;

export function isWhatsAppImageMessage(message: {
  hasMedia: boolean;
  type: string;
}): boolean {
  return message.hasMedia && message.type === 'image';
}

export function whatsappMessageText(body: string, isImage: boolean): string {
  const trimmed = body.trim();
  if (
    isImage &&
    (trimmed.startsWith('/9j/') ||
      trimmed.startsWith('iVBOR') ||
      trimmed.startsWith('UklGR') ||
      (trimmed.length > 256 && /^[A-Za-z0-9+/=]+$/.test(trimmed)))
  ) {
    return '';
  }
  return body.slice(0, 4000);
}

export function normalizeDownloadedImage(
  media: DownloadedMessageMedia | undefined,
  maxBytes: number
): RecentMessageImage | undefined {
  if (!media) return undefined;
  const mimeType = media.mimetype.split(';', 1)[0]?.trim().toLowerCase();
  if (!mimeType || !SUPPORTED_IMAGE_MIME_TYPES.has(mimeType as RecentMessageImage['mimeType'])) {
    return undefined;
  }

  const base64Data = media.data.replace(/\s+/g, '');
  if (!base64Data || !/^[A-Za-z0-9+/]*={0,2}$/.test(base64Data)) return undefined;
  const sizeBytes = Buffer.byteLength(Buffer.from(base64Data, 'base64'));
  if (sizeBytes === 0 || sizeBytes > maxBytes) return undefined;
  if (media.filesize && media.filesize > maxBytes) return undefined;

  return {
    mimeType: mimeType as RecentMessageImage['mimeType'],
    base64Data,
    sizeBytes,
  };
}

export function buildVisionInputContent(
  metadata: Record<string, unknown>,
  messages: RecentMessage[]
): VisionInputContent {
  const imageInputs: Extract<VisionInputContent[number], { type: 'input_image' }>[] = [];
  const serializedMessages = messages.map((message) => {
    const imageIndex = message.image ? imageInputs.length + 1 : undefined;
    if (message.image) {
      imageInputs.push({
        type: 'input_image',
        image_url: `data:${message.image.mimeType};base64,${message.image.base64Data}`,
        detail: 'auto',
      });
    }
    return {
      messageId: message.messageId ?? '',
      timestamp: new Date(message.timestamp * 1000).toISOString(),
      senderId: message.senderId ?? '',
      fromMe: message.fromMe,
      body: message.body,
      ...(imageIndex === undefined ? {} : { imageIndex }),
    };
  });

  return [
    {
      type: 'input_text',
      text: JSON.stringify({
        ...metadata,
        imageIndexNote:
          'Each imageIndex refers to the corresponding 1-based input_image that follows this text.',
        messages: serializedMessages,
      }),
    },
    ...imageInputs,
  ];
}
