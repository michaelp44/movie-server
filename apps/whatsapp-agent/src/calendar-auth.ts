import './env.js';
import { randomBytes, timingSafeEqual } from 'node:crypto';
import { createServer } from 'node:http';
import { chmod, mkdir, readFile, unlink, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { CodeChallengeMethod } from 'google-auth-library';
import { google } from 'googleapis';
import { config } from './config.js';
import { readOAuthClientCredentials } from './calendar-service.js';

const SCOPES = ['https://www.googleapis.com/auth/calendar.events.owned'];
const PENDING_AUTH_TTL_MS = 15 * 60 * 1000;

interface PendingAuthorization {
  codeVerifier: string;
  createdAt: string;
  redirectUri: string;
  state: string;
}

function pendingAuthorizationPath(): string {
  return `${config.calendar.tokenPath}.pending`;
}

function statesMatch(actual: string | null, expected: string): boolean {
  if (actual === null) return false;
  const actualBuffer = Buffer.from(actual);
  const expectedBuffer = Buffer.from(expected);
  return actualBuffer.length === expectedBuffer.length && timingSafeEqual(actualBuffer, expectedBuffer);
}

async function savePrivateJson(path: string, value: unknown): Promise<void> {
  await mkdir(dirname(path), { recursive: true, mode: 0o700 });
  await writeFile(path, JSON.stringify(value, null, 2), { mode: 0o600 });
  await chmod(path, 0o600);
}

async function completeAuthorization(callbackUrlValue: string): Promise<void> {
  const pendingPath = pendingAuthorizationPath();
  const pending = JSON.parse(await readFile(pendingPath, 'utf8')) as PendingAuthorization;
  const createdAt = Date.parse(pending.createdAt);
  if (!Number.isFinite(createdAt) || Date.now() - createdAt > PENDING_AUTH_TTL_MS) {
    throw new Error('The Google authorization request expired. Start a new one and try again.');
  }

  const callbackUrl = new URL(callbackUrlValue);
  const expectedUrl = new URL(pending.redirectUri);
  if (callbackUrl.origin !== expectedUrl.origin || callbackUrl.pathname !== expectedUrl.pathname) {
    throw new Error(`Expected a Google callback URL beginning with ${pending.redirectUri}`);
  }
  if (!statesMatch(callbackUrl.searchParams.get('state'), pending.state)) {
    throw new Error('Invalid OAuth state');
  }
  const code = callbackUrl.searchParams.get('code');
  if (!code) {
    throw new Error(`Google authorization failed: ${callbackUrl.searchParams.get('error') ?? 'missing code'}`);
  }

  const credentials = await readOAuthClientCredentials(config.calendar.credentialsPath);
  const oauth2Client = new google.auth.OAuth2(
    credentials.clientId,
    credentials.clientSecret,
    pending.redirectUri
  );
  const { tokens } = await oauth2Client.getToken({
    code,
    codeVerifier: pending.codeVerifier,
    redirect_uri: pending.redirectUri,
  });
  if (!tokens.refresh_token) {
    throw new Error('Google did not return a refresh token. Revoke the app grant and try again.');
  }
  await savePrivateJson(config.calendar.tokenPath, tokens);
  await unlink(pendingPath).catch(() => undefined);
  process.stdout.write(`Google Calendar token saved to ${config.calendar.tokenPath}\n`);
}

function callbackUrlArgument(): string | undefined {
  const equalsArgument = process.argv.find((argument) => argument.startsWith('--callback-url='));
  if (equalsArgument) return equalsArgument.slice('--callback-url='.length);
  const argumentIndex = process.argv.indexOf('--callback-url');
  if (argumentIndex >= 0) return process.argv[argumentIndex + 1];
  return process.argv.find((argument) => argument.startsWith('http://127.0.0.1:'));
}

async function main(): Promise<void> {
  const suppliedCallbackUrl = callbackUrlArgument();
  if (suppliedCallbackUrl) {
    await completeAuthorization(suppliedCallbackUrl);
    return;
  }

  const credentials = await readOAuthClientCredentials(config.calendar.credentialsPath);
  const redirectUri = `http://127.0.0.1:${config.calendar.oauthPort}/oauth2callback`;
  const oauth2Client = new google.auth.OAuth2(
    credentials.clientId,
    credentials.clientSecret,
    redirectUri
  );
  const { codeVerifier, codeChallenge } = await oauth2Client.generateCodeVerifierAsync();
  const state = randomBytes(24).toString('hex');
  const authorizationUrl = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    include_granted_scopes: true,
    scope: SCOPES,
    state,
    code_challenge_method: CodeChallengeMethod.S256,
    code_challenge: codeChallenge,
  });
  await savePrivateJson(pendingAuthorizationPath(), {
    codeVerifier,
    createdAt: new Date().toISOString(),
    redirectUri,
    state,
  } satisfies PendingAuthorization);

  const server = createServer(async (request, response) => {
    try {
      const url = new URL(request.url ?? '/', redirectUri);
      if (url.pathname !== '/oauth2callback') {
        response.writeHead(404).end('Not found');
        return;
      }
      await completeAuthorization(url.toString());
      response.writeHead(200, { 'content-type': 'text/plain; charset=utf-8' });
      response.end('Google Calendar authorization completed. You can close this tab.');
      server.close();
    } catch (error) {
      response.writeHead(500).end('Authorization failed. Check the terminal for details.');
      process.stderr.write(`${error instanceof Error ? error.stack : String(error)}\n`);
    }
  });

  server.listen(config.calendar.oauthPort, '127.0.0.1', () => {
    process.stdout.write(
      [
        `Listening for Google OAuth on ${redirectUri}`,
        '',
        'Open this URL in a browser on the same computer:',
        authorizationUrl,
        '',
        `For remote setup, forward the port first: ssh -L ${config.calendar.oauthPort}:127.0.0.1:${config.calendar.oauthPort} <user>@<mac-mini-host>`,
        'Without an SSH tunnel, approve on the remote device, copy the complete failed localhost URL from its address bar,',
        `then run: npm run agent:calendar-auth -- --callback-url '<complete-localhost-url>'`,
      ].join('\n') + '\n'
    );
  });
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.stack : String(error)}\n`);
  process.exitCode = 1;
});
