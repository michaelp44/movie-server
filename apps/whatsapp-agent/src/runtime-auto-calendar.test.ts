import { access, mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { CalendarEventCreator } from './calendar-service.js';
import type { AgentConfig } from './config.js';
import type { AnyListDetectorLike } from './anylist-detector.js';
import type { AnyListWriter } from './anylist-service.js';
import type { MeetingDetectorLike } from './meeting-detector.js';
import { AgentRuntime } from './runtime.js';
import type { CalendarEventInput } from './types.js';

function testConfig(directory: string): AgentConfig {
  return {
    transport: 'console',
    openaiApiKey: 'test',
    model: 'test-model',
    commandPrefix: '!agent',
    timezone: 'UTC',
    dataDir: join(directory, 'agent-data'),
    workspaceRoot: directory,
    tasksFile: join(directory, 'tasks.json'),
    namedTasks: {},
    whatsapp: {
      riskAcknowledgement: '',
      sessionDir: join(directory, 'session'),
      headless: true,
      readAllowlist: [],
      recentMessageLimit: 20,
      monitorGroupName: '',
      monitorGroupId: '',
      monitorContextMessages: 30,
      monitorDebounceSeconds: 8,
      monitorImageLimit: 3,
      monitorImageMaxBytes: 5 * 1024 * 1024,
      monitorClarificationCooldownHours: 12,
    },
    anyList: { monitorEnabled: false, shortcutName: 'Test Shortcut' },
    sheets: {
      enabled: false,
      monitorGroupName: '',
      monitorGroupId: '',
      spreadsheetId: '',
      sheetName: 'קניות',
      credentialsPath: join(directory, 'client.json'),
      tokenPath: join(directory, 'sheets-token.json'),
      oauthPort: 42814,
      maxChanges: 20,
    },
    calendar: {
      autoCreate: true,
      calendarId: 'primary',
      credentialsPath: join(directory, 'client.json'),
      tokenPath: join(directory, 'token.json'),
      attendeeEmail: 'guest@example.com',
      defaultDurationMinutes: 60,
      approvalTtlHours: 24,
      oauthPort: 42813,
    },
  };
}

const event: CalendarEventInput = {
  title: 'Test meeting',
  startTime: '2030-01-02T10:00:00Z',
  endTime: '2030-01-02T11:00:00Z',
  timezone: 'UTC',
  attendeeEmail: 'guest@example.com',
  location: '',
  description: 'Test',
  sourceChatId: 'group@g.us',
  sourceMessageId: 'message-1',
  idempotencyKey: '0123456789abcdef0123456789abcdef',
};

const anyListDetector: AnyListDetectorLike = {
  async detect() {
    return { kind: 'none' };
  },
};

describe('automatic Calendar creation', () => {
  it('creates a detected event immediately without a pending approval', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'whatsapp-agent-auto-calendar-'));
    const meetingDetector: MeetingDetectorLike = {
      async detect() {
        return { kind: 'proposal', event };
      },
    };
    const created: CalendarEventInput[] = [];
    const calendar: CalendarEventCreator = {
      async createEvent(input) {
        created.push(input);
        return 'Google Calendar event is ready: https://calendar.example/event';
      },
    };
    const runtime = new AgentRuntime(
      testConfig(directory),
      undefined,
      meetingDetector,
      anyListDetector,
      calendar
    );

    const result = await runtime.handleMonitoredMessages([], 'message-1');

    expect(created).toEqual([event]);
    expect(result?.ownerReply).toContain('נוצר זימון אוטומטית');
    expect(result?.ownerReply).not.toContain('approve');
    await expect(access(join(directory, 'agent-data', 'pending-approvals.json'))).rejects.toThrow();
  });

  it('releases deduplication when automatic Calendar creation fails', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'whatsapp-agent-auto-calendar-'));
    const released: string[] = [];
    const meetingDetector: MeetingDetectorLike = {
      async detect() {
        return { kind: 'proposal', event };
      },
      async releaseProposal(idempotencyKey) {
        released.push(idempotencyKey);
      },
    };
    const calendar: CalendarEventCreator = {
      async createEvent() {
        throw new Error('token expired');
      },
    };
    const runtime = new AgentRuntime(
      testConfig(directory),
      undefined,
      meetingDetector,
      anyListDetector,
      calendar
    );

    const result = await runtime.handleMonitoredMessages([], 'message-1');

    expect(released).toEqual([event.idempotencyKey]);
    expect(result?.ownerReply).toContain('נכשלה');
    expect(result?.ownerReply).toContain('token expired');
  });
});

describe('automatic AnyList additions', () => {
  it('runs the local Shortcut and returns one compact confirmation without links', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'whatsapp-agent-anylist-'));
    const meetingDetector: MeetingDetectorLike = {
      async detect() {
        return { kind: 'none' };
      },
    };
    const detectedItems = ['טונה במים', 'חלב'];
    const detector: AnyListDetectorLike = {
      async detect() {
        return { kind: 'proposal', items: detectedItems };
      },
    };
    const written: string[][] = [];
    const writer: AnyListWriter = {
      async addItems(items) {
        written.push(items);
        return { added: items, failed: [] };
      },
    };
    const calendar: CalendarEventCreator = {
      async createEvent() {
        throw new Error('unexpected calendar call');
      },
    };
    const runtime = new AgentRuntime(
      testConfig(directory),
      undefined,
      meetingDetector,
      detector,
      calendar,
      writer
    );

    const result = await runtime.handleMonitoredMessages([], 'shopping-message');

    expect(written).toEqual([detectedItems]);
    expect(result?.ownerReply).toContain('הוספתי לרשימת הקניות');
    expect(result?.ownerReply).toContain('• טונה במים');
    expect(result?.ownerReply).not.toContain('shortcuts://');
  });
});
