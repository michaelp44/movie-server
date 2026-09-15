# Live Wedding Wall runbook

## Before the event

1. Open `/live/demo` on the venue display and verify the layout, QR scanning distance, Wi-Fi, and HDMI connection.
2. Open `/share` on two phones and test a photo and blessing after Supabase is connected.
3. Keep the display connected to power and disable the operating system's sleep/screensaver. The page also requests a browser wake lock when supported.
4. Keep `/admin/live-wall` open on an admin phone for moderation and emergency controls.
5. Keep a phone hotspot available as a network fallback.

## During the event

- Open `/live` and enter browser fullscreen mode.
- The wall polls every five seconds and reconnects automatically after network loss.
- Use **Pause**, **Next**, **Hide current**, or **Emergency blank** from `/admin/live-wall` when required.
- Approved content rotates every ten seconds. New content is moderated before entering the queue.

## Printable QR cards

Open `/qr` and print in landscape A4. It contains one QR for the main site and one for guest sharing.

## Failure behavior

- Moderation failures remain unpublished for review.
- Broken images are skipped automatically.
- Temporary network failures leave the current item visible and reconnect automatically.
- If the wall must be hidden immediately, use **Emergency blank**.
