import { ApprovalStore } from './approval-store.js';
import {
  AnyListDetector,
  type AnyListDetectorLike,
} from './anylist-detector.js';
import {
  SiriShortcutAnyListWriter,
  type AnyListWriteResult,
  type AnyListWriter,
} from './anylist-service.js';
import { OpenAiAgent } from './openai-agent.js';
import {
  GoogleCalendarService,
  type CalendarEventCreator,
} from './calendar-service.js';
import {
  GROUP_CLARIFICATION_PREFIX,
  MeetingDetector,
  type MeetingDetectorLike,
  type MissingMeetingField,
} from './meeting-detector.js';
import { ToolRegistry } from './tool-registry.js';
import {
  GoogleSheetsPromptUpdater,
  type SheetPromptUpdater,
  type SheetUpdateResult,
} from './sheets-update-service.js';
import type { AgentConfig } from './config.js';
import type { PendingApproval, RecentMessage, RecentMessageReader, ReplyTarget } from './types.js';

const APPROVE_PATTERN = /^approve\s+([a-f0-9]{8})$/i;
const DENY_PATTERN = /^deny\s+([a-f0-9]{8})$/i;
const SIMPLE_APPROVE_PATTERN = /^approve$/i;
const SIMPLE_DENY_PATTERN = /^deny$/i;

const MISSING_FIELD_LABELS: Record<MissingMeetingField, string> = {
  title: 'כותרת או מטרת הפגישה',
  date: 'תאריך',
  start_time: 'שעת התחלה',
};

export interface MonitoredMessageResult {
  ownerReply?: string;
  groupReply?: string;
}

export function formatGroupClarification(missingFields: MissingMeetingField[]): string {
  const uniqueFields = [...new Set(missingFields)];
  const labels = uniqueFields.map((field) => MISSING_FIELD_LABELS[field]);
  return `${GROUP_CLARIFICATION_PREFIX} כדי שאוכל להכין את הפגישה ביומן, חסרים לי: ${labels.join(', ')}. אפשר לשלוח את כל הפרטים החסרים בהודעה אחת?`;
}

export function formatAnyListResult(result: AnyListWriteResult): string {
  if (result.failed.length === 0) {
    return ['🛒 הוספתי לרשימת הקניות:', ...result.added.map((item) => `• ${item}`)].join(
      '\n'
    );
  }
  if (result.added.length === 0) {
    return [
      'לא הצלחתי להוסיף את הפריטים לרשימת הקניות דרך Siri Shortcuts:',
      ...result.failed.map((item) => `• ${item}`),
    ].join('\n');
  }
  return [
    '🛒 הוספתי לרשימת הקניות:',
    ...result.added.map((item) => `• ${item}`),
    '',
    'לא הצלחתי להוסיף:',
    ...result.failed.map((item) => `• ${item}`),
  ].join('\n');
}

export class AgentRuntime {
  private readonly approvals: ApprovalStore;
  private readonly tools: ToolRegistry;
  private readonly agent: OpenAiAgent;
  private readonly meetingDetector: MeetingDetectorLike;
  private readonly anyListDetector: AnyListDetectorLike;
  private readonly anyListWriter: AnyListWriter;
  private readonly calendar: CalendarEventCreator;
  private readonly sheetsUpdater: SheetPromptUpdater;

  constructor(
    private readonly agentConfig: AgentConfig,
    reader?: RecentMessageReader,
    meetingDetector?: MeetingDetectorLike,
    anyListDetector?: AnyListDetectorLike,
    calendar?: CalendarEventCreator,
    anyListWriter?: AnyListWriter,
    sheetsUpdater?: SheetPromptUpdater
  ) {
    this.approvals = new ApprovalStore(agentConfig.dataDir);
    this.tools = new ToolRegistry(agentConfig, this.approvals, reader);
    this.agent = new OpenAiAgent(agentConfig, this.tools);
    this.meetingDetector = meetingDetector ?? new MeetingDetector(agentConfig);
    this.anyListDetector = anyListDetector ?? new AnyListDetector(agentConfig);
    this.calendar = calendar ?? new GoogleCalendarService(agentConfig);
    this.anyListWriter = anyListWriter ?? new SiriShortcutAnyListWriter(agentConfig);
    this.sheetsUpdater = sheetsUpdater ?? new GoogleSheetsPromptUpdater(agentConfig);
  }

  async handleSheetUpdate(prompt: string, sourceMessageId: string): Promise<SheetUpdateResult> {
    return this.sheetsUpdater.applyPrompt(prompt, sourceMessageId);
  }

