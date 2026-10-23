export interface NamedTask {
  description: string;
  command: string[];
}

export interface RecentMessageImage {
  mimeType: 'image/jpeg' | 'image/png' | 'image/webp';
  base64Data: string;
  sizeBytes: number;
}

export interface RecentMessage {
  messageId?: string;
  chatId: string;
  chatName: string;
  senderId?: string;
  fromMe: boolean;
  timestamp: number;
  body: string;
  image?: RecentMessageImage;
}

export interface RecentMessageReader {
  readRecentMessages(limit: number): Promise<RecentMessage[]>;
}

export interface ReplyTarget {
  reply(text: string): Promise<void>;
}

export interface CalendarEventInput {
  title: string;
  startTime: string;
  endTime: string;
  timezone: string;
  attendeeEmail: string;
  location: string;
  description: string;
  sourceChatId: string;
  sourceMessageId: string;
  idempotencyKey: string;
}

export type PendingAction =
  | {
      type: 'write_note';
      title: string;
      content: string;
    }
  | {
      type: 'run_named_task';
      name: string;
    }
  | {
      type: 'create_calendar_event';
      event: CalendarEventInput;
    };

export interface PendingApproval {
  id: string;
  action: PendingAction;
  summary: string;
  createdAt: string;
  expiresAt: string;
}
