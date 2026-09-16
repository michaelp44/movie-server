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
- Provisioned the production Supabase project, applied all migrations, enabled runtime flags, configured private Storage/RLS, and connected Vercel.
- Created and verified the production admin account; its generated password is stored only in macOS Keychain.
- Enabled the Google Sheets API, created a service credential, shared the real wedding workbook read-only, and configured Vercel.
- Synchronized 264 invitations from `מוזמנים - מיכאל` and `מוזמנים - שובל` into Supabase.
- Verified production admin login, guest phone identification, personalized home, Live Wall feed, gallery pages, and like/unlike persistence.
- Fixed sync audit rows so previews and applies no longer violate required JSON fields, and added the real `קבוצה` header alias.

## Complex tasks remaining

### 1. Add local emergency admin authentication

- What needs to be done: Add an emergency admin session that remains usable when Supabase Auth is unavailable.
- Why complex/risky: It is an authentication boundary protecting guest data and destructive moderation controls; an unsafe shortcut would expose the admin dashboard.
- Relevant files: `lib/admin/auth.ts`, `app/actions/admin-auth.ts`, `app/admin/login/page.tsx`.
- Current known state: The user asked to defer login work. Guest content continues anonymously during an outage, but admin login still requires Supabase.
- Suggested next step: When login work resumes, use a rate-limited Keychain-backed emergency passcode and a separate signed HttpOnly cookie.

### 2. Resolve remaining source-sheet data warnings

- What needs to be done: Correct 36 invalid/non-Israeli phone cells and one duplicate invitation identity in the source workbook.
- Why complex/risky: Guest identity data is private and the duplicate needs a human decision about whether it represents one household or two invitations.
- Relevant files: `lib/google-sheets/mapping.ts`, `lib/sync/`, source workbook rows reported by `/admin/sync`.
- Current known state: 264 invitations are synchronized. The warnings are preserved for review; invalid phones are not used for login and no source rows are deleted.
- Suggested next step: Review the flagged rows in `/admin/sync`, correct the source workbook, preview, then apply again.

### 3. Connect GitHub and Vercel Git deployment

- What needs to be done: Authenticate GitHub, push local commits, and connect the dedicated Vercel project to the monorepo with `apps/wedding` as its root.
- Why complex/risky: Current repository contains unrelated user changes; incorrect project/root configuration could affect other apps.
- Relevant files: repository Git configuration and Vercel project settings.
- Current known state: Wedding work is committed locally. GitHub rejected CLI/browser access; manual Vercel deployment works.
- Suggested next step: Sign in to GitHub, push only the existing commits, then verify Vercel project root before enabling auto-deploy.

## Remaining simple tasks

- Replace schedule, menu, story, remaining FAQ, and photo placeholders after final content is supplied.
- Optionally remove per-table QR cards if only the main QR will be printed.
- Run a disposable safe/review/blocked moderation test shortly before the event, then remove the test content.
- Print-test `/qr` on the exact paper/printer that will be used at the venue.

## Project status

The production site, domain, HTTPS, Supabase primary, Google Sheet sync, guest identification, admin, private uploads, AI moderation, gallery likes, reactions, Live Wall, Mac failover, and external backups are operational. Remaining work is primarily final wedding content and correcting source-sheet phone warnings.