  async handleMonitoredMessages(
    messages: RecentMessage[],
    sourceMessageId: string
  ): Promise<MonitoredMessageResult | undefined> {
    const [meetingDetection, anyListDetection] = await Promise.all([
      this.meetingDetector.detect(messages, sourceMessageId),
      this.anyListDetector.detect(messages, sourceMessageId),
    ]);
    const ownerReplies: string[] = [];
    let groupReply: string | undefined;

    if (meetingDetection.kind === 'clarification') {
      groupReply = formatGroupClarification(meetingDetection.missingFields);
    } else if (meetingDetection.kind === 'proposal') {
      const event = meetingDetection.event;
      const start = new Intl.DateTimeFormat('he-IL', {
        dateStyle: 'full',
        timeStyle: 'short',
        timeZone: event.timezone,
      }).format(new Date(event.startTime));
      if (this.agentConfig.calendar.autoCreate) {
        try {
          const result = await this.calendar.createEvent(event);
          ownerReplies.push(
            [
              '📅 נוצר זימון אוטומטית',
              `אירוע: ${event.title}`,
              `מועד: ${start}`,
              event.location ? `מיקום: ${event.location}` : '',
              `מוזמנת: ${event.attendeeEmail}`,
              result,
            ]
              .filter(Boolean)
              .join('\n')
          );
        } catch (error) {
          await this.meetingDetector.releaseProposal?.(event.idempotencyKey);
          ownerReplies.push(
            `יצירת הזימון האוטומטית נכשלה: ${error instanceof Error ? error.message : String(error)}. אפשר לשלוח שוב את בקשת התיאום כדי לנסות מחדש.`
          );
        }
      } else {
        const pending = await this.approvals.create(
          { type: 'create_calendar_event', event },
          `Create “${event.title}” on ${start} and invite ${event.attendeeEmail}`,
          this.agentConfig.calendar.approvalTtlHours * 60 * 60 * 1000
        );
        ownerReplies.push(
          [
            'I found a concrete meeting proposal in the monitored group.',
            `Event: ${event.title}`,
            `When: ${start}`,
            event.location ? `Where: ${event.location}` : '',
            `Guest: ${event.attendeeEmail}`,
            '',
            'React 👍🏼 to this message to create it in Google Calendar and email the guest.',
            'React 👎🏼 to deny it.',
            'You can also reply `approve` or `deny`.',
            `If several requests are pending, use \`${this.agentConfig.commandPrefix} approve ${pending.id}\`.`,
            `This proposal expires at ${pending.expiresAt}. Nothing has been created yet.`,
          ]
            .filter((line, index, lines) => line || lines[index - 1] !== '')
            .join('\n')
        );
      }
    }

    if (anyListDetection.kind === 'proposal') {
      const writeResult = await this.anyListWriter.addItems(anyListDetection.items);
      ownerReplies.push(formatAnyListResult(writeResult));
    }

    if (!groupReply && ownerReplies.length === 0) return undefined;
    return {
      ownerReply: ownerReplies.length > 0 ? ownerReplies.join('\n\n—\n\n') : undefined,
      groupReply,
    };
  }

  async handle(text: string, target: ReplyTarget): Promise<void> {
    const trimmed = text.trim();
    if (!trimmed) return;

    if (SIMPLE_APPROVE_PATTERN.test(trimmed)) {
      const result = await this.approvals.takeOnly();
      if (result.kind === 'none') {
        await target.reply('There is no pending request to approve.');
        return;
      }
      if (result.kind === 'multiple') {
        await target.reply(
          [
            'There are several pending requests. Choose one:',
            ...result.approvals.map(
              (approval) =>
                `• ${approval.summary}: ${this.agentConfig.commandPrefix} approve ${approval.id}`
            ),
          ].join('\n')
        );
        return;
      }
      await this.executeApproval(result.approval, target);
      return;
    }

    const approvalMatch = APPROVE_PATTERN.exec(trimmed);
    if (approvalMatch?.[1]) {
      const pending = await this.approvals.take(approvalMatch[1]);
      if (!pending) {
        await target.reply('That approval code is missing or expired.');
        return;
      }
      await this.executeApproval(pending, target);
      return;
    }

    if (SIMPLE_DENY_PATTERN.test(trimmed)) {
      const result = await this.approvals.takeOnly();
      if (result.kind === 'none') {
        await target.reply('There is no pending request to deny.');
      } else if (result.kind === 'multiple') {
        await target.reply(
          [
            'There are several pending requests. Choose one:',
            ...result.approvals.map(
              (approval) => `• ${approval.summary}: ${this.agentConfig.commandPrefix} deny ${approval.id}`
            ),
          ].join('\n')
        );
      } else {
        await target.reply(`Denied: ${result.approval.summary}`);
      }
      return;
    }

    const denyMatch = DENY_PATTERN.exec(trimmed);
    if (denyMatch?.[1]) {
      const denied = await this.approvals.deny(denyMatch[1]);
      await target.reply(
        denied
          ? 'Denied. The pending action was discarded.'
          : 'That approval code is missing or expired.'
      );
      return;
    }

    if (trimmed === 'help') {
      await target.reply(
        'Send a normal request, for example: “summarize my allowlisted recent messages” or “write a note about …”. When one action is waiting, reply `approve` or `deny`. A code is required only when several actions are pending. Concrete meeting proposals from the configured group also arrive here for approval.'
      );
      return;
    }

    try {
      await target.reply(await this.agent.respond(trimmed));
    } catch (error) {
      await target.reply(`Agent error: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private async executeApproval(pending: PendingApproval, target: ReplyTarget): Promise<void> {
    try {
      const result = await this.tools.executeApproved(pending.action);
      await target.reply(`Approved and completed: ${pending.summary}\n\n${result}`);
    } catch (error) {
      if (pending.action.type === 'create_calendar_event') {
        const replacement = await this.approvals.create(
          pending.action,
          pending.summary,
          this.agentConfig.calendar.approvalTtlHours * 60 * 60 * 1000
        );
        await target.reply(
          [
            `Approved, but Calendar creation failed: ${error instanceof Error ? error.message : String(error)}`,
            '',
            'The event uses a stable idempotency key, so retrying cannot create a duplicate.',
            'After fixing the Calendar connection, react 👍🏼 to this message or reply `approve` to retry.',
            `If several requests are pending, use \`${this.agentConfig.commandPrefix} approve ${replacement.id}\`.`,
          ].join('\n')
        );
        return;
      }
      await target.reply(
        `Approved, but execution failed: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }
}
