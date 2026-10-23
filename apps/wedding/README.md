# Shoval & Michael Wedding Website

A production-oriented, mobile-first Hebrew wedding website for Shoval and Michael's wedding on December 10, 2026. The guest experience is personalized without guest accounts: an invitation is identified server-side by phone number and remembered in a signed, HttpOnly cookie.

The application is intentionally isolated from the existing movie-server applications. Deploy `apps/wedding` as its own Vercel project and attach only `wedding.my-rem.com` to that project.

## Product surface

- Personalized guest landing page and secure phone identification
- Live wedding countdown and post-wedding thank-you state
- Seating assignment controlled by a runtime publication flag
- Venue, parking, Waze, Google Maps, menu, schedule, story, FAQ, weather placeholder, and calendar export
- Private photo/video uploads with previews and progress
- Moderated gallery, guestbook, and song requests
- Configurable Bit link and optional bank-transfer details
- Protected Hebrew admin dashboard for guests, tables, sync, media, messages, songs, settings, and QR codes
- Google Sheets preview/apply synchronization with conflict reporting and non-destructive missing-row handling

## Architecture

```text
Google Sheets (source of truth)
          |
          | read-only service account, explicit admin sync
          v
Supabase PostgreSQL/Storage <---- Next.js server-only data layer
          |                              |
          |                              +-- signed HttpOnly guest session
          |                              +-- Supabase Auth admin session
          |                              +-- automatic Mac failover
          v                              v
Private cloud media          Mac SQLite/private media mirror
                                      |
                                      +-- Cloudflare Tunnel (signed requests only)
                                      +-- external-drive snapshots
```

The browser never receives the invitation list, service-role key, Google credentials, or raw phone lookup data. Guest lookup, synchronization, signed upload creation, and moderation use server-only code. Public and authenticated Supabase roles have no direct table grants; the service role is used only after application-level authorization.

Important locations:

- `lib/wedding-config.ts`: editable public wedding content
- `lib/guest-data/`: private invitation lookup and safe guest DTO mapping
- `lib/guest-session/`: signed guest-cookie implementation
- `lib/google-sheets/`: header-based Google Sheets adapter
- `lib/sync/`: preview, planning, conflict detection, and apply logic
- `lib/upload/validation.ts`: upload policy
- `supabase/migrations/`: database, RLS, function, and Storage setup
- `supabase/seed.sql`: demo-only data for 20 invitations

## Local development

Requirements: Node.js 22.x and npm.

```bash
cd apps/wedding
cp .env.example .env.local
npm install --workspaces=false
npm run dev
```

Open `http://localhost:3000`.

For a guest UI preview without Supabase, set `WEDDING_DEMO_MODE=true` and provide a local `GUEST_SESSION_SECRET` of at least 32 bytes. Use `0501234567` as the demo phone. Demo mode is hard-disabled when `NODE_ENV=production`. Submissions can use the Mac fallback when its two environment variables are configured.

Generate local secrets with, for example:

```bash
openssl rand -base64 48
```

## Environment variables

