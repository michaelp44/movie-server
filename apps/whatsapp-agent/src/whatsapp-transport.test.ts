import { describe, expect, it } from 'vitest';
import {
  approvalDecisionFromReaction,
  approvalIdFromAgentMessage,
  commandFromOwnerMessage,
  isAllowedOwnerCommandChat,
  isCleanupReaction,
  isTechnicalSupportTrigger,
  serializedMessageId,
  SHEETS_CLARIFICATION_PREFIX,
  sheetClarificationContinuationPrompt,
  sheetUpdateCompletionReply,
  sheetUpdatePrompt,
  shouldSendReactionReply,
} from './whatsapp-transport.js';

describe('commandFromOwnerMessage', () => {
  it('extracts only messages that begin with the Hebrew Sheets update prefix', () => {
    expect(sheetUpdatePrompt('עדכון: תוסיף 3 שקיות קרח')).toBe('תוסיף 3 שקיות קרח');
    expect(sheetUpdatePrompt('  עדכון:   מחק את הטונה  ')).toBe('מחק את הטונה');
    expect(sheetUpdatePrompt('עדכון:')).toBe('');
    expect(sheetUpdatePrompt('אפשר עדכון: תוסיף קרח')).toBeUndefined();
    expect(sheetUpdatePrompt('עדכון תוסיף קרח')).toBeUndefined();
  });

  it('returns one short completion message after a successful update', () => {
    expect(sheetUpdateCompletionReply()).toBe('בוט: עשיתי');
  });

  it('accepts only the exact Hebrew technical-support trigger', () => {
    expect(isTechnicalSupportTrigger('תמיכה טכנית')).toBe(true);
    expect(isTechnicalSupportTrigger('  תמיכה   טכנית  ')).toBe(true);
    expect(isTechnicalSupportTrigger('צריך תמיכה טכנית')).toBe(false);
    expect(isTechnicalSupportTrigger('תמיכה טכנית עכשיו')).toBe(false);
  });

  it('continues a quoted Sheets clarification with the original context', () => {
    const prompt = sheetClarificationContinuationPrompt(
      'עדכון: בכל מקום שלא כתוב מי מביא תכתוב מיכאל ושובל',
      `${SHEETS_CLARIFICATION_PREFIX} האם לעדכן גם הערות קיימות?`,
      'כן'
    );
    expect(prompt).toContain('בכל מקום שלא כתוב מי מביא');
    expect(prompt).toContain('האם לעדכן גם הערות קיימות?');
    expect(prompt).toContain('תשובת המשתמש: כן');
    expect(sheetClarificationContinuationPrompt('הודעה רגילה', `${SHEETS_CLARIFICATION_PREFIX} שאלה?`, 'כן')).toBeUndefined();
    expect(sheetClarificationContinuationPrompt('עדכון: שנה משהו', 'הודעה רגילה', 'כן')).toBeUndefined();
  });

  it('accepts a code-free approval or denial', () => {
    expect(commandFromOwnerMessage('approve', '!agent')).toBe('approve');
    expect(commandFromOwnerMessage('  APPROVE  ', '!agent')).toBe('approve');
    expect(commandFromOwnerMessage('deny', '!agent')).toBe('deny');
  });

  it('continues to require the prefix for normal commands', () => {
    expect(commandFromOwnerMessage('help', '!agent')).toBeUndefined();
    expect(commandFromOwnerMessage('!agent help', '!agent')).toBe('help');
  });

  it('accepts simple decisions in the owner chat or monitored group only', () => {
    expect(isAllowedOwnerCommandChat('owner@c.us', 'owner@c.us', 'group@g.us', 'approve')).toBe(true);
    expect(isAllowedOwnerCommandChat('group@g.us', 'owner@c.us', 'group@g.us', 'approve')).toBe(true);
    expect(isAllowedOwnerCommandChat('other@g.us', 'owner@c.us', 'group@g.us', 'approve')).toBe(false);
    expect(isAllowedOwnerCommandChat('group@g.us', 'owner@c.us', 'group@g.us', 'help')).toBe(false);
    expect(
      isAllowedOwnerCommandChat(
        'owner@lid',
        'owner@c.us',
        'group@g.us',
        'help',
        new Set(['owner@c.us', 'owner@lid'])
      )
    ).toBe(true);
  });

  it('maps thumbs reactions including skin tones to approval decisions', () => {
    expect(approvalDecisionFromReaction('👍')).toBe('approve');
    expect(approvalDecisionFromReaction('👍🏼')).toBe('approve');
    expect(approvalDecisionFromReaction('👎🏽')).toBe('deny');
    expect(approvalDecisionFromReaction('❤️')).toBeUndefined();
    expect(approvalDecisionFromReaction('')).toBeUndefined();
  });

  it('treats every non-empty emoji reaction as a cleanup request', () => {
    expect(isCleanupReaction('👍🏼')).toBe(true);
    expect(isCleanupReaction('❤️')).toBe(true);
    expect(isCleanupReaction('😂')).toBe(true);
    expect(isCleanupReaction('')).toBe(false);
    expect(isCleanupReaction('   ')).toBe(false);
  });

  it('extracts the exact approval id from an agent proposal', () => {
    expect(approvalIdFromAgentMessage('Use `!agent approve ab12cd34` if needed.')).toBe('AB12CD34');
    expect(approvalIdFromAgentMessage('No approval code here.')).toBeUndefined();
  });

  it('reconstructs reaction parent IDs when WhatsApp omits _serialized', () => {
    expect(
      serializedMessageId({
        fromMe: true,
        remote: '74075468759213@lid',
        id: '3EB0C2EA917953F342444C',
        self: 'out',
        $1: 'true_74075468759213@lid_3EB0C2EA917953F342444C_out',
      })
    ).toBe('true_74075468759213@lid_3EB0C2EA917953F342444C_out');
    expect(
      serializedMessageId({
        fromMe: true,
        remote: { user: '74075468759213', server: 'lid' },
        id: '3EB0C2EA917953F342444C',
      })
    ).toBe('true_74075468759213@lid_3EB0C2EA917953F342444C');
    expect(
      serializedMessageId({
        fromMe: true,
        remote: { _serialized: '74075468759213@lid' },
        id: '3EB0C2EA917953F342444C',
      })
    ).toBe('true_74075468759213@lid_3EB0C2EA917953F342444C');
  });

  it('prefers a complete serialized message ID and rejects incomplete keys', () => {
    expect(serializedMessageId({ _serialized: 'true_owner@c.us_ABC' })).toBe(
      'true_owner@c.us_ABC'
    );
    expect(serializedMessageId({ fromMe: true, id: 'ABC' })).toBeUndefined();
  });

  it('suppresses successful reaction confirmations but keeps failure messages', () => {
    expect(shouldSendReactionReply('Approved and completed: Create event')).toBe(false);
    expect(shouldSendReactionReply('Approved, but Calendar creation failed: token expired')).toBe(
      true
    );
    expect(shouldSendReactionReply('That approval code is missing or expired.')).toBe(true);
  });
});
