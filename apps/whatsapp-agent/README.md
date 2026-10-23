# Local WhatsApp Agent

This app turns the WhatsApp **Message Yourself** chat into a private command channel for a local agent. It is deliberately narrow:

- Only messages you send to your own chat with the configured prefix are commands.
- Other chats are readable only when their phone number or chat ID is in `WHATSAPP_READ_ALLOWLIST`.
- Contact messages are treated as untrusted content, never as agent instructions.
- File access stays inside `WHATSAPP_AGENT_WORKSPACE_ROOT`; environment files, credentials, keys, Git internals, dependencies, and WhatsApp session state are blocked.
- Notes and configured local commands require a one-time approval code and expire after 15 minutes.
- OpenAI requests use the Responses API with `store: false`. Allowlisted message text is sent to OpenAI only when your command asks the model to read it.

## Important WhatsApp limitation

The personal-account transport uses `whatsapp-web.js`, which drives WhatsApp Web through a local Chromium browser. It is unofficial, can stop working after WhatsApp changes, and can put the linked account at risk. The app therefore refuses to start WhatsApp mode until you set the explicit risk acknowledgement.

For dependable or business use, prefer Meta's official WhatsApp Cloud API with a separate WhatsApp Business number. That route receives new messages through a public HTTPS webhook; it does not provide your ordinary personal inbox or existing chat history.

## 1. Configure and test in the terminal

Dependencies are installed from the repository root:

```bash
npm install
```

Create the agent-specific environment file without changing the movie server's existing `.env`:

```bash
cp apps/whatsapp-agent/.env.example apps/whatsapp-agent/.env
```

Edit `apps/whatsapp-agent/.env` and set at least:

```env
AGENT_TRANSPORT=console
OPENAI_API_KEY=your_openai_api_key
```

Then start the terminal transport:

```bash
npm run agent:dev
```

Try `help`, `what time is it?`, or `write a note titled Test that says hello`. Writing the note should return an approval command instead of writing immediately.

## 2. Link WhatsApp

Use a dedicated WhatsApp account/number if possible. In `apps/whatsapp-agent/.env`, set:

```env
AGENT_TRANSPORT=whatsapp
WHATSAPP_UNOFFICIAL_WEB_AUTOMATION_ACK=I_ACCEPT_THE_RISK
```

For the dedicated wedding Business account, set `WHATSAPP_WEDDING_ONLY=true`. In this mode the
process keeps only the authenticated localhost wedding send endpoint active. It does not inspect
messages or reactions, resolve monitored groups, accept owner commands, or run the personal
Calendar/Sheets chat workflows. Use a separate `WHATSAPP_SESSION_DIR` for this process so the
Business and personal WhatsApp sessions never overwrite one another.

Start the agent:

```bash
npm run agent:dev
```

A QR code appears in the terminal. On the phone, open **WhatsApp → Settings → Linked devices → Link a device** and scan it. The browser session remains under `data/whatsapp-agent/` and is excluded from Git.

In WhatsApp, open **Message Yourself** and send:

```text
!agent help
```

The prefix is configurable with `WHATSAPP_AGENT_PREFIX`.

## 3. Monitor one group for meeting proposals

Set the exact group display name for first-time resolution:

```env
WHATSAPP_MONITOR_GROUP_NAME=מאמי
WHATSAPP_MONITOR_GROUP_ID=
GOOGLE_CALENDAR_ATTENDEE=shoval18995@gmail.com
```

On startup, the agent resolves exactly one matching group and reports its stable ID in the terminal and Message Yourself. Put that ID in `WHATSAPP_MONITOR_GROUP_ID` and restart; the stable ID is the security boundary even if a group is later renamed.

New text and images in that group are briefly batched and treated as untrusted quoted data. The meeting detector runs only when the current message batch explicitly asks to arrange a meeting, or supplies concrete scheduling details in response to a recent assistant clarification. Old meeting requests, ordinary chat, and standalone images cannot trigger a group clarification. JPEG, PNG, and WebP images can provide visible scheduling details from screenshots or invitations only when accompanied by explicit scheduling intent. By default, only the three newest images are included and each decoded image is limited to 5 MB. Media is held in memory for the request and is not written to disk; OpenAI requests also use `store: false`. Images count as input tokens, so they can increase API cost. Configure the limits with `WHATSAPP_MONITOR_IMAGE_LIMIT` and `WHATSAPP_MONITOR_MAX_IMAGE_MB`.

