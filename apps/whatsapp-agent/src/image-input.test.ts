import { describe, expect, it } from 'vitest';
import {
  buildVisionInputContent,
  isWhatsAppImageMessage,
  normalizeDownloadedImage,
  whatsappMessageText,
} from './image-input.js';
import type { RecentMessage } from './types.js';

function imageMessage(): RecentMessage {
  return {
    chatId: 'group@g.us',
    chatName: 'מאמי',
    senderId: 'person@c.us',
    fromMe: false,
    timestamp: 1_800_000_000,
    body: 'תוסיף את זה לרשימה',
    image: {
      mimeType: 'image/jpeg',
      base64Data: '/9j/2Q==',
      sizeBytes: 4,
    },
  };
}

describe('WhatsApp image input', () => {
  it('recognizes WhatsApp image messages but not other media', () => {
    expect(isWhatsAppImageMessage({ hasMedia: true, type: 'image' })).toBe(true);
    expect(isWhatsAppImageMessage({ hasMedia: true, type: 'video' })).toBe(false);
    expect(isWhatsAppImageMessage({ hasMedia: false, type: 'image' })).toBe(false);
  });

  it('removes raw image bytes from the text field but preserves real captions', () => {
    expect(whatsappMessageText('/9j/' + 'A'.repeat(400), true)).toBe('');
    expect(whatsappMessageText('תקבע לנו את הפגישה שבתמונה', true)).toBe(
      'תקבע לנו את הפגישה שבתמונה'
    );
  });

  it('accepts supported in-limit media and normalizes the MIME type', () => {
    expect(
      normalizeDownloadedImage(
        { mimetype: 'image/jpeg; charset=binary', data: '/9j/2Q==', filesize: 4 },
        10
      )
    ).toEqual({
      mimeType: 'image/jpeg',
      base64Data: '/9j/2Q==',
      sizeBytes: 4,
    });
  });

  it('rejects unsupported, malformed, and oversized media', () => {
    expect(
      normalizeDownloadedImage({ mimetype: 'image/gif', data: 'R0lGODlh' }, 10)
    ).toBeUndefined();
    expect(
      normalizeDownloadedImage({ mimetype: 'image/png', data: 'not base64!' }, 10)
    ).toBeUndefined();
    expect(
      normalizeDownloadedImage({ mimetype: 'image/png', data: 'AAECAwQ=' }, 4)
    ).toBeUndefined();
  });

  it('builds an indexed Responses API content array without embedding image bytes in JSON', () => {
    const content = buildVisionInputContent({ timezone: 'Asia/Jerusalem' }, [imageMessage()]);
    expect(content).toHaveLength(2);
    expect(content[0]).toMatchObject({ type: 'input_text' });
    if (content[0]?.type !== 'input_text') throw new Error('Expected text input');
    expect(content[0].text).toContain('"imageIndex":1');
    expect(content[0].text).not.toContain('/9j/2Q==');
    expect(content[1]).toEqual({
      type: 'input_image',
      image_url: 'data:image/jpeg;base64,/9j/2Q==',
      detail: 'auto',
    });
  });
});