| Variable | Visibility | Required | Purpose |
| --- | --- | --- | --- |
| `NEXT_PUBLIC_SITE_URL` | Public | Yes | Canonical site origin; production value is `https://wedding.my-rem.com` |
| `WEDDING_FALLBACK_URL` | Server only | Recommended | Signed Mac fallback origin; production value is `https://wedding-origin.my-rem.com` |
| `WEDDING_FALLBACK_SECRET` | Server only | Recommended | Shared HMAC secret for server-to-server fallback calls, minimum 32 bytes |
| `NEXT_PUBLIC_SUPABASE_URL` | Public | Yes | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Public | Yes | Supabase anonymous key, used for admin Auth session exchange only |
| `SUPABASE_SERVICE_ROLE_KEY` | Server only | Yes | Server data access; never prefix with `NEXT_PUBLIC_` |
| `GUEST_SESSION_SECRET` | Server only | Yes | HMAC key for guest invitation cookies, minimum 32 bytes |
| `RATE_LIMIT_HASH_SECRET` | Server only | Optional | Separate HMAC key for rate-limit identifiers; falls back to the guest-session secret |
| `GOOGLE_SHEET_ID` | Server only | For sync | Master wedding spreadsheet ID |
| `GOOGLE_SHEET_TAB_NAMES` | Server only | For sync | Comma-separated guest tabs |
| `GOOGLE_SHEET_SEATING_TAB_NAME` | Server only | Optional | A separate invitation-level seating tab, only if one is introduced later |
| `GOOGLE_SERVICE_ACCOUNT_EMAIL` | Server only | For sync | Dedicated Google service-account email |
| `GOOGLE_PRIVATE_KEY` | Server only | For sync | Service-account private key; escaped `\n` values are supported |
| `GOOGLE_SHEET_HEADER_ALIASES` | Server only | Optional | JSON aliases or exact column overrides for unusual headers |
| `ADMIN_EMAILS` | Server only | Recommended | Comma-separated Supabase Auth email allowlist |
| `NEXT_PUBLIC_BIT_URL` | Public | Optional | Bit payment URL shown in the gift section |
| `WEDDING_DEMO_MODE` | Server only | Local only | Enables the small in-memory guest fixture outside production |
| `OPENAI_API_KEY` | Server only | For automatic moderation | OpenAI project key; never expose it to the browser |
| `OPENAI_MODERATION_MODEL` | Server only | Optional | Vision-capable model used by the wedding policy; defaults to `gpt-5-mini` |
| `OPENAI_IMAGE_MODEL` | Server only | Optional | Image-edit model for occasional Live Wall illustrations; defaults to `gpt-image-2.5-flare` |
| `WEDDING_BACKUP_DRIVE` | Local only | For backups | Mounted external volume; defaults to `/Volumes/My Passport` |

Do not commit `.env.local`. Vercel secrets must be added in Project Settings > Environment Variables.

When Supabase is absent or temporarily unavailable, uploads, blessings, song requests, reactions, likes, the gallery, and the Live Wall automatically use the persistent Mac fallback. Guest/admin login remains dependent on Supabase for now and is deliberately deferred; anonymous sharing still works. The fallback is never an in-memory store and does not expose its SQLite database or media listing publicly.

## Central wedding configuration

All editable public content is centralized in `lib/wedding-config.ts`, including:

- couple names, date, timezone, and site URL
- venue, address, parking, and navigation links
- timeline, menu, story, FAQ, and weather behavior
- Bit URL and optional bank details
- guest navigation and calendar details

Unfinished content has an explicit `isPlaceholder` flag and visible placeholder copy. Do not remove a flag until the corresponding content is final.

The runtime-only publication flags `seating_published` and `gallery_published` live in `site_settings` so an admin can change them without redeploying.

## Supabase setup

1. Create a dedicated Supabase project for the wedding site.
2. Add the project URL, anonymous key, and service-role key to `.env.local` and Vercel.
3. Apply all SQL files in `supabase/migrations/` in filename order using the Supabase CLI or SQL editor.
4. Do not run the demo seed in production. For a disposable local/staging project only, apply `supabase/seed.sql`.
5. Confirm that the `wedding-media` bucket exists and is private.

With the Supabase CLI linked to the wedding project:

```bash
supabase db push
```

The migration creates:

- `wedding_tables`: table number/name, capacity, notes, and sort order
- `invitations`: household-level identity, optional normalized phone, RSVP, seating, source metadata, and random secure token
- `guests`: optional individual people related to an invitation
- `photo_uploads`: private Storage metadata and moderation state
- `guestbook_messages`: private messages and moderation state
- `song_requests`: guest song requests with per-invitation duplicate protection; unidentified submissions are deduplicated by display name, song, and artist
- `site_settings`: seating and gallery publication flags
- `sync_runs` and `sync_run_items`: preview/apply audit history and row-level outcomes
- `rate_limits`: fixed-window rate-limit counters
- `live_wall_reactions`: short-lived, rate-limited emoji reactions for the venue screen
- `photo_likes`: one anonymous, reversible like per browser/device for each approved gallery photo

All application tables have Row Level Security enabled. No anonymous or normal authenticated role can query invitation/guest data directly. The migration also revokes direct table privileges and grants server access to `service_role` only. Admin authorization is checked with Supabase Auth before the server uses the service role.

Song-request uniqueness is enforced both before insertion and by database indexes, so two matching submissions arriving at the same time cannot create an accidental duplicate.

### Storage

The migration creates the private `wedding-media` bucket with a 50MB per-file limit and an allowlist for JPEG, PNG, WebP, HEIC/HEIF, MP4, QuickTime, and WebM. There are deliberately no unrestricted anonymous Storage policies.

