# Next Model Tasks

## WhatsApp Cloud API checkpoint — 2026-09-28

- User chose official WhatsApp Cloud API instead of the existing unofficial Web transport. No messages were sent or production settings changed during this preparation.
- Added `lib/rsvp/whatsapp-cloud.ts`: validated template payloads, server-side Graph API sender, constant-time raw-body signature verification, and parsing of three correlated RSVP quick replies. Added four focused tests and documented five future server-only environment values.
- Existing send actions and campaign worker still use the Web transport. Do **not** enable Cloud sends until Meta phone registration/coexistence, billing, approved Hebrew template, long-lived token, and a test message are verified.
- Next: establish approved template names and parameter order, add signed GET/POST webhook route with idempotent inbound-event storage and sender/provider-message correlation, update RSVP/history and Google Sheets write-back, then switch the admin send/campaign transport behind an explicit configuration flag. Test on owner's number before any campaign.
- Checks: wedding tests 117/117, lint, typecheck, production build all pass locally. Not deployed.

## Active checkpoint — 2026-09-24 08:15 Asia/Jerusalem

- Added and deployed a non-mutating Google Sheets Editor-permission check in `/admin/sync`. Production reports that the service account is still Viewer/no-write.
- Added opt-in asynchronous RSVP write-back behind `GOOGLE_SHEETS_WRITEBACK_ENABLED=true`. It parses the synchronized tab prefix, updates only the mapped RSVP/count cells, runs after the website response is safely stored, and logs Google failures without failing the guest flow.
- Added source parsing tests; wedding suite is now 94/94 passing. The production flag remains disabled until Editor access and one bounded test are confirmed.
- Changed the existing service account `michael-project-id@appspot.gserviceaccount.com` from Viewer to Editor on the master workbook only; general access remains Restricted.
- Fixed the write-access check to perform an idempotent same-title update because Google rejects empty batch requests. Production permission check now passes.
- Ran the bounded end-to-end adapter test against `מוזמנים - מיכאל` row 17 (`אדיר ופאולינה עוזרי`): the existing values `ממתין` and `0` were written back unchanged and verified by a fresh Sheet read.
- Enabled `GOOGLE_SHEETS_WRITEBACK_ENABLED=true` for Vercel Production and redeployed. New website RSVPs from synchronized invitations now update the mapped status/count cells asynchronously after the database save.

- RSVP production migration and follow-up permissions migration are applied.
- The personalized RSVP flow was verified end-to-end with the owner's test invitation: confirmed 2/2, source `website`, and response history present.
- The dedicated WhatsApp Business account is linked and a direct test plus a personalized invitation were delivered to the owner's number.
- Fixed the supervised-send redirect bug that incorrectly marked a successfully delivered message as failed; repaired the affected test row and deployed the fix.
- Replaced browser `confirm()` with a mobile-friendly two-step confirmation in `/admin/rsvp`.
- Added `WHATSAPP_WEDDING_ONLY`: the dedicated Business process now exposes only the localhost wedding-send bridge and skips personal chat/group/Calendar/Sheets workflows. Agent tests (56/56) and TypeScript build pass, and the LaunchAgent was restarted successfully.
- Next priority: confirm whether the Google Sheets service account has Editor access, then enable and test bounded RSVP write-back on the owner's test row only. Do not send additional guest messages during this check.

### Previous checkpoint

