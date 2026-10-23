import './env.js';
import { execFile } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { promisify } from 'node:util';
import { google } from 'googleapis';
import { z } from 'zod';
import { readOAuthClientCredentials } from './calendar-service.js';
import { config } from './config.js';

const execFileAsync = promisify(execFile);
const MAX_HEARTBEAT_AGE_MS = 10 * 60 * 1000;

type CheckKind = 'PASS' | 'FAIL' | 'ACTION';

interface CheckResult {
  kind: CheckKind;
  name: string;
  detail: string;
}

const healthStatusSchema = z.object({
  checkedAt: z.string().datetime(),
  processId: z.number().int().positive(),
  whatsappState: z.string(),
  ownerChatReady: z.boolean(),
  meetingMonitorGroupId: z.string(),
  sheetsMonitorGroupId: z.string(),
  runtimeErrorCount: z.number().int().nonnegative(),
  lastRuntimeErrorAt: z.string(),
  lastRuntimeError: z.string(),
  meetingMonitorProbeAt: z.string().optional(),
  meetingMonitorProbeOk: z.boolean().optional(),
  meetingMonitorProbeError: z.string().optional(),
});

async function readJson(path: string): Promise<Record<string, unknown>> {
  return JSON.parse(await readFile(path, 'utf8')) as Record<string, unknown>;
}

function message(error: unknown): string {
  if ((error as NodeJS.ErrnoException).code === 'ENOENT') return 'required file is missing';
  return (error instanceof Error ? error.message : String(error)).replace(/\s+/g, ' ').slice(0, 500);
}

async function checkLaunchAgent(): Promise<CheckResult> {
  try {
    const userId = process.getuid?.();
    if (userId === undefined) throw new Error('cannot determine the current macOS user ID');
    const { stdout } = await execFileAsync('/bin/launchctl', [
      'print',
      `gui/${userId}/com.movieserver.whatsapp-agent`,
    ]);
    if (!/\bstate = running\b/.test(stdout)) {
      return { kind: 'FAIL', name: 'launchd', detail: 'WhatsApp agent is loaded but not running' };
    }
    return { kind: 'PASS', name: 'launchd', detail: 'WhatsApp agent process is running' };
  } catch (error) {
    return { kind: 'FAIL', name: 'launchd', detail: message(error) };
  }
}

async function checkHeartbeat(): Promise<CheckResult[]> {
  try {
    const status = healthStatusSchema.parse(
      JSON.parse(await readFile(`${config.dataDir}/health-status.json`, 'utf8'))
    );
    const age = Date.now() - Date.parse(status.checkedAt);
    const results: CheckResult[] = [];
    results.push(
      age <= MAX_HEARTBEAT_AGE_MS && status.whatsappState === 'CONNECTED' && status.ownerChatReady
        ? { kind: 'PASS', name: 'whatsapp', detail: `connected; heartbeat age ${Math.max(0, Math.round(age / 1000))}s` }
        : { kind: 'FAIL', name: 'whatsapp', detail: `state=${status.whatsappState}; heartbeat age ${Math.max(0, Math.round(age / 1000))}s` }
    );
    results.push(
      status.meetingMonitorGroupId === config.whatsapp.monitorGroupId
        ? { kind: 'PASS', name: 'meeting-group', detail: 'מאמי is bound to the configured stable group ID' }
        : { kind: 'FAIL', name: 'meeting-group', detail: 'מאמי monitor is not bound to the configured group ID' }
    );
    results.push(
      status.meetingMonitorProbeOk === true &&
        typeof status.meetingMonitorProbeAt === 'string' &&
        Date.now() - Date.parse(status.meetingMonitorProbeAt) <= MAX_HEARTBEAT_AGE_MS
        ? {
            kind: 'PASS',
            name: 'meeting-monitor-read',
            detail: 'recent active read of the monitored group returned messages',
          }
        : {
            kind: 'FAIL',
            name: 'meeting-monitor-read',
            detail:
              status.meetingMonitorProbeError ||
              'no successful active read of the monitored group in the last 10 minutes',
          }
    );
    if (config.sheets.enabled) {
      results.push(
        status.sheetsMonitorGroupId === config.sheets.monitorGroupId
          ? { kind: 'PASS', name: 'sheets-group', detail: 'המנהלים is bound to the configured stable group ID' }
          : { kind: 'FAIL', name: 'sheets-group', detail: 'Sheets monitor is not bound to the configured group ID' }
      );
    }
    results.push(
      status.runtimeErrorCount === 0
        ? { kind: 'PASS', name: 'runtime-errors', detail: 'no runtime errors since the current process started' }
        : {
            kind: 'FAIL',
            name: 'runtime-errors',
            detail: `${status.runtimeErrorCount} error(s); latest ${status.lastRuntimeErrorAt}: ${status.lastRuntimeError}`,
          }
    );
    return results;
  } catch (error) {
    return [{ kind: 'FAIL', name: 'whatsapp-heartbeat', detail: message(error) }];
  }
}

