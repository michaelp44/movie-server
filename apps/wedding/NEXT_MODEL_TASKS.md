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

## Complex tasks remaining

### 1. Provision and connect Supabase

- What needs to be done: Create a dedicated project, apply `supabase/migrations/202609140001_initial_wedding_schema.sql`, configure Vercel keys, and create the first admin user.
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

### 4. Connect GitHub and Vercel Git deployment

- What needs to be done: Authenticate GitHub, push local commits, and connect the dedicated Vercel project to the monorepo with `apps/wedding` as its root.
- Why complex/risky: Current repository contains unrelated user changes; incorrect project/root configuration could affect other apps.
- Relevant files: repository Git configuration and Vercel project settings.
- Current known state: Wedding work is committed locally. GitHub rejected CLI/browser access; manual Vercel deployment works.
- Suggested next step: Sign in to GitHub, push only the existing commits, then verify Vercel project root before enabling auto-deploy.

## Remaining simple tasks

- Replace venue, maps, parking, Bit, schedule, menu, story, FAQ, and photo placeholders after final content is supplied.
- Optionally remove per-table QR cards if only the main QR will be printed.

## Project status

The public informational site, domain, HTTPS, QR assets, responsive UI, and safe unavailable states work in production. Dynamic guest/admin/media/sync features are implemented but remain disabled until Supabase and Google service-account credentials are connected.
