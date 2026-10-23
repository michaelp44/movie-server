import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { ApprovalStore } from './approval-store.js';

describe('ApprovalStore', () => {
  it('returns an approval only once', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'whatsapp-agent-approval-'));
    const store = new ApprovalStore(directory);
    const created = await store.create(
      { type: 'write_note', title: 'Test', content: 'hello' },
      'Create a test note'
    );

    await expect(store.take(created.id)).resolves.toMatchObject({ id: created.id });
    await expect(store.take(created.id)).resolves.toBeUndefined();
  });

  it('takes the only pending approval without requiring its code', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'whatsapp-agent-approval-only-'));
    const store = new ApprovalStore(directory);
    const created = await store.create(
      { type: 'write_note', title: 'Test', content: 'hello' },
      'Create a test note'
    );

    await expect(store.takeOnly()).resolves.toMatchObject({
      kind: 'taken',
      approval: { id: created.id },
    });
    await expect(store.takeOnly()).resolves.toEqual({ kind: 'none' });
  });

  it('keeps every approval when code-free approval would be ambiguous', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'whatsapp-agent-approval-many-'));
    const store = new ApprovalStore(directory);
    const first = await store.create(
      { type: 'write_note', title: 'First', content: 'one' },
      'Create first note'
    );
    const second = await store.create(
      { type: 'write_note', title: 'Second', content: 'two' },
      'Create second note'
    );

    await expect(store.takeOnly()).resolves.toMatchObject({
      kind: 'multiple',
      approvals: [{ id: first.id }, { id: second.id }],
    });
    await expect(store.take(first.id)).resolves.toMatchObject({ id: first.id });
    await expect(store.take(second.id)).resolves.toMatchObject({ id: second.id });
  });

  it('expires stale approvals', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'whatsapp-agent-expiry-'));
    const store = new ApprovalStore(directory, -1);
    const created = await store.create(
      { type: 'write_note', title: 'Test', content: 'hello' },
      'Create a test note'
    );

    await expect(store.take(created.id)).resolves.toBeUndefined();
  });

  it('persists a validated Calendar event approval', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'whatsapp-agent-calendar-'));
    const store = new ApprovalStore(directory);
    const created = await store.create(
      {
        type: 'create_calendar_event',
        event: {
          title: 'Coffee',
          startTime: '2030-01-02T10:00:00+02:00',
          endTime: '2030-01-02T11:00:00+02:00',
          timezone: 'Asia/Jerusalem',
          attendeeEmail: 'guest@example.com',
          location: '',
          description: 'Coffee meeting',
          sourceChatId: 'group@g.us',
          sourceMessageId: 'message-1',
          idempotencyKey: 'a'.repeat(32),
        },
      },
      'Create Coffee'
    );

    await expect(store.take(created.id)).resolves.toMatchObject({
      action: { type: 'create_calendar_event', event: { title: 'Coffee' } },
    });
  });
});
