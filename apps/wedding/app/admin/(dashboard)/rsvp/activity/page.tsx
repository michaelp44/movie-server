import Link from "next/link";

import { PageHeader } from "@/components/admin/page-header";
import { fallbackRequest, isFallbackConfigured } from "@/lib/fallback/client";
import { requireAdmin } from "@/lib/admin";
import { createAdminClient } from "@/lib/supabase/admin";

const labels: Record<string, string> = {
  link_opened: "פתחו קישור אישי",
  rsvp_page_viewed: "צפו בעמוד אישור ההגעה",
  interaction: "לחצו באתר",
  rsvp_saved: "תשובת הגעה נשמרה",
  rsvp_failed: "ניסיון שמירה נכשל",
};

const targets: Record<string, string> = {
  rsvp: "לעמוד אישור ההגעה", home: "לעמוד הבית",
  rsvp_confirmed_selected: "בחרו להגיע", rsvp_declined_selected: "בחרו לא להגיע",
  confirmed: "מגיעים", declined: "לא מגיעים",
  transport_yes: "ביקשו הסעה", transport_no: "לא ביקשו הסעה",
  dietary_option: "בחרו אפשרות אוכל", allergy_note_focus: "פתחו שדה אלרגיות",
  note_focus: "פתחו שדה הערה", home_after_rsvp: "חזרו לאתר",
  invalid_details: "פרטים לא תקינים", invalid_count: "כמות לא תקינה",
  count_mismatch: "אי־התאמה בכמויות", save_error: "שגיאת שמירה",
};

type ActivityEvent = {
  id: string;
  invitation_id: string;
  display_name?: string | null;
  event_type: string;
  target: string | null;
  details: Record<string, unknown>;
  created_at: string;
};

function targetLabel(target: string | null): string | null {
  if (!target) return null;
  if (targets[target]) return targets[target];
  const count = /^count_(adults|children|infants)_(increase|decrease)$/.exec(target);
  if (count) return `${count[2] === "increase" ? "הוסיפו" : "הפחיתו"} ${({ adults: "מבוגרים", children: "ילדים", infants: "פעוטות" } as Record<string, string>)[count[1]]}`;
  return ({ button: "כפתור", link: "קישור", label: "אפשרות", input: "שדה" } as Record<string, string>)[target] ?? "פעולה באתר";
}

export default async function InvitationActivityPage({ searchParams }: {
  searchParams: Promise<{ invitation?: string }>;
}) {
  await requireAdmin();
  const invitationId = (await searchParams).invitation;
  const filterId = invitationId && /^[0-9a-f-]{36}$/i.test(invitationId) ? invitationId : null;
  const db = createAdminClient({ optional: true });
  let databaseAvailable = false;
  let databaseEvents: ActivityEvent[] = [];
  if (db) {
    let query = db.from("invitation_activity")
      .select("id, invitation_id, event_type, target, details, created_at")
      .order("created_at", { ascending: false }).limit(300);
    if (filterId) query = query.eq("invitation_id", filterId);
    const result = await query;
    if (result.error) console.error("Invitation activity lookup failed", result.error);
    else {
      databaseAvailable = true;
      databaseEvents = (result.data ?? []) as ActivityEvent[];
    }
  }
  let localAvailable = false;
  let localEvents: ActivityEvent[] = [];
  if (isFallbackConfigured()) {
    try {
      const backup = await fallbackRequest<{ events: ActivityEvent[] }>("/v1/invitation-activity", { timeoutMs: 2_000 });
      localAvailable = true;
      localEvents = backup.events ?? [];
    } catch (error) {
      console.error("Local invitation activity backup lookup failed", error);
    }
  }
  const merged = new Map(databaseEvents.map((event) => [event.id, event]));
  for (const event of localEvents) merged.set(event.id, { ...merged.get(event.id), ...event });
  const events = [...merged.values()]
    .filter((event) => !filterId || event.invitation_id === filterId)
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
    .slice(0, 150);
  const ids = [...new Set(events.filter((event) => !event.display_name).map((event) => event.invitation_id))];
  const result = db && ids.length ? await db.from("invitations").select("id, display_name").in("id", ids) : null;
  if (result?.error) console.error("Invitation activity names lookup failed", result.error);
  const names = new Map((result?.data ?? []).map((item) => [item.id, item.display_name]));

  return <>
    <PageHeader title="פעילות הזמנות" description="פתיחת קישור אישי, פעולות בעמוד האישור ותשובות שנשמרו. מוצגות עד 150 הפעולות האחרונות." />
    <p className="mb-4 text-xs text-black/55">מצב מקורות: Supabase {databaseAvailable ? "זמין" : "לא זמין"} · גיבוי מקומי ב‑Mac {localAvailable ? "זמין" : "לא זמין"}</p>
    <div className="mb-5 flex flex-wrap gap-3 text-sm font-semibold"><Link href="/admin/rsvp" className="underline">חזרה לאישורי הגעה</Link>{filterId ? <Link href="/admin/rsvp/activity" className="underline">כל הפעילות</Link> : null}</div>
    <ol className="space-y-2">
      {events.map((event) => <li key={event.id} className="rounded-2xl border border-black/10 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <strong>{event.display_name ?? names.get(event.invitation_id) ?? "הזמנה"}</strong>
          <time className="text-xs text-black/50" dateTime={event.created_at}>{new Intl.DateTimeFormat("he-IL", { dateStyle: "short", timeStyle: "short", timeZone: "Asia/Jerusalem" }).format(new Date(event.created_at))}</time>
        </div>
        <p className="mt-1 text-sm">{labels[event.event_type] ?? "פעילות"}{targetLabel(event.target) ? ` · ${targetLabel(event.target)}` : ""}</p>
        {event.event_type === "rsvp_saved" && typeof event.details === "object" && event.details && !Array.isArray(event.details) && typeof event.details.numberConfirmed === "number" ? <p className="mt-1 text-xs text-black/55">כמות שאושרה: {event.details.numberConfirmed}</p> : null}
      </li>)}
    </ol>
    {!events.length ? <p className="rounded-2xl bg-white p-8 text-center text-black/55">אין עדיין פעילות להצגה.</p> : null}
  </>;
}
