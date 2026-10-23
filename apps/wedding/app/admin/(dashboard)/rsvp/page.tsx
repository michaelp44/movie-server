import Link from "next/link";
import { setContactOptOutAction } from "@/app/actions/admin";

import { Field, SelectField } from "@/components/admin/form-fields";
import { AdminNotice } from "@/components/admin/notice";
import { PageHeader } from "@/components/admin/page-header";
import { StatusBadge } from "@/components/admin/status-badge";
import { RsvpSendForm } from "@/components/admin/rsvp-send-form";
import { getAdminDietaryTotals, getAdminOverview, listAdminRsvpInvitations } from "@/lib/admin";
import { weddingMessage } from "@/lib/rsvp/messages";
import { rsvpCampaignPlan } from "@/lib/rsvp/campaign";
import { rsvpDetailsSummary } from "@/lib/rsvp/details";

const statusLabels: Record<string, string> = {
  pending: "ממתינים",
  confirmed: "מגיעים",
  declined: "לא מגיעים",
  maybe: "אולי",
};
const messageKinds = ["invitation", "reminder", "event_details", "table_assignment", "thank_you"] as const;

export default async function AdminRsvpPage({ searchParams }: {
  searchParams: Promise<{ q?: string; status?: string; contact?: string; notice?: string }>;
}) {
  const params = await searchParams;
  const [invitations, overview, dietaryTotals] = await Promise.all([
    listAdminRsvpInvitations({ search: params.q, status: params.status, contact: params.contact }),
    getAdminOverview(),
    getAdminDietaryTotals(),
  ]);
  const counts = {
    invitations: overview.totalInvitations,
    invited: overview.totalInvited,
    confirmed: overview.confirmed,
    pending: overview.pending,
  };
  return (
    <>
      <PageHeader title="אישורי הגעה" description="שליחה מפוקחת ב-WhatsApp ומעקב אחר תשובות — הודעה אחת בכל לחיצה." />
      <AdminNotice>{params.notice}</AdminNotice>
      <div className="mb-4 flex justify-end"><a href="/api/admin/rsvp.csv" className="inline-flex min-h-11 items-center rounded-xl border border-black/15 bg-white px-4 text-sm font-semibold">הורדת CSV</a></div>
      <div className="mb-4 flex flex-wrap gap-2"><Link href="/admin/rsvp/campaigns" className="inline-flex min-h-11 items-center rounded-xl bg-[#1d1b18] px-4 text-sm font-semibold text-white">קמפיינים אוטומטיים</Link><Link href="/admin/rsvp?contact=unsent" className="inline-flex min-h-11 items-center rounded-xl border border-black/15 bg-white px-4 text-sm font-semibold">תור שליחה ידני</Link><Link href="/admin/rsvp/calls" className="inline-flex min-h-11 items-center rounded-xl border border-black/15 bg-white px-4 text-sm font-semibold">תור שיחות</Link><Link href="/admin/rsvp/activity" className="inline-flex min-h-11 items-center rounded-xl border border-black/15 bg-white px-4 text-sm font-semibold">יומן פעילות</Link></div>
      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Metric label="הזמנות" value={counts.invitations} />
        <Metric label="סה״כ מוזמנים" value={counts.invited} />
        <Metric label="מגיעים" value={counts.confirmed} />
        <Metric label="ממתינים לתשובה" value={counts.pending} />
      </div>
      <section aria-labelledby="dietary-totals-title" className="mb-6 rounded-2xl border border-[#a9854f]/30 bg-white p-4 sm:p-5">
        <h2 id="dietary-totals-title" className="font-bold">מנות מיוחדות לפי אישורי הגעה</h2>
        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {dietaryTotals.map(({ label, count }) => <div key={label} className="rounded-xl bg-[#f5ecdc] p-3 text-center"><p className="text-sm text-black/65">{label}</p><p className="mt-1 text-2xl font-bold tabular-nums">{count}</p><p className="text-xs text-black/55">אנשים</p></div>)}
        </div>
        <p className="mt-3 text-xs leading-5 text-black/55">הסיכום כולל מגיעים בלבד. סועד יכול להופיע ביותר מסוג אחד; בתשובות ישנות ללא כמות נפרדת נספרו כל המגיעים שבהזמנה.</p>
      </section>
      <aside className="mb-6 rounded-2xl border border-amber-300/50 bg-amber-50 p-4 text-sm leading-6 text-amber-950">
        שליחה ידנית שולחת הודעה אחת בכל לחיצה. בקמפיינים האוטומטיים ההודעות נכנסות לתור איטי שניתן לעצור בכל רגע.
      </aside>
      <details className="mb-6 rounded-2xl border border-black/10 bg-white p-4">
        <summary className="cursor-pointer font-bold">לוח התקשורת המתוכנן</summary>
        <ol className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{rsvpCampaignPlan.map((step) => <li key={step.date} className="rounded-xl bg-[#f4f1e9] p-3"><time dir="ltr" className="text-xs font-bold text-[#8b6b3d]">{new Intl.DateTimeFormat("he-IL", { dateStyle: "medium", timeZone: "Asia/Jerusalem" }).format(new Date(`${step.date}T12:00:00+03:00`))}</time><strong className="mt-1 block">{step.title}</strong><span className="text-xs text-black/55">{step.audience}</span></li>)}</ol>
        <p className="mt-3 text-xs text-black/50">הלוח הוא תכנון בלבד ואינו שולח הודעות אוטומטית.</p>
      </details>
      <form action="/admin/rsvp" className="mb-6 grid gap-3 rounded-2xl border border-black/10 bg-white p-4 sm:grid-cols-2 xl:grid-cols-[1fr_180px_180px_auto]">
        <Field label="חיפוש לפי שם או טלפון" name="q" defaultValue={params.q} type="search" />
        <SelectField label="סטטוס" name="status" defaultValue={params.status ?? ""}>
          <option value="">הכול</option>
          {Object.entries(statusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </SelectField>
        <SelectField label="שליחה" name="contact" defaultValue={params.contact ?? ""}>
          <option value="">הכול</option>
          <option value="unsent">טרם נשלחה הודעה</option>
          <option value="sent">השליחה האחרונה הצליחה</option>
          <option value="failed">השליחה האחרונה נכשלה</option>
          <option value="no-phone">ללא מספר תקין</option>
        </SelectField>
        <button type="submit" className="min-h-11 self-end rounded-xl bg-[#1d1b18] px-5 text-sm font-semibold text-white">חיפוש</button>
      </form>
      <div className="space-y-3">
        {invitations.map((invitation, index) => (
          <details key={invitation.id} open={params.contact === "unsent" && index === 0} className="overflow-hidden rounded-2xl border border-black/10 bg-white shadow-sm">
            <summary className="grid cursor-pointer gap-2 px-4 py-4 marker:hidden sm:grid-cols-[1fr_auto_auto] sm:items-center sm:px-5">
              <div>
                <p className="font-bold">{invitation.displayName}</p>
                <p dir="ltr" className="mt-1 w-fit text-sm text-black/55">{invitation.normalizedPhone ?? invitation.primaryPhone ?? "אין מספר תקין"}</p>
                <p className="mt-1 text-xs font-semibold text-[#80602f]">{invitation.rsvpDetails ? "לחצו כאן לצפייה בפרטי אוכל, הסעה ואלרגיות" : "לחצו כאן לפתיחת פרטי ההזמנה"}</p>
              </div>
              <span><StatusBadge status={invitation.rsvpStatus} /></span>
              <span className="text-sm font-semibold">{invitation.numberConfirmed}/{invitation.numberInvited}</span>
            </summary>
            <div className="border-t border-black/10 bg-[#faf8f3] p-4 sm:p-5">
              {invitation.rsvpNote ? <div className="mb-4 rounded-xl border border-[#a9854f]/25 bg-[#f5ecdc] p-3 text-sm leading-6"><strong>הערת האורחים:</strong> {invitation.rsvpNote}</div> : null}
              {invitation.rsvpDetails ? <div className="mb-4 rounded-xl border border-[#a9854f]/25 bg-[#f5ecdc] p-3 text-sm leading-6"><strong>פרטי ההגעה:</strong><ul className="mt-1 list-inside list-disc">{rsvpDetailsSummary(invitation.rsvpDetails, invitation.numberConfirmed).map((item) => <li key={item}>{item}</li>)}</ul></div> : null}
              {invitation.rsvpUpdatedAt ? <p className="mb-3 text-xs text-black/50">תשובה אחרונה: {new Intl.DateTimeFormat("he-IL", { dateStyle: "short", timeStyle: "short", timeZone: "Asia/Jerusalem" }).format(new Date(invitation.rsvpUpdatedAt))} · מקור: {sourceLabel(invitation.rsvpSource)}</p> : null}
              {invitation.responseHistory.length ? (
                <details className="mb-4 rounded-xl border border-black/10 bg-white p-3">
                  <summary className="cursor-pointer text-sm font-semibold">היסטוריית תשובות ({invitation.responseHistory.length})</summary>
                  <ul className="mt-3 divide-y divide-black/10 text-sm">
                    {invitation.responseHistory.map((response) => (
                      <li key={response.id} className="py-2">
                        <span className="font-semibold">{statusLabels[response.status] ?? response.status} · {response.numberConfirmed} מגיעים</span>
                        <span className="block text-xs text-black/50">{sourceLabel(response.source)} · {new Intl.DateTimeFormat("he-IL", { dateStyle: "short", timeStyle: "short", timeZone: "Asia/Jerusalem" }).format(new Date(response.createdAt))}</span>
                        {response.note ? <span className="mt-1 block text-black/70">{response.note}</span> : null}
                        {response.details ? <span className="mt-1 block text-black/70">{rsvpDetailsSummary(response.details, response.numberConfirmed).join(" · ")}</span> : null}
                      </li>
                    ))}
                  </ul>
                </details>
              ) : null}
              {invitation.lastDelivery ? (
                <p className={`mb-4 rounded-xl px-3 py-2 text-sm ${invitation.lastDelivery.status === "sent" ? "bg-emerald-50 text-emerald-800" : invitation.lastDelivery.status === "failed" ? "bg-red-50 text-red-800" : "bg-amber-50 text-amber-900"}`}>
                  שליחה אחרונה: {invitation.lastDelivery.status === "sent" ? "נשלחה" : invitation.lastDelivery.status === "failed" ? "נכשלה" : "בתהליך"} · {new Intl.DateTimeFormat("he-IL", { dateStyle: "short", timeStyle: "short", timeZone: "Asia/Jerusalem" }).format(new Date(invitation.lastDelivery.createdAt))}
                </p>
              ) : null}
              <RsvpSendForm
                invitationId={invitation.id}
                displayName={invitation.displayName}
                defaultKind={invitation.rsvpStatus === "pending" && invitation.lastDelivery ? "reminder" : "invitation"}
                disabledReason={invitation.contactOptOut ? "ההזמנה מסומנת כ'לא ליצור קשר'." : !invitation.normalizedPhone ? "לא ניתן לשלוח עד שמתקנים את מספר הטלפון." : undefined}
                returnTo={params.contact === "unsent" ? "/admin/rsvp?contact=unsent" : "/admin/rsvp"}
                messages={Object.fromEntries(messageKinds.map((kind) => [kind, weddingMessage({ kind, displayName: invitation.displayName, secureToken: invitation.secureToken, tableNumber: invitation.tableNumber })])) as Record<(typeof messageKinds)[number], string>}
              />
              <div className="mt-4 flex flex-wrap gap-4 text-sm">
                <Link href={`/rsvp/${invitation.secureToken}`} target="_blank" className="font-semibold text-[#80602f] underline">פתיחת עמוד האישור</Link>
                <Link href={`/admin/rsvp/activity?invitation=${invitation.id}`} className="font-semibold text-[#80602f] underline">פעילות ההזמנה</Link>
                <Link href={`/admin/guests?q=${encodeURIComponent(invitation.displayName)}`} className="font-semibold text-[#80602f] underline">עריכת ההזמנה</Link>
                <form action={setContactOptOutAction}><input type="hidden" name="invitationId" value={invitation.id} /><input type="hidden" name="enabled" value={invitation.contactOptOut ? "false" : "true"} /><button className="font-semibold text-red-700 underline">{invitation.contactOptOut ? "אפשר יצירת קשר" : "לא ליצור קשר"}</button></form>
              </div>
            </div>
          </details>
        ))}
        {!invitations.length ? <p className="rounded-2xl bg-white p-10 text-center text-black/50">לא נמצאו הזמנות.</p> : null}
      </div>
    </>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return <div className="rounded-2xl border border-black/10 bg-white p-4"><p className="text-xs font-semibold text-black/50">{label}</p><p className="mt-1 text-3xl font-bold tabular-nums">{value}</p></div>;
}

function sourceLabel(source: string | null) {
  return ({ website: "האתר", whatsapp: "WhatsApp", phone: "שיחה", admin: "מנהל", google_sheet: "Google Sheets" } as Record<string, string>)[source ?? ""] ?? "לא ידוע";
}