- Production RSVP schema migration `202609230001_rsvp_communications.sql` was applied and the app was deployed.
- Dedicated WhatsApp Business session is connected through `data/whatsapp-agent/wedding-business-session`; a test message to `0503062269` succeeded.
- Live Wall media URLs are now stable for 12 hours, retained client-side, and polled every 10 seconds; the fix is deployed.
- End-to-end RSVP testing found `permission denied for table message_deliveries` because the new tables were created after the initial global service-role grant.
- Added follow-up migration `202609230002_rsvp_permissions.sql`. Next action: apply it in Supabase, verify `/admin/rsvp`, then send a personalized test invitation only to `0503062269`.
- Applied the follow-up migration successfully; `/admin/rsvp` now loads. End-to-end testing then found manual invitation creation rejected a missing optional `id`; fixed by normalizing the absent form field to an empty string. Next action: deploy, create `מיכאל — בדיקה`, and send its personalized invitation to `0503062269`.
- Deployed the manual-invitation fix, created `מיכאל — בדיקה` for two invitees, and sent its personalized RSVP link to `0503062269` successfully through the connected Business session. The guest page resolves correctly. Awaiting a real response submission from the received phone link for final admin verification.
- Replaced the fragile browser `confirm()` on supervised sends with a mobile-friendly two-step in-page confirmation (`שליחה` then `אישור ושליחה`).
- Verified the guest response end-to-end: `מיכאל — בדיקה` became confirmed 2/2 with source `website` and one audit-history row.
- Admin send testing exposed a redirect-control-flow bug: the message sent and received a provider ID, but the success redirect was caught as a send failure and overwrote the delivery status. Moved the success redirect outside the `try/catch`; deploy this fix and repair the affected test delivery row where `provider_message_id` and `sent_at` are present.

## Completed

- Rebuilt and deployed `/admin/rsvp/calls` as a mobile-first assisted calling workflow: one pending household at a time, first-uncontacted priority, normal or `#31#` hidden-number dialing, a concise Hebrew script, previous-attempt context, outcome/count/notes, wrong-number suppression, automatic progression to the next household, RSVP audit history, and bounded Google Sheets write-back for confirmed/declined phone responses. Added call-link tests; full suite 100/100, lint, TypeScript, local/production builds, and Vercel deployment pass.
- Changed all newly generated WhatsApp RSVP links to pass through `/g/<secure-token>?next=rsvp`: opening the message now creates the signed 180-day guest session immediately, removes the token through redirects, and continues to the personalized RSVP form. Tests, lint, TypeScript, production build, and Vercel deployment passed; `wedding.my-rem.com` is updated.
- Built and deployed the automatic WhatsApp campaign queue at `/admin/rsvp/campaigns`: audience selection, duplicate-success suppression, explicit final confirmation, persistent recipient queue, randomized 55–110 second pacing, pause/resume/cancel, mobile status counters, protected one-recipient worker endpoint, and Mac LaunchAgent polling. Applied the production migration, restarted the linked WhatsApp Business agent, and verified the protected worker returns `idle`; no campaign was created and no guest message was sent. Wedding tests 96/96, agent tests 56/56, lint, TypeScript, both builds, and Vercel production deployment pass.
- Added 13 user-supplied `אורחים נוספים` invitations (16 invited people) to `מוזמנים - מיכאל` rows 117–129 with their phone numbers, preserved the sheet's native table/dropdowns/banding, visually verified the result, and synchronized them to production. Removed the incorrectly inferred Remitly number from רועי אלון in both the source sheet and production database. Sync result: 277 processed, 13 new, 1 updated, 0 conflicts; the pre-existing 37 mapping warnings remain.
- Matched the current personal WhatsApp contact cache against the `מוזמנים - מיכאל` work-group rows. Filled six safe `נומה`/`סייטה` matches and, after correcting the suffix spelling to `רמיטלי`, eight additional safe matches: מיכאל בגון, גיל שאבו, אמיר שלזינגר, רועי אלון, שיר קושלביץ, חגאי בלוך גדות, לינה קירשון, and אור קפלן. Verified the sheet values and applied both production syncs. Existing differing phone values and ambiguous name matches were deliberately left unchanged; the existing 37 mapping warnings remain for review.

### RSVP replacement work in progress — checkpoint 2026-09-23 08:10 Asia/Jerusalem