The upload flow is:

1. The browser sends file name, MIME type, and size metadata to `/api/uploads/prepare`.
2. The server validates the batch, generates a UUID filename with a trusted extension, records pending metadata, and returns a short-lived signed upload URL.
3. The browser uploads directly to Storage and calls `/api/uploads/complete` with a one-time completion token.
4. The server verifies the stored object and runs image/text moderation. Safe content is approved, uncertain content waits for review, and blocked content stays private.

## Live Wedding Wall

- Guest sharing: `/share`
- Fullscreen venue display: `/live`
- Mobile admin moderation and emergency controls: `/admin/live-wall`

The display polls a small server feed every five seconds, rotates approved photos and blessings without repeatedly loading the full collection, retries automatically after network loss, and requests a browser screen wake lock when available. Storage remains private; the feed contains only short-lived signed URLs and never exposes phone numbers. If moderation is unavailable or uncertain, content becomes `NEEDS_REVIEW` and is never published automatically.

For local presentation testing, set `WEDDING_DEMO_MODE=true`; `/live` then shows clearly separated demo content without writing production data.

### Automatic Mac fallback

The venue-critical guest interactions are dual-written to Supabase and the Mac whenever both are healthy. Supabase calls use a short timeout; if they fail, the same request is written to the Mac over an HMAC-signed private API. Live Wall and gallery reads merge both sources by stable submission ID, so content created during a Supabase outage remains visible after recovery instead of disappearing.

The Live Wall rotates between a cinematic collage, a full-screen premiere for newly approved content, large blessing typography, a multi-photo mosaic, and occasional original-versus-illustration reveals. Illustration generation is controlled by `live_wall_ai_art`, samples roughly one in five approved images, runs outside the guest upload response, stores the result privately, and moderates the generated result before display. Failed generation never replaces or hides the original upload.

The Mac service listens only on `127.0.0.1:8789`. Cloudflare Tunnel exposes only `wedding-origin.my-rem.com`; all `/v1/*` requests require a timestamped signature, uploads require a one-time token, and media URLs are signed and expiring. The service runs as the `com.shoval-michael.wedding-fallback` LaunchAgent and restarts automatically. Its active data is under `~/Library/Application Support/ShovalMichaelWedding` to avoid SQLite locking problems on removable disks.

The fallback covers guest uploads, AI moderation results, blessings, songs, likes, reactions, gallery reads, wall reads, and wall publication/emergency controls. The Mac extracts a trusted representative image from short videos before AI review; if extraction or moderation fails, the video remains unpublished for review. If both Supabase and the Mac/home internet are unavailable at the same time, new dynamic actions fail safely with a Hebrew retry message; already-loaded wall content continues its current browser rotation.

## External-drive backups

The fallback database uses the internal SSD while live, then produces a consistent SQLite snapshot and media mirror at `/Volumes/My Passport/Wedding-Shoval-Michael/fallback-backup`. This avoids running SQLite directly on a removable volume while still keeping a complete readable copy on the external drive. The first snapshot has been verified. A five-minute LaunchAgent is prepared, but macOS must grant `/opt/homebrew/bin/node` access to removable volumes before it is loaded; otherwise background copies are blocked even though an interactive backup succeeds. The backup never interrupts the live service and uses an atomic SQLite snapshot before copying.

The separate Supabase export remains available after Supabase is connected:

```bash
npm run backup:external
```

The command requires the local Supabase variables. It creates readable JSON files for database tables and ordinary image/video files for media. The external drive itself is intentionally not encrypted, so anyone with physical access to it can read the backup.

## Guest identification and sessions

Phone numbers are stored in E.164 format, such as `+972501234567` or `+393339310560`. Israeli local formats (for example `050-123-4567`, `972501234567`) normalize to `+972501234567`; international numbers must include a country code (`+` or `00`, or a bare 11–15 digit international number if a Google Sheets formula has stripped the plus sign).

Lookup happens only on the server. A successful match creates a signed session containing only the invitation UUID, issue/expiry times, and a random nonce. The cookie is HttpOnly, SameSite=Lax, Secure in production, and expires after 180 days. It contains no name or phone number. “זה לא אני” clears it.

