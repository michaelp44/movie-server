import { describe, expect, it } from 'vitest';
import {
  GROUP_CLARIFICATION_PREFIX,
  isUsableMeetingExtraction,
  meetingContextForSource,
  shouldEvaluateMeetingIntent,
  withDefaultMeetingDuration,
  type MeetingExtraction,
} from './meeting-detector.js';
import type { RecentMessage } from './types.js';

const base: MeetingExtraction = {
  outcome: 'propose',
  confidence: 0.95,
  missingFields: [],
  title: 'Coffee',
  startTime: '2030-01-02T10:00:00+02:00',
  endTime: '2030-01-02T11:00:00+02:00',
  location: '',
  description: '',
  evidence: 'Agreed to meet',
  reason: 'Concrete future time',
};

describe('isUsableMeetingExtraction', () => {
  it('accepts a high-confidence future event with explicit offsets', () => {
    expect(isUsableMeetingExtraction(base, new Date('2029-12-31T00:00:00Z'))).toBe(true);
  });

  it('rejects vague or offset-free proposals', () => {
    expect(
      isUsableMeetingExtraction({ ...base, confidence: 0.6 }, new Date('2029-12-31T00:00:00Z'))
    ).toBe(false);
    expect(
      isUsableMeetingExtraction(
        { ...base, startTime: '2030-01-02T10:00:00' },
        new Date('2029-12-31T00:00:00Z')
      )
    ).toBe(false);
  });

  it('accepts an overnight event but rejects excessively long events', () => {
    expect(isUsableMeetingExtraction(base, new Date('2031-01-01T00:00:00Z'))).toBe(false);
    expect(
      isUsableMeetingExtraction(
        {
          ...base,
          startTime: '2030-01-02T12:00:00+02:00',
          endTime: '2030-01-03T06:00:00+02:00',
        },
        new Date('2029-12-31T00:00:00Z')
      )
    ).toBe(true);
    expect(
      isUsableMeetingExtraction(
        { ...base, endTime: '2030-01-04T11:00:00+02:00' },
        new Date('2029-12-31T00:00:00Z')
      )
    ).toBe(false);
  });
});

describe('withDefaultMeetingDuration', () => {
  it('uses one hour when a concrete meeting has no duration or end time', () => {
    expect(
      withDefaultMeetingDuration(
        {
          ...base,
          outcome: 'clarify',
          missingFields: [],
          startTime: '2030-01-02T21:00:00+02:00',
          endTime: '',
        },
        60
      )
    ).toMatchObject({
      outcome: 'propose',
      startTime: '2030-01-02T21:00:00+02:00',
      endTime: '2030-01-02T20:00:00.000Z',
    });
  });

  it('preserves an explicit valid end time', () => {
    expect(withDefaultMeetingDuration(base, 60).endTime).toBe(base.endTime);
  });
});

function message(
  messageId: string,
  timestamp: number,
  body: string,
  image = false
): RecentMessage {
  return {
    messageId,
    chatId: 'group@g.us',
    chatName: 'מאמי',
    fromMe: true,
    timestamp,
    body,
    ...(image
      ? {
          image: {
            mimeType: 'image/jpeg' as const,
            base64Data: '/9j/2Q==',
            sizeBytes: 4,
          },
        }
      : {}),
  };
}

describe('meeting trigger isolation', () => {
  it('ignores unrelated new chat even when an old meeting request is in fetched history', () => {
    const messages = [
      message('old', 1_000, 'תקבע לנו פגישה מחר בשעה 10'),
      message('new', 4_700, 'קורע חחח'),
    ];
    expect(meetingContextForSource(messages, 'new')).toEqual([messages[1]]);
    expect(shouldEvaluateMeetingIntent(messages, 'new', 8)).toBe(false);
  });

  it('ignores standalone images and ordinary text', () => {
    expect(
      shouldEvaluateMeetingIntent(
        [message('image', 2_000, '', true), message('text', 2_001, 'קורע')],
        'text',
        8
      )
    ).toBe(false);
  });

  it('accepts an explicit meeting request in the current debounce batch', () => {
    expect(
      shouldEvaluateMeetingIntent(
        [message('request', 2_000, 'תקבע לנו זימון ליום שלישי'), message('new', 2_005, 'תודה')],
        'new',
        8
      )
    ).toBe(true);
  });

  it('accepts common first-person and imperative Hebrew scheduling forms', () => {
    expect(
      shouldEvaluateMeetingIntent(
        [message('request', 2_000, 'תזמן לי בירה ביום שני בערב')],
        'request',
        8
      )
    ).toBe(true);
    expect(
      shouldEvaluateMeetingIntent(
        [message('request', 2_000, 'קבעתי בירה עם אור ביום שני')],
        'request',
        8
      )
    ).toBe(true);
    expect(
      shouldEvaluateMeetingIntent(
        [
          message(
            'request',
            2_000,
            'עוזר התיאום תקבע פגישה לתאריך 16/09/2026 לשעה 21:00'
          ),
        ],
        'request',
        8
      )
    ).toBe(true);
  });

  it('accepts concrete scheduling details after a recent clarification', () => {
    expect(
      shouldEvaluateMeetingIntent(
        [
          message('request', 2_000, 'בוא נקבע'),
          message(
            'assistant',
            2_010,
            `${GROUP_CLARIFICATION_PREFIX} חסרים לי תאריך ושעה`
          ),
          message('answer', 2_020, '25/8 בשעה 21:00 למשך שעה'),
        ],
        'answer',
        8
      )
    ).toBe(true);
  });

  it('accepts a title supplied after a recent clarification', () => {
    expect(
      shouldEvaluateMeetingIntent(
        [
          message('request', 2_000, 'תעשה זימון ליום חמישי 24/9 מ12 עד 6 בבוקר'),
          message(
            'assistant',
            2_010,
            `${GROUP_CLARIFICATION_PREFIX} חסרה לי כותרת או מטרת הפגישה`
          ),
          message('answer', 2_020, 'כותרת היא פסטיבל של אינפקטד'),
        ],
        'answer',
        8
      )
    ).toBe(true);
  });
});
