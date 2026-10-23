import { describe, expect, it } from 'vitest';
import { GROUP_CLARIFICATION_PREFIX } from './meeting-detector.js';
import { formatAnyListResult, formatGroupClarification } from './runtime.js';

describe('formatGroupClarification', () => {
  it('asks for every missing field in one bounded Hebrew message', () => {
    const message = formatGroupClarification([
      'date',
      'start_time',
    ]);

    expect(message).toMatch(new RegExp(`^${GROUP_CLARIFICATION_PREFIX}`));
    expect(message).toContain('תאריך');
    expect(message).toContain('שעת התחלה');
    expect(message).not.toContain('משך הפגישה או שעת סיום');
    expect(message).not.toContain('מיקום');
    expect(message.length).toBeLessThan(1000);
  });

  it('does not repeat duplicate fields', () => {
    const message = formatGroupClarification(['date', 'date']);
    expect(message.match(/תאריך/g)).toHaveLength(1);
  });

  it('creates one compact confirmation without Shortcut links', () => {
    const message = formatAnyListResult({
      added: ['חלב', '2 חבילות ביצים'],
      failed: [],
    });

    expect(message).toContain('• חלב');
    expect(message).toContain('• 2 חבילות ביצים');
    expect(message).not.toContain('shortcuts://');
    expect(message.split('\n')).toHaveLength(3);
  });
});