- Added migration `202609230001_rsvp_communications.sql` with RSVP response history, supervised WhatsApp delivery history, live-response source/timestamps, indexes, and RLS.
- Added personalized `/rsvp/[token]` flow with attending/declining and confirmed-count updates, server validation, rate limiting, secure guest session creation, and friendly Hebrew states.
- Added `/admin/rsvp`, mobile-first RSVP metrics/filtering, per-invitation message selection/preview, delivery status, RSVP link, and one-click supervised WhatsApp send action.
- Added centralized Hebrew WhatsApp templates and tests.
- Added Mac bridge: Vercel calls the signed fallback endpoint, the fallback forwards only a validated single-message request to a localhost-only WhatsApp agent endpoint, and success is recorded only after WhatsApp returns a message ID.
- Added idempotency to the fallback and local WhatsApp control path; no bulk-send endpoint was added.
- Protected website/admin RSVP responses from later Google Sheet sync overwrites while preserving sheet updates to other invitation fields.
- Wedding tests: 90/90 passed. WhatsApp agent tests: 56/56 passed. Wedding lint, TypeScript, WhatsApp TypeScript build, fallback syntax check, and production Next.js build passed.
- Added `/rsvp` shortcut for already-identified guests, a homepage quick action/top navigation item, and admin RSVP CSV export.
- Rebuilt and restarted both local LaunchAgents. Fallback health is OK and the localhost WhatsApp control reports `ready: true` on port 8790. No guest message was sent.
- Added optional guest RSVP notes (accessibility, dietary or callback context), admin display/export, RSVP source/time, delivery-state filters, and a server-side two-minute duplicate-send guard.
- Fixed message preview so changing the selected WhatsApp message type updates the exact text shown before confirmation; invalid-phone invitations now disable sending.
- Added the five latest RSVP audit entries per invitation to the mobile admin view.
- Added supervised-send queue filtering, manual call queue/results, do-not-contact control, event-day guest check-in, and a non-automatic communication schedule. No external messages or calls are triggered by these screens.
- Added last-call context to the call queue; a wrong-number result now automatically suppresses future contact, and a confirmed call cannot save zero attendees.
- Completed the supervised queue behavior: after a successful send, the sent invitation disappears and the next unsent invitation opens automatically.
- Personalized RSVP now shows the current answer/count and confirms a change from attending to declined.
- Added a bounded Google Sheets RSVP write-back adapter (configured guest tabs and two existing cells only). It remains disconnected until the service account is deliberately upgraded from Viewer to Editor.

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

### 0. Connect and verify Google Sheets RSVP write-back

- What needs to be done: Give the existing Google service account Editor access, enable bounded write-back, and test only against the owner's test invitation/source row.
- Why complex/risky: The wedding workbook is the guest-list source of truth. A wrong column or stale row could modify real guest data, so the adapter deliberately permits only mapped RSVP cells.
- Relevant files: `lib/google-sheets/writeback.ts`, `lib/google-sheets/index.ts`, `app/actions/rsvp.ts`, `tests/google-sheets-writeback.test.ts`.
- Current known state: Read-only synchronization works. The write-back adapter and tests exist but production write access has not yet been verified.
- Suggested next step: Verify Editor permission without changing cells, then perform one bounded test write on the owner's test row and confirm the exact two cells in the Sheet.

### 0.1 Complete the broader iPlan replacement

- What needs to be done: campaign scheduling, WhatsApp Cloud API optional adapter, delivery/read webhooks, consent/suppression management, Google Sheet RSVP write-back/conflict UI, call queue/provider/voice agent, CSV export, event-day guest check-in, and post-event messaging.
- Why complex/risky: Communications affect real guests and external providers; each part needs idempotency, audit logs, consent controls, safe previews, and production integration testing.
- Relevant files: new RSVP files listed above plus `lib/sync/`, `lib/google-sheets/`, and future provider adapters.
- Current known state: Individual supervised WhatsApp sending and website RSVP are deployed and verified; automated campaigns and calls are intentionally not yet implemented.
- Suggested next step: Stabilize and test the MVP first, then add campaign/audience preview without enabling automatic sending.

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
