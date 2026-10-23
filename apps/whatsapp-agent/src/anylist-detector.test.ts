import { describe, expect, it } from 'vitest';
import {
  mightContainShoppingIntent,
  normalizeShoppingItems,
} from './anylist-detector.js';
import type { RecentMessage } from './types.js';

function message(body: string): RecentMessage {
  return {
    chatId: 'group@g.us',
    chatName: 'מאמי',
    fromMe: true,
    timestamp: 1_800_000_000,
    body,
  };
}

describe('AnyList monitoring helpers', () => {
  it('recognizes explicit Hebrew and English shopping requests', () => {
    expect(mightContainShoppingIntent([message('צריך לקנות חלב וביצים')])).toBe(true);
    expect(mightContainShoppingIntent([message('please add apples to the grocery list')])).toBe(true);
    expect(mightContainShoppingIntent([message('נפגשים בשבע')])).toBe(false);
    expect(mightContainShoppingIntent([message('צריך אוכל טוב לבטן כזה')])).toBe(false);
  });

  it('does not treat an uncaptioned image as a shopping request', () => {
    expect(
      mightContainShoppingIntent([
        {
          ...message(''),
          image: {
            mimeType: 'image/jpeg',
            base64Data: '/9j/2Q==',
            sizeBytes: 4,
          },
        },
      ])
    ).toBe(false);
  });

  it('evaluates only the trigger message instead of stale shopping context', () => {
    const messages = [
      { ...message('תוסיף טונה במים'), messageId: 'shopping' },
      { ...message('סבבה תודה'), messageId: 'current' },
    ];
    expect(mightContainShoppingIntent(messages, 'current')).toBe(false);
    expect(mightContainShoppingIntent(messages, 'shopping')).toBe(true);
  });

  it('removes vague phrases, exact duplicates, and generic variants', () => {
    expect(
      normalizeShoppingItems([
        'טונה',
        'טונה במים',
        ' טונה במים ',
        'אוכל טוב לבטן כזה',
        '• חלב',
      ])
    ).toEqual(['טונה במים', 'חלב']);
  });
});