Personalized URLs use `/g/<secure-token>`. Tokens are random and never contain a phone number or guest name. The route immediately exchanges a valid token for the same guest session and redirects to `/`, removing the token from the visible URL. WhatsApp RSVP links use `/g/<secure-token>?next=rsvp`, so opening the invitation identifies the household for 180 days before continuing to its RSVP form.

## Google Sheets integration

The inspected source workbook is the current, recently updated sheet titled **אקסל החתונה הגדול**. It has two guest-source tabs:

- `מוזמנים - מיכאל`
- `מוזמנים - שובל`

Set:

```dotenv
GOOGLE_SHEET_TAB_NAMES=מוזמנים - מיכאל,מוזמנים - שובל
```

The adapter automatically finds the header row (currently row 4) and does not depend on fixed column positions. The current mapping is:

| Google Sheet column | Database field |
| --- | --- |
| `שם ההזמנה / משפחה` | `invitations.display_name` |
| `כמות פוטנציאלית` | `invitations.number_invited` |
| `קבוצה` | `invitations.guest_group` |
| `אישור הגעה` | `invitations.rsvp_status` |
| `מגיעים בפועל` | `invitations.number_confirmed` |
| `טלפון` | `primary_phone` plus canonical `normalized_phone` |
| `שולחן` | `invitations.table_number` |

The RSVP values `ממתין`, `מגיע`, and `לא מגיע` map to `pending`, `confirmed`, and `declined`.

The workbook's `שולחנות` tab is currently a capacity/summary sheet; invitation assignments already live in both guest tabs, so do not configure it as a separate seating tab. Capacities may be entered in the admin table screen.

Table numbers are canonical integers from 1 through 999. A table can also have a separate display name in admin. Invalid or contradictory source assignments are reported for review and never turned into broken table QR links.

The sheet intentionally permits invitations to be added before a phone is known. The database and adapter preserve those rows with a nullable phone; they appear in admin totals but cannot identify on the public site until a valid phone is added.

The current sheet does not expose an immutable source ID. Until one is added, the adapter falls back to a normalized invitation name within each source tab, which also keeps an invitation stable when its phone is filled in later. Duplicate names are reported as conflicts instead of being merged. For more resilient long-term sync, add a unique, never-changing `מזהה שורה` (or `source_row_id`) column to both guest tabs; the adapter already recognizes it.

### Google authentication

Create a dedicated Google Cloud service account with Google Sheets API enabled. Share only the master workbook with its service-account email as Viewer. Read-only scope is sufficient. Store the email/private key only as server environment variables; do not reuse desktop OAuth tokens or expose credentials to the browser.

### Synchronization behavior

Open `/admin/sync` and choose **הכנת תצוגה מקדימה**. The preview:

1. reads both source tabs
2. detects/maps the headers
3. normalizes phone, counts, RSVP, and table values
4. matches by source ID first and normalized phone second
5. displays additions, updates, unchanged rows, conflicts, mapping errors, and source-missing records

After review, choose **סנכרן אורחים מ-Google Sheets**. Apply recalculates the plan from a fresh read, upserts additions/changes, creates referenced table numbers if needed, and logs row-level results. Records that disappeared from Sheets are only marked `missing_from_source`; they are never deleted automatically.

Direct admin edits to sheet-managed invitation fields may be overwritten by the next synchronization. Make durable guest-list changes in Google Sheets.

RSVP answers collected through the website or entered by an admin are the exception: their status/count and source timestamp are preserved by later guest-list synchronization. Every response is also appended to `rsvp_responses` for audit/history.

The server-side write-back adapter updates only the existing RSVP and confirmed-count cells on the matched source row. It restricts writes to configured guest tabs and refuses ambiguous rows or missing columns. Keep `GOOGLE_SHEETS_WRITEBACK_ENABLED=false` while the service account is Viewer. After granting Editor access, use the non-mutating check in `/admin/sync`, test one known row, and only then set the flag to `true`. Write-back runs after the website response is saved, so a temporary Google failure never loses or delays the guest's RSVP.

## RSVP and supervised WhatsApp invitations

- Personalized response URL: `/rsvp/<secure-token>`
- Identified-guest shortcut: `/rsvp`
- Admin dashboard: `/admin/rsvp`
- Automatic campaign queue: `/admin/rsvp/campaigns`
- CSV export: `/api/admin/rsvp.csv`

