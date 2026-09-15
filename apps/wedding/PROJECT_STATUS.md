# Wedding Website Checkpoint

Last updated: 2026-09-15 (Asia/Jerusalem)

## Production

- Canonical URL: `https://wedding.my-rem.com`
- Vercel project: `shoval-michael-wedding`
- Domain and HTTPS are active.
- Cloudflare DNS: `CNAME wedding -> 3acc03e6f801c80f.vercel-dns-017.com` (DNS only).
- Public QR assets: `/qr/wedding-site.png` and `/qr/wedding-site.svg`.
- Do not change the apex domain, `movies.my-rem.com`, nameservers, or the existing Cloudflare Tunnel.

## Current integrations

- Vercel authentication is active and manual production deployments work.
- `NEXT_PUBLIC_SITE_URL`, guest-session secrets, rate-limit secrets, the real Google Sheet ID, and the two guest-tab names are configured in Vercel Production.
- `OPENAI_API_KEY` is configured as a hidden Vercel Production secret; the value is not committed or exposed to the browser.
- The Google workbook was verified read-only as `אקסל החתונה הגדול` with source tabs `מוזמנים - מיכאל` and `מוזמנים - שובל`; headers are on row 4.
- The `שולחנות` tab is a capacity summary, not a separate invitation-assignment source.
- Supabase is not connected. Public database-backed controls fail closed and display friendly Hebrew unavailable states.
- Google service-account credentials are not configured. The deployed app cannot sync until the sheet is shared with a dedicated service account and its email/private key are added.
- GitHub authentication is not active in the CLI or browser. Commits are safe locally, but `origin/main` does not yet contain the wedding app and Vercel Git auto-deploy is not connected.

## Latest verification

- TypeScript: passed
- ESLint: passed
- Vitest: 59/59 passed across 9 test files
- Next.js production build: passed
- Latest production deployment: passed
- Live homepage, security headers, QR PNG, and fail-closed upload API: verified

## Highest-priority next steps

1. Sign in to Supabase, create a dedicated wedding project, and apply the migration in `supabase/migrations/`.
2. Add the Supabase public URL, anonymous key, and service-role key to Vercel Production.
3. Create a dedicated Google service account with read-only Sheets access, share the wedding workbook with it, and add its email/private key to Vercel.
4. Create the first Supabase Auth admin and configure `ADMIN_EMAILS`.
5. Run a Google Sheets sync preview, review phone/name conflicts, then apply it.
6. Sign in to GitHub, push the local commits, and connect the dedicated Vercel project for Git auto-deploy.
7. Replace the explicit venue, navigation, Bit, schedule, menu, story, FAQ, and photography placeholders.

## Safety notes

- Demo mode is disabled in production.
- Invitations without a phone are synchronized and counted, but cannot identify publicly until a valid phone is added.
- Missing source rows are flagged for review and never deleted automatically.
- Ambiguous seating matches and contradictory table rows are reported rather than applied.
- Table identifiers are canonical numbers from 1 through 999; display names are stored separately.
- Uploaded media stays private until upload verification and either high-confidence AI approval or explicit admin approval succeed.
- Live Wall routes are implemented at `/share`, `/live`, and `/admin/live-wall`; production activation still requires Supabase plus the additive Live Wall migration.
- The external drive folder `/Volumes/My Passport/Wedding-Shoval-Michael` is ready. Simple readable full-data/media backup scripts are prepared, but cannot run until Supabase credentials exist locally.
