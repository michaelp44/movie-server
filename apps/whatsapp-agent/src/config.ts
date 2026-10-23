import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { z } from 'zod';
import { appRoot, repositoryRoot } from './locations.js';
import type { NamedTask } from './types.js';

const namedTaskSchema = z.object({
  description: z.string().min(1).max(500),
  command: z.array(z.string().min(1)).min(1).max(50),
});

const namedTasksSchema = z.record(z.string().regex(/^[a-zA-Z0-9_-]+$/), namedTaskSchema);

function booleanEnv(name: string, fallback: boolean): boolean {
  const value = process.env[name];
  if (value === undefined || value === '') return fallback;
  return value === '1' || value.toLowerCase() === 'true';
}

function integerEnv(name: string, fallback: number, minimum: number, maximum: number): number {
  const value = Number.parseInt(process.env[name] ?? '', 10);
  if (!Number.isFinite(value)) return fallback;
  return Math.min(maximum, Math.max(minimum, value));
}

function commaList(value: string | undefined): string[] {
  return (value ?? '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function readNamedTasks(filePath: string): Record<string, NamedTask> {
  if (!existsSync(filePath)) return {};
  const parsed: unknown = JSON.parse(readFileSync(filePath, 'utf8'));
  return namedTasksSchema.parse(parsed);
}

const transportSchema = z.enum(['console', 'whatsapp']);
const transport = transportSchema.parse(process.env['AGENT_TRANSPORT'] || 'console');
const dataDir = resolve(
  repositoryRoot,
  process.env['WHATSAPP_AGENT_DATA_DIR'] || './data/whatsapp-agent'
);
const tasksFile = resolve(
  repositoryRoot,
  process.env['WHATSAPP_AGENT_TASKS_FILE'] || resolve(appRoot, 'tasks.json')
);

export const config = {
  transport,
  openaiApiKey: process.env['OPENAI_API_KEY'] || '',
  model: process.env['WHATSAPP_AGENT_MODEL'] || 'gpt-5.6-luna',
  commandPrefix: process.env['WHATSAPP_AGENT_PREFIX'] || '!agent',
  timezone: process.env['WHATSAPP_AGENT_TIMEZONE'] || 'UTC',
  dataDir,
  workspaceRoot: resolve(
    repositoryRoot,
    process.env['WHATSAPP_AGENT_WORKSPACE_ROOT'] || repositoryRoot
  ),
  tasksFile,
  namedTasks: readNamedTasks(tasksFile),
  whatsapp: {
    weddingOnly: booleanEnv('WHATSAPP_WEDDING_ONLY', false),
    riskAcknowledgement: process.env['WHATSAPP_UNOFFICIAL_WEB_AUTOMATION_ACK'] || '',
    sessionDir: resolve(
      repositoryRoot,
      process.env['WHATSAPP_SESSION_DIR'] || './data/whatsapp-agent/whatsapp-session'
    ),
    headless: booleanEnv('WHATSAPP_HEADLESS', true),
    readAllowlist: commaList(process.env['WHATSAPP_READ_ALLOWLIST']),
    recentMessageLimit: integerEnv('WHATSAPP_RECENT_MESSAGE_LIMIT', 20, 1, 100),
    monitorGroupName: process.env['WHATSAPP_MONITOR_GROUP_NAME']?.trim() || '',
    monitorGroupId: process.env['WHATSAPP_MONITOR_GROUP_ID']?.trim() || '',
    monitorContextMessages: integerEnv('WHATSAPP_MONITOR_CONTEXT_MESSAGES', 30, 5, 100),
    monitorDebounceSeconds: integerEnv('WHATSAPP_MONITOR_DEBOUNCE_SECONDS', 8, 1, 60),
    monitorImageLimit: integerEnv('WHATSAPP_MONITOR_IMAGE_LIMIT', 3, 1, 10),
    monitorImageMaxBytes:
      integerEnv('WHATSAPP_MONITOR_MAX_IMAGE_MB', 5, 1, 20) * 1024 * 1024,
    monitorClarificationCooldownHours: integerEnv(
      'WHATSAPP_MONITOR_CLARIFICATION_COOLDOWN_HOURS',
      12,
      1,
      168
    ),
    weddingControlPort: integerEnv('WEDDING_WHATSAPP_CONTROL_PORT', 8790, 1024, 65535),
  },
  weddingCampaignWorker: {
    enabled: booleanEnv('WEDDING_CAMPAIGN_WORKER_ENABLED', false),
    url: process.env['WEDDING_CAMPAIGN_WORKER_URL']?.trim() || '',
    secret: process.env['WEDDING_CAMPAIGN_WORKER_SECRET']?.trim() || '',
    pollSeconds: integerEnv('WEDDING_CAMPAIGN_WORKER_POLL_SECONDS', 30, 15, 300),
  },
  anyList: {
    monitorEnabled: booleanEnv('ANYLIST_MONITOR_ENABLED', false),
    shortcutName: process.env['ANYLIST_SHORTCUT_NAME']?.trim() || 'Add to קניות בסופר',
  },
  sheets: {
    enabled: booleanEnv('GOOGLE_SHEETS_UPDATE_MONITOR_ENABLED', false),
    monitorGroupName: process.env['GOOGLE_SHEETS_UPDATE_GROUP_NAME']?.trim() || '',
    monitorGroupId: process.env['GOOGLE_SHEETS_UPDATE_GROUP_ID']?.trim() || '',
    spreadsheetId: process.env['GOOGLE_SHEETS_SPREADSHEET_ID']?.trim() || '',
    sheetName: process.env['GOOGLE_SHEETS_SHEET_NAME']?.trim() || 'קניות',
    credentialsPath: resolve(
      repositoryRoot,
      process.env['GOOGLE_SHEETS_CREDENTIALS_PATH'] ||
        './data/whatsapp-agent/google-oauth-client.json'
    ),
    tokenPath: resolve(
      repositoryRoot,
      process.env['GOOGLE_SHEETS_TOKEN_PATH'] ||
        './data/whatsapp-agent/google-sheets-oauth-token.json'
    ),
    oauthPort: integerEnv('GOOGLE_SHEETS_OAUTH_PORT', 42814, 1024, 65535),
    maxChanges: integerEnv('GOOGLE_SHEETS_MAX_CHANGES', 20, 1, 20),
  },
  calendar: {
    autoCreate: booleanEnv('GOOGLE_CALENDAR_AUTO_CREATE', false),
    calendarId: process.env['GOOGLE_CALENDAR_ID']?.trim() || 'primary',
    credentialsPath: resolve(
      repositoryRoot,
      process.env['GOOGLE_CALENDAR_CREDENTIALS_PATH'] ||
        './data/whatsapp-agent/google-oauth-client.json'
    ),
    tokenPath: resolve(
      repositoryRoot,
      process.env['GOOGLE_CALENDAR_TOKEN_PATH'] ||
        './data/whatsapp-agent/google-oauth-token.json'
    ),
    attendeeEmail:
      process.env['GOOGLE_CALENDAR_ATTENDEE']?.trim().toLowerCase() ||
      'shoval18995@gmail.com',
    defaultDurationMinutes: integerEnv('GOOGLE_CALENDAR_DEFAULT_DURATION_MINUTES', 60, 15, 720),
    approvalTtlHours: integerEnv('GOOGLE_CALENDAR_APPROVAL_TTL_HOURS', 24, 1, 168),
    oauthPort: integerEnv('GOOGLE_CALENDAR_OAUTH_PORT', 42813, 1024, 65535),
  },
} as const;

export type AgentConfig = typeof config;