The admin can preview and send one personalized message per explicit click, or deliberately create a campaign after a second confirmation step. Campaigns can filter by RSVP status and by the invitation's `guest_group` (for example, a family, work group, or one side of the wedding). The chosen group is saved on the campaign. A campaign snapshots only contactable invitations, excludes recipients who already received that message kind, and sends one queued recipient at a time with a randomized 55–110 second delay. The worker rechecks current RSVP/group membership before sending, so a guest who changes status or category while queued is skipped. Campaigns can be paused, resumed, or cancelled from a phone. The server creates a pending `message_deliveries` record and marks it sent only after the localhost WhatsApp agent returns a provider message ID. Failure leaves an auditable failed delivery and never pretends the guest was contacted.

The local chain is:

`Vercel server action -> signed wedding fallback -> 127.0.0.1:8790 -> linked WhatsApp Web client`

There is intentionally no unrestricted bulk-send endpoint. The Mac worker polls the protected single-step campaign route, which releases at most one due recipient; the localhost bridge still accepts only one canonical Israeli recipient, a bounded message, a unique operation ID, and the shared fallback secret. Repeated operation IDs are idempotent. This transport is unofficial and may stop working or cause account restrictions; the website data model can later add the official Cloud API without changing the guest-facing RSVP flow.

### Official WhatsApp Cloud API preparation

`lib/rsvp/whatsapp-cloud.ts` contains a server-side Cloud API template sender, a raw-body `X-Hub-Signature-256` verifier, and a parser for correlated RSVP quick replies (`rsvp_confirmed`, `rsvp_declined`, `rsvp_unsure`). It is tested but **not connected to live sends or RSVP writes yet**. Existing WhatsApp Web sends remain unchanged until the Meta account, business number, approved Hebrew template, billing, and webhook are ready and a test message succeeds. Do not put a temporary Meta token into production or send credentials through chat.

The future Cloud API setup needs `WHATSAPP_CLOUD_ACCESS_TOKEN` (long-lived token with messaging permission), `WHATSAPP_CLOUD_PHONE_NUMBER_ID`, `WHATSAPP_CLOUD_API_VERSION`, `WHATSAPP_CLOUD_APP_SECRET`, and `WHATSAPP_CLOUD_WEBHOOK_VERIFY_TOKEN`. Store them only in Vercel's server-side environment. The intended invitation template has Hebrew body parameters and three quick-reply buttons in this exact order: arriving, not arriving, unsure. Template names and parameter order must be confirmed against the approved Meta template before enabling sends. The webhook must match a reply to the outbound provider message ID and sender, process it idempotently, and update `rsvp_responses` and `invitations`; this final wiring remains pending.

Apply `supabase/migrations/202609230001_rsvp_communications.sql`, `202609230002_rsvp_permissions.sql`, and `202609240001_whatsapp_campaigns.sql` before deploying these routes. The campaign worker uses `WEDDING_CAMPAIGN_WORKER_SECRET`, falling back to the existing shared fallback secret, and calls `/api/internal/campaigns/process`. After rebuilding the WhatsApp agent, restart both `com.movieserver.whatsapp-agent` and `com.shoval-michael.wedding-fallback`.

The expanded RSVP form also needs `supabase/migrations/202610100001_rsvp_details.sql` before deployment. It stores adult/child counts, transport interest, dietary selections, and allergy notes as structured `rsvp_details` on the invitation, with a snapshot in each website RSVP response. These fields are not managed by the Google Sheet sync; admins can see them under each invitation in `/admin/rsvp`.

Invitation activity uses `supabase/migrations/202610150001_invitation_activity.sql`. It records personalized-link opens, RSVP page views, button/field interactions, and successful or failed RSVP submissions. Admins can review recent events at `/admin/rsvp/activity`, including a per-invitation filter from `/admin/rsvp`. The same records are mirrored over the signed Mac fallback connection into `~/Library/Application Support/ShovalMichaelWedding/wedding-fallback.sqlite`; when the external wedding drive is mounted, the existing five-minute backup job copies that database to `/Volumes/My Passport/Wedding-Shoval-Michael/fallback-backup/wedding-fallback.sqlite`. The admin activity page merges Supabase with the Mac copy and reports the availability of both sources. Only the invitation ID, display name, action name, timestamp, and limited RSVP outcome metadata are stored; link tokens, phone numbers, and free-text answers are not copied into this log. This activity log supplements the existing `rsvp_responses` answer history.

## Admin access

