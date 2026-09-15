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
Supabase PostgreSQL <---- Next.js server-only data layer
          |                         |
          |                         +-- signed HttpOnly guest session
          |                         +-- Supabase Auth admin session
          |                         +-- persistent rate limits
          v
Private Supabase Storage -- signed upload/read URLs -- guest browser
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

Requirements: Node.js 22 or newer and npm.

```bash
cd apps/wedding
cp .env.example .env.local
npm install --workspaces=false
npm run dev
```

Open `http://localhost:3000`.

For a guest UI preview without Supabase, set `WEDDING_DEMO_MODE=true` and provide a local `GUEST_SESSION_SECRET` of at least 32 bytes. Use `0501234567` as the demo phone. Demo mode is hard-disabled when `NODE_ENV=production`; submissions and uploads still require Supabase.

Generate local secrets with, for example:

```bash
openssl rand -base64 48
```

## Environment variables

| Variable | Visibility | Required | Purpose |
| --- | --- | --- | --- |
| `NEXT_PUBLIC_SITE_URL` | Public | Yes | Canonical site origin; production value is `https://wedding.my-rem.com` |
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

Do not commit `.env.local`. Vercel secrets must be added in Project Settings > Environment Variables.

When the production Supabase variables are absent or incomplete, the public informational pages remain available while guest identification, uploads, guestbook submissions, song requests, and admin login are visibly disabled with friendly Hebrew status messages. Server endpoints also fail closed; they do not fall back to in-memory storage in production.

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
3. Apply `supabase/migrations/202609140001_initial_wedding_schema.sql` using the Supabase CLI or SQL editor.
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

All application tables have Row Level Security enabled. No anonymous or normal authenticated role can query invitation/guest data directly. The migration also revokes direct table privileges and grants server access to `service_role` only. Admin authorization is checked with Supabase Auth before the server uses the service role.

Song-request uniqueness is enforced both before insertion and by database indexes, so two matching submissions arriving at the same time cannot create an accidental duplicate.

### Storage

The migration creates the private `wedding-media` bucket with an allowlist for JPEG, PNG, WebP, HEIC/HEIF, MP4, QuickTime, and WebM. There are deliberately no unrestricted anonymous Storage policies.

The upload flow is:

1. The browser sends file name, MIME type, and size metadata to `/api/uploads/prepare`.
2. The server validates the batch, generates a UUID filename with a trusted extension, records pending metadata, and returns a short-lived signed upload URL.
3. The browser uploads directly to Storage and calls `/api/uploads/complete` with a one-time completion token.
4. The item remains private and unpublished until an admin approves it.

## Guest identification and sessions

Israeli numbers are normalized to an E.164-style value such as `+972501234567`. Formatting variants such as `050-123-4567`, `050 123 4567`, `972501234567`, and `+972501234567` resolve to the same value.

Lookup happens only on the server. A successful match creates a signed session containing only the invitation UUID, issue/expiry times, and a random nonce. The cookie is HttpOnly, SameSite=Lax, Secure in production, and expires after 180 days. It contains no name or phone number. “זה לא אני” clears it.

Personalized URLs use `/g/<secure-token>`. Tokens are random and never contain a phone number or guest name. The route immediately exchanges a valid token for the same guest session and redirects to `/`, removing the token from the visible URL.

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
- Install Command: `npm install --workspaces=false`
- Build Command: `npm run build`
- Production branch: `main`

Add all production environment variables before the first production deployment. Keep `WEDDING_DEMO_MODE=false`.

CLI equivalent from this directory after authenticating Vercel:

```bash
npx vercel link
npx vercel --prod
npx vercel domains add wedding.my-rem.com
npx vercel domains inspect wedding.my-rem.com
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

- real couple/hero and story photographs
- venue name and address
- Waze and Google Maps URLs
- parking and transport information
- final schedule
- final menu and food photography
- final story copy
- confirmed FAQ answers
- Bit URL
- optional weather provider/forecast implementation

The generated hero and Open Graph images are polished stand-ins, but they intentionally depict an anonymous couple and should be replaced with real approved photography when available.