async function oauthClientAndToken(credentialsPath: string, tokenPath: string) {
  const credentials = await readOAuthClientCredentials(credentialsPath);
  const token = await readJson(tokenPath);
  const auth = new google.auth.OAuth2(credentials.clientId, credentials.clientSecret);
  auth.setCredentials(token);
  return auth;
}

async function checkCalendar(): Promise<CheckResult> {
  try {
    const auth = await oauthClientAndToken(
      config.calendar.credentialsPath,
      config.calendar.tokenPath
    );
    const calendar = google.calendar({ version: 'v3', auth });
    await calendar.events.list({
      calendarId: config.calendar.calendarId,
      maxResults: 1,
      singleEvents: true,
      timeMin: new Date().toISOString(),
    });
    return { kind: 'PASS', name: 'google-calendar', detail: 'OAuth token and Calendar API are reachable' };
  } catch (error) {
    return { kind: 'ACTION', name: 'google-calendar', detail: message(error) };
  }
}

async function checkSheets(): Promise<CheckResult> {
  if (!config.sheets.enabled) {
    return { kind: 'PASS', name: 'google-sheets', detail: 'Sheets workflow is disabled' };
  }
  try {
    const auth = await oauthClientAndToken(config.sheets.credentialsPath, config.sheets.tokenPath);
    const sheets = google.sheets({ version: 'v4', auth });
    const response = await sheets.spreadsheets.get({
      spreadsheetId: config.sheets.spreadsheetId,
      includeGridData: false,
      fields: 'spreadsheetId,properties.title,sheets.properties.title',
    });
    const tabExists = response.data.sheets?.some(
      (sheet) => sheet.properties?.title === config.sheets.sheetName
    );
    if (!tabExists) {
      return { kind: 'FAIL', name: 'google-sheets', detail: `tab “${config.sheets.sheetName}” is missing` };
    }
    return { kind: 'PASS', name: 'google-sheets', detail: 'OAuth token, spreadsheet, and target tab are reachable' };
  } catch (error) {
    return {
      kind: 'ACTION',
      name: 'google-sheets',
      detail: `${message(error)}; run npm run agent:sheets-auth`,
    };
  }
}

async function checkShortcut(): Promise<CheckResult> {
  if (!config.anyList.monitorEnabled) {
    return { kind: 'PASS', name: 'anylist-shortcut', detail: 'AnyList workflow is disabled' };
  }
  try {
    const { stdout } = await execFileAsync('/usr/bin/shortcuts', ['list']);
    const names = stdout.split(/\r?\n/).map((name) => name.trim());
    return names.includes(config.anyList.shortcutName)
      ? { kind: 'PASS', name: 'anylist-shortcut', detail: `“${config.anyList.shortcutName}” is installed` }
      : { kind: 'ACTION', name: 'anylist-shortcut', detail: `“${config.anyList.shortcutName}” is missing` };
  } catch (error) {
    return { kind: 'ACTION', name: 'anylist-shortcut', detail: message(error) };
  }
}

async function main(): Promise<void> {
  const results = [
    await checkLaunchAgent(),
    ...(await checkHeartbeat()),
    await checkCalendar(),
    await checkSheets(),
    await checkShortcut(),
    config.openaiApiKey
      ? { kind: 'PASS' as const, name: 'openai-key', detail: 'configured (not printed or sent)' }
      : { kind: 'ACTION' as const, name: 'openai-key', detail: 'OPENAI_API_KEY is missing' },
  ];
  for (const result of results) {
    process.stdout.write(`${result.kind} ${result.name}: ${result.detail}\n`);
  }
  if (results.some((result) => result.kind === 'FAIL')) process.exitCode = 1;
  else if (results.some((result) => result.kind === 'ACTION')) process.exitCode = 2;
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.stack : String(error)}\n`);
  process.exitCode = 1;
});