Production URL: `https://wedding.my-rem.com/admin`

1. In Supabase Dashboard, open Authentication > Users and create an email/password user.
2. Add that exact email to the Vercel `ADMIN_EMAILS` value. Multiple addresses are comma-separated.
3. Redeploy after changing Vercel environment variables.
4. Sign in at `/admin/login`.

Alternatively, a trusted user with `app_metadata.role` set to `admin` or `wedding_admin` is accepted. Do not use editable user metadata for roles.

To publish table assignments, open Admin > Settings and enable **סידורי הושבה**. Turning it off hides all table numbers again. To publish approved media, enable **גלריה**.

To moderate media, open Admin > Photos. Preview links expire automatically. Approve publishes an item only when gallery publication is also enabled; reject keeps it private; delete removes both the Storage object and its database row after confirmation.

## QR utilities

Admin > QR generates downloadable PNG codes for:

- the main site
- the Live Wall sharing page at `/share` (`public/qr/live-wall-share.png`)
- `/photos`
- each configured table at `/table/<number>`
- each invitation at `/g/<random-secure-token>`

Personal information is never encoded in a QR destination.

## Vercel deployment

Create a **new Vercel project** for this app. Do not attach the wedding hostname to the existing root/movie project.

Recommended project settings:

- Repository: the existing movie-server repository
- Root Directory: `apps/wedding`
- Framework Preset: Next.js
- Node.js Version: `22.x` (also pinned in this app's `package.json`)
- Install Command: `npm ci --workspaces=false --include=dev --no-audit --no-fund`
- Build Command: `npm run build --workspaces=false`
- Production branch: `main`

The install/build commands are committed in `apps/wedding/vercel.json`. The wedding app has its own lockfile and does not depend on sibling workspaces. Isolating its install avoids the repository-level WhatsApp/native dependencies and `patch-package` postinstall. Include development dependencies because Tailwind/PostCSS and TypeScript are required for the production build. When changing dependencies, update both the app's standalone lockfile (`npm install --package-lock-only --workspaces=false` from this directory) and the repository lockfile.

Add all production environment variables before the first production deployment. Keep `WEDDING_DEMO_MODE=false`.

Normal releases use the existing GitHub integration: commit the changes, then push `main`. Vercel builds only the wedding app and assigns the wedding domain after the build succeeds. A successful Git push alone does not mean the new version is live; check the deployment status and domain alias.

```bash
git push origin main
npx vercel project inspect shoval-michael-wedding
npx vercel inspect https://wedding.my-rem.com
```

The repository-root `.vercel/project.json` belongs to a different project. Do not deploy from that link or change it. For an emergency CLI deployment from the repository root, explicitly select the wedding project without relinking:

```bash
VERCEL_ORG_ID=team_LAOx3dAWUsQrmkhR3GKiM8wH VERCEL_PROJECT_ID=prj_xsjTWIn6VyZPON1HOtUBjeOBvhYi npx vercel --prod
```

### `wedding.my-rem.com`

Cloudflare is authoritative for `my-rem.com`. `movies.my-rem.com` is served by a separate Cloudflare Tunnel and must not be changed.

The production deployment is linked to the isolated Vercel project `shoval-michael-wedding`. Vercel reports the custom domain as valid and HTTPS is active.

The active Cloudflare DNS record is:

- Type: `CNAME`
- Name/host: `wedding`
- Target/value: `3acc03e6f801c80f.vercel-dns-017.com`
- Proxy status: DNS only

If the Vercel project is ever recreated, inspect its domain settings before changing DNS because the project-specific target may change.

Do not modify the apex record, `movies`, the Cloudflare nameservers, or the existing tunnel configuration.

## Quality checks

```bash
npm run typecheck
npm run lint
npm test
npm run build
```

The tests cover phone normalization, invitation lookup safety, session signing/expiry/tamper resistance, real workbook header mapping, sync planning/apply behavior, seating publication, persistent/local rate limiting, integration availability, table QR identifiers, and upload validation.

## Production content checklist

Before launch, replace the explicit placeholders in `lib/wedding-config.ts`:

- real story photographs
- final schedule
- final menu and food photography
- final story copy
- confirmed FAQ answers
- optional weather provider/forecast implementation

The homepage hero uses the approved photo supplied by the couple. The generated Open Graph image remains a polished stand-in and can be replaced with a final branded share image later.
