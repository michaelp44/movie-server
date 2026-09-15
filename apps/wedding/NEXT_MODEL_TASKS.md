# Next Model Tasks

## Completed

- Built and deployed the Hebrew wedding site at `https://wedding.my-rem.com`.
- Connected the custom domain without changing the apex or `movies.my-rem.com`.
- Added downloadable main-site QR assets and optional admin table/personal QR generation.
- Implemented guest sessions, phone normalization, Supabase schema/RLS, private uploads, moderation, admin, Google Sheets mapping/sync, rate limiting, and tests.
- Verified the real workbook, source tabs, row-4 headers, and table-summary tab read-only.
- Configured the real Google Sheet ID and source-tab names in Vercel Production.
- Updated sync to retain invitations without phones, flag invalid phones, reject ambiguous seating, and keep table QR identifiers valid.
- Added Storage metadata verification and `private, no-store` headers for sensitive APIs.
- Clarified in admin that per-table QR codes are optional.
- Replaced the temporary homepage hero with the supplied photo of Shoval and Michael.
- Added the Live Wedding Wall, combined guest sharing, AI moderation pipeline, admin controls, reactions, QR assets, demo rotation, and tests.
- Prepared simple readable backups of all wedding tables and uploaded media to the attached `My Passport` drive.
- Replaced venue placeholders with verified 5.91 details, working Waze/Google Maps routes, parking guidance, calendar location, and a Bit phone-copy flow.
- Connected the official Bit collection link for direct guest payments.
- Replaced the social/WhatsApp preview with a premium card based on the couple's supplied photo.
- Added automatic Open-Meteo forecast retrieval for Netanya during the seven days before the wedding.
- Added native mobile site sharing, a printable `/qr` page, and an independent `/live/demo` wall preview.
- Added the venue Live Wall operating runbook and weather-range/code tests.
- Added gallery likes with per-device deduplication, counts, unlike support, rate limiting, and private server-only persistence.
- Added an automatic Mac mini failover for uploads, blessings, songs, reactions, likes, gallery, and Live Wall reads.
- Added HMAC-signed fallback traffic, one-time upload URLs, expiring media URLs, local SQLite persistence, and Cloudflare Tunnel origin isolation.
- Added dual writes and merged reads so Mac-only content survives Supabase recovery without disappearing from the wall.
- Added a consistent local SQLite/media snapshot to the attached external drive and background LaunchAgents for the fallback service and backup attempts.
- Reduced short-video uploads to 50MB so the same policy works through Cloudflare and Supabase Free limits.
- Added server-generated short-video preview frames so AI can moderate local fallback videos; a missing preview fails safely to manual review.

## Complex tasks remaining

### 1. Provision and connect Supabase

- What needs to be done: Create a dedicated project, apply all SQL migrations in filename order, configure Vercel keys, and create the first admin user.
- Why complex/risky: Requires authenticated account access, secret handling, database migration, and production authorization checks.
- Relevant files: `supabase/migrations/`, `lib/supabase/`, `lib/admin/auth.ts`, `.env.example`.
- Current known state: The Supabase login page is open, but no account session or project credentials are available. Production controls fail closed.
- Suggested next step: User signs in to Supabase; then create the project, apply the migration, add keys to Vercel, and run an authenticated smoke test.

### 2. Connect Google service-account synchronization

- What needs to be done: Create a read-only service account, share the wedding workbook with it, add its email/private key to Vercel, preview sync, review conflicts, and apply.
- Why complex/risky: Handles private guest data and credentials; a bad identity mapping can overwrite source-managed fields.
- Relevant files: `lib/google-sheets/`, `lib/sync/`, `app/admin/(dashboard)/sync/`, `.env.example`.
- Current known state: Workbook ID and source tabs are configured. The app still lacks service-account credentials.
- Suggested next step: Create/share the service account, deploy secrets, then run preview before apply.

### 3. Complete authenticated production end-to-end verification

- What needs to be done: Test real phone identification, returning session, personalized link, seating publication, upload completion, moderation, gallery publication, guestbook, songs, and admin logout.
- Why complex/risky: Requires live Supabase data and exercises privacy/security boundaries.
- Relevant files: `app/actions/`, `app/api/`, `lib/guest-data/`, `lib/guest-session/`, `lib/data/guest-interactions.ts`.
- Current known state: Unit/build checks pass; database-backed controls are intentionally disabled in production.
- Suggested next step: Run the flows with one dedicated test invitation after Supabase setup.

### 4. Add local emergency admin authentication

- What needs to be done: Add an emergency admin session that remains usable when Supabase Auth is unavailable.
- Why complex/risky: It is an authentication boundary protecting guest data and destructive moderation controls; an unsafe shortcut would expose the admin dashboard.
- Relevant files: `lib/admin/auth.ts`, `app/actions/admin-auth.ts`, `app/admin/login/page.tsx`.
- Current known state: The user asked to defer login work. Guest content continues anonymously during an outage, but admin login still requires Supabase.
- Suggested next step: When login work resumes, use a rate-limited Keychain-backed emergency passcode and a separate signed HttpOnly cookie.

### 5. Connect GitHub and Vercel Git deployment

- What needs to be done: Authenticate GitHub, push local commits, and connect the dedicated Vercel project to the monorepo with `apps/wedding` as its root.
- Why complex/risky: Current repository contains unrelated user changes; incorrect project/root configuration could affect other apps.
- Relevant files: repository Git configuration and Vercel project settings.
- Current known state: Wedding work is committed locally. GitHub rejected CLI/browser access; manual Vercel deployment works.
- Suggested next step: Sign in to GitHub, push only the existing commits, then verify Vercel project root before enabling auto-deploy.

## Remaining simple tasks

- Grant `/opt/homebrew/bin/node` macOS access to removable volumes, then load the prepared five-minute external-backup LaunchAgent.
- Replace schedule, menu, story, remaining FAQ, and photo placeholders after final content is supplied.
- Optionally remove per-table QR cards if only the main QR will be printed.
- After Supabase is provisioned, smoke-test safe/review/blocked moderation with disposable content. The OpenAI key is already configured in Vercel Production.
- Print-test `/qr` on the exact paper/printer that will be used at the venue.

## Project status

The public site, domain, HTTPS, QR assets, responsive UI, Mac fallback service, external snapshot, anonymous uploads/messages, gallery, likes, reactions, and Live Wall can work without Supabase. Guest personalization, admin authentication, Google Sheet sync, and the cloud primary still need the Supabase/Google credentials to be connected.