A strict structured extractor proposes an event only when it finds genuine scheduling intent and the required details: title/purpose, date, and start time. When duration/end time is omitted, the configured default duration (60 minutes by default) is used automatically. If another required detail is missing, the agent sends one fixed-format question into the monitored group asking for all missing fields. Location is optional: it is included when supplied and otherwise left empty. Identical clarification questions are suppressed for 12 hours, and the agent never sends free-form model output into the group.

Once the details are complete, the default mode sends the proposal privately to Message Yourself and waits for a 👍🏼 reaction or an `approve` reply before creating an external event. Set `GOOGLE_CALENDAR_AUTO_CREATE=true` to create complete detected meetings immediately without an approval step; the agent sends a private confirmation after creation and never sends free-form model output into the monitored group. Calendar event IDs are deterministic and duplicate proposals are suppressed for 30 days. If automatic creation fails, the fingerprint is released so the request can be retried safely.

### Add items to AnyList through a synced Siri Shortcut

AnyList does not expose a supported free desktop integration. The agent can instead detect explicit shopping-list intent in the monitored group and run a Siri Shortcut that is synced to the Mac. Accepted items are added without WhatsApp deep links, and the agent sends one compact private confirmation for the whole batch.

Create or sync an AnyList Siri Shortcut that accepts text input, then configure its exact name:

```env
ANYLIST_MONITOR_ENABLED=true
ANYLIST_SHORTCUT_NAME=Add to קניות בסופר
```

The current trigger message must explicitly ask to buy or add items; old shopping messages and standalone images cannot retrigger additions. A supported image can supply visible products only when its caption contains explicit intent such as `תוסיף את זה לרשימה`. The extractor accepts only concrete purchasable products, discards vague phrases, and keeps the more specific form when it finds both a generic and qualified version of the same item. Each source message is processed at most once. The synced Shortcut must accept text as Shortcut Input and finish without asking for interactive input.

### Update a fixed Google Sheet from a managers group

The Sheets workflow is separate from the general agent and is intentionally restricted to one group, one spreadsheet, and one tab. Configure stable IDs after resolving them:

```env
GOOGLE_SHEETS_UPDATE_MONITOR_ENABLED=true
GOOGLE_SHEETS_UPDATE_GROUP_NAME=המנהלים
GOOGLE_SHEETS_UPDATE_GROUP_ID=120363000000000000@g.us
GOOGLE_SHEETS_SPREADSHEET_ID=your_spreadsheet_id
GOOGLE_SHEETS_SHEET_NAME=קניות
```

Any group member can trigger it only with a message that begins exactly with `עדכון:`. The bot replies `עובד על זה`, interprets the rest as a request to edit the fixed shopping list, reads the latest rows, applies a bounded batch of cell/row changes, rereads the sheet to verify the result, and replies `סיימתי` with one direct Google Sheet link only after verification. Ambiguous requests receive one short clarification instead. Unrelated requests, whole-sheet deletion, attempts to select another file, stale row references, duplicate products, and unknown categories are rejected. New rows inherit formatting and checkbox validation, and each WhatsApp source message is processed at most once.

Enable the Google Sheets API in the same Google Cloud project used for Calendar, then authorize the separate Sheets token:

```bash
npm run agent:sheets-auth
```

The callback listens on `127.0.0.1:42814`. For remote authorization, approve the printed URL on the phone, copy the complete failed `http://127.0.0.1:42814/oauth2callback?...` URL from the address bar, and run:

```bash
npm run agent:sheets-auth -- --callback-url '<complete-localhost-url>'
```

The Sheets token is saved with owner-only permissions at `data/whatsapp-agent/google-sheets-oauth-token.json`. The workflow requests spreadsheet access but its code still enforces the configured spreadsheet and tab as its write boundary.

### Authorize Google Calendar once

1. In Google Cloud, enable the Google Calendar API, configure the OAuth consent screen, add your Google account as a test user if the app is External, then create an OAuth client of type **Desktop app**.
2. Download the client JSON to `data/whatsapp-agent/google-oauth-client.json` (the directory is ignored by Git).
3. Run `npm run agent:calendar-auth` and open the printed Google authorization URL.

The callback listens only on `127.0.0.1:42813`. When working remotely, either create an SSH tunnel from the computer where you will open the URL:

```bash
ssh -L 42813:127.0.0.1:42813 <user>@<mac-mini-host>
```

