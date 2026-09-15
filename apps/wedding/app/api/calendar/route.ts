import { buildCalendarIcs } from "@/lib/wedding-config";

export const dynamic = "force-static";

export function GET() {
  return new Response(buildCalendarIcs(), {
    status: 200,
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": 'attachment; filename="shoval-michael-wedding.ics"',
      "Cache-Control": "public, max-age=3600, s-maxage=86400",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
