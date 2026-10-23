import { describe, expect, it } from 'vitest';
import { calendarEventId } from './calendar-service.js';

describe('calendarEventId', () => {
  it('is deterministic and valid for Google Calendar', () => {
    const first = calendarEventId('a'.repeat(32));
    const second = calendarEventId('a'.repeat(32));

    expect(first).toBe(second);
    expect(first).toMatch(/^[a-f0-9]{32}$/);
  });

  it('changes for a different proposal', () => {
    expect(calendarEventId('a'.repeat(32))).not.toBe(calendarEventId('b'.repeat(32)));
  });
});
