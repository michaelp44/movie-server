import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { google } from 'googleapis';
import { z } from 'zod';
import type { AgentConfig } from './config.js';
import type { CalendarEventInput } from './types.js';

const oauthClientFileSchema = z.object({
  installed: z
    .object({
      client_id: z.string().min(1),
      client_secret: z.string().min(1),
    })
    .optional(),
  web: z
    .object({
      client_id: z.string().min(1),
      client_secret: z.string().min(1),
    })
    .optional(),
});

const tokenSchema = z
  .object({
    access_token: z.string().optional(),
    refresh_token: z.string().optional(),
    scope: z.string().optional(),
    token_type: z.string().optional(),
    expiry_date: z.number().optional(),
  })
  .passthrough();

export interface CalendarEventCreator {
  createEvent(event: CalendarEventInput): Promise<string>;
}

export interface OAuthClientCredentials {
  clientId: string;
  clientSecret: string;
}

export async function readOAuthClientCredentials(filePath: string): Promise<OAuthClientCredentials> {
  let raw: string;
  try {
    raw = await readFile(filePath, 'utf8');
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      throw new Error(
        `Google OAuth client file is missing at ${filePath}. Follow the Calendar setup in apps/whatsapp-agent/README.md.`
      );
    }
    throw error;
  }
  const parsed = oauthClientFileSchema.parse(JSON.parse(raw));
  const credentials = parsed.installed ?? parsed.web;
  if (!credentials) {
    throw new Error('Google OAuth client JSON must contain an installed or web client.');
  }
  return { clientId: credentials.client_id, clientSecret: credentials.client_secret };
}

export function calendarEventId(idempotencyKey: string): string {
  return createHash('sha256').update(`whatsapp-agent:${idempotencyKey}`).digest('hex').slice(0, 32);
}

export class GoogleCalendarService implements CalendarEventCreator {
  constructor(private readonly agentConfig: AgentConfig) {}

  async createEvent(event: CalendarEventInput): Promise<string> {
    if (event.attendeeEmail !== this.agentConfig.calendar.attendeeEmail) {
      throw new Error('Calendar attendee does not match the configured fixed attendee.');
    }

    const credentials = await readOAuthClientCredentials(
      this.agentConfig.calendar.credentialsPath
    );
    let tokenRaw: string;
    try {
      tokenRaw = await readFile(this.agentConfig.calendar.tokenPath, 'utf8');
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        throw new Error(
          'Google Calendar is not authorized yet. Run `npm run agent:calendar-auth` once, then approve this proposal again.'
        );
      }
      throw error;
    }
    const tokens = tokenSchema.parse(JSON.parse(tokenRaw));
    if (!tokens.refresh_token && !tokens.access_token) {
      throw new Error('The stored Google OAuth token is invalid; run Calendar authorization again.');
    }

    const auth = new google.auth.OAuth2(credentials.clientId, credentials.clientSecret);
    auth.setCredentials(tokens);
    const calendar = google.calendar({ version: 'v3', auth });
    const eventId = calendarEventId(event.idempotencyKey);
    let response;
    try {
      response = await calendar.events.insert({
        calendarId: this.agentConfig.calendar.calendarId,
        sendUpdates: 'all',
        requestBody: {
          id: eventId,
          summary: event.title,
          description: event.description,
          location: event.location || undefined,
          start: { dateTime: event.startTime, timeZone: event.timezone },
          end: { dateTime: event.endTime, timeZone: event.timezone },
          attendees: [{ email: event.attendeeEmail }],
        },
      });
    } catch (error) {
      const status = (error as { response?: { status?: number } }).response?.status;
      if (status !== 409) throw error;
      response = await calendar.events.get({
        calendarId: this.agentConfig.calendar.calendarId,
        eventId,
      });
    }

    const link = response.data.htmlLink;
    return link
      ? `Google Calendar event is ready: ${link}`
      : 'Google Calendar event is ready.';
  }
}