Keep that tunnel open, run `npm run agent:calendar-auth` on the Mac mini in a second SSH session, and open the printed URL on your computer. The refresh token is stored with owner-only permissions at `data/whatsapp-agent/google-oauth-token.json`. Calendar creation uses the narrower `calendar.events.owned` scope and sends the configured guest an update email.

For authorization from a phone without an SSH tunnel, run `npm run agent:calendar-auth` and open its URL on the phone. After approval, the phone cannot reach the Mac mini's loopback callback and may show a connection error. Copy the complete `http://127.0.0.1:42813/oauth2callback?...` URL from the phone's address bar and complete the one-time exchange on the Mac mini:

```bash
npm run agent:calendar-auth -- --callback-url '<complete-localhost-url>'
```

The pending PKCE verifier is stored with owner-only permissions for 15 minutes and is removed after a successful exchange.

## 4. Allow the agent to read selected chats

No non-owner chat is readable by default. Add exact international phone numbers (digits only) or group chat IDs:

```env
WHATSAPP_READ_ALLOWLIST=972501234567,120363000000000000@g.us
WHATSAPP_RECENT_MESSAGE_LIMIT=20
```

Restart, then ask in Message Yourself:

```text
!agent summarize the 20 most recent allowlisted messages and list anything I need to answer
```

The tool fetches recent messages without treating them as commands. To find a group ID, send `!agent chats`; this lists chat names and stable IDs locally without calling OpenAI. Do not use display names as security identifiers.

## 5. Add tasks

An initial `apps/whatsapp-agent/tasks.json` is included with a Movie Server health check. Each task is an exact executable plus arguments—there is no shell interpolation:

```json
{
  "movie-server-health": {
    "description": "Check whether the local Movie Server API is healthy",
    "command": [
      "/usr/bin/curl",
      "--fail",
      "--silent",
      "http://127.0.0.1:3001/health"
    ]
  }
}
```

Restart the agent after editing the file. Every named task requires a WhatsApp approval such as:

```text
!agent approve A1B2C3D4
```

Keep task definitions narrow. Put fixed values in the task file instead of accepting arbitrary command text from WhatsApp.

## 6. Run at login on this Mac mini

First build and create the log directory:

```bash
npm run build -w @movie-server/whatsapp-agent
mkdir -p logs
```

The included `config/com.movieserver.whatsapp-agent.plist` is configured for this repository and Node installation. Install it only after QR login works:

```bash
cp config/com.movieserver.whatsapp-agent.plist ~/Library/LaunchAgents/
launchctl bootstrap gui/$(id -u) ~/Library/LaunchAgents/com.movieserver.whatsapp-agent.plist
```

Inspect logs at `logs/whatsapp-agent.log` and `logs/whatsapp-agent-error.log`. After changing code or configuration, restart it with:

```bash
launchctl bootout gui/$(id -u) ~/Library/LaunchAgents/com.movieserver.whatsapp-agent.plist
launchctl bootstrap gui/$(id -u) ~/Library/LaunchAgents/com.movieserver.whatsapp-agent.plist
```

## 7. Weekly health check and guarded repair

`com.movieserver.whatsapp-agent.weekly-maintenance` runs every Sunday at 09:00. It runs all agent tests and the TypeScript build, verifies a fresh WhatsApp `CONNECTED` heartbeat and both stable group bindings, probes Google Calendar and Google Sheets without changing their contents, checks the AnyList Shortcut, and confirms the OpenAI key is configured without printing it.

If only the process is unhealthy, the wrapper performs a deterministic restart and checks again. If a reproducible code failure remains, a scoped non-interactive Codex run may make a minimal repair inside the WhatsApp agent, must add regression coverage, and is followed by another build, restart, and full check. The maintenance prompt forbids WhatsApp sends, Calendar/Sheets mutations, Shortcut execution, secret changes, destructive Git operations, and edits outside the agent scope. OAuth, QR linking, and other account-consent failures are never bypassed.

Healthy runs are silent. When a failure is fixed or needs user action, a bounded report is queued locally and delivered to Message Yourself once WhatsApp is connected. Detailed local reports are stored in `data/whatsapp-agent/weekly-health/`.

Run the same preflight manually with:

```bash
npm run agent:health
```

## Validation

```bash
npm run agent:test
npm run build -w @movie-server/whatsapp-agent
npm audit --omit=dev --workspace @movie-server/whatsapp-agent
```
