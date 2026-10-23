import Link from "next/link";

import { setWhatsappCampaignStatusAction } from "@/app/actions/admin";
import { CampaignCreateForm } from "@/components/admin/campaign-create-form";
import { AdminNotice } from "@/components/admin/notice";
import { PageHeader } from "@/components/admin/page-header";
import { createAdminDataClient, requireAdmin } from "@/lib/admin";
import { campaignAudienceLabel, campaignGroupLabel, listCampaignGuestGroups, type CampaignAudience } from "@/lib/rsvp/campaign-queue";

const statusLabel: Record<string, string> = { draft: "טיוטה", queued: "ממתין", running: "שולח", paused: "מושהה", completed: "הושלם", cancelled: "בוטל" };
const kindLabel: Record<string, string> = { invitation: "הזמנה", reminder: "תזכורת", event_details: "פרטי האירוע", table_assignment: "מספר שולחן", thank_you: "תודה" };

export default async function CampaignsPage({ searchParams }: { searchParams: Promise<{ notice?: string }> }) {
  await requireAdmin();
  const params = await searchParams;
  const db = createAdminDataClient();
  const [campaignResult, guestGroups] = await Promise.all([
    db.from("message_campaigns").select("id, name, message_kind, audience, guest_group_filter, guest_side_filter, status, min_delay_seconds, max_delay_seconds, next_run_at, created_at").order("created_at", { ascending: false }).limit(20),
    listCampaignGuestGroups(),
  ]);
  const { data: campaigns, error } = campaignResult;
  if (error) throw new Error(error.message);
  const ids = (campaigns ?? []).map((campaign) => campaign.id);
  const { data: recipients } = ids.length ? await db.from("message_campaign_recipients").select("campaign_id, status").in("campaign_id", ids) : { data: [] };
  return <>
    <PageHeader title="קמפיינים ב-WhatsApp" description="תור אוטומטי ואיטי, עם עצירה מיידית ומניעת שליחה כפולה." />
    <AdminNotice>{params.notice}</AdminNotice>
    <div className="mb-5"><Link href="/admin/rsvp" className="text-sm font-semibold underline">חזרה לאישורי הגעה</Link></div>
    <CampaignCreateForm guestGroups={guestGroups} />
    <section className="mt-6 space-y-3">
      {(campaigns ?? []).map((campaign) => {
        const rows = (recipients ?? []).filter((recipient) => recipient.campaign_id === campaign.id);
        const sent = rows.filter((recipient) => recipient.status === "sent").length;
        const failed = rows.filter((recipient) => recipient.status === "failed").length;
        const remaining = rows.filter((recipient) => recipient.status === "queued" || recipient.status === "sending").length;
        return <article key={campaign.id} className="rounded-2xl border border-black/10 bg-white p-4 sm:p-5">
          <div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="font-bold">{campaign.name}</h2><p className="mt-1 text-xs text-black/55">{kindLabel[campaign.message_kind]} · {campaignAudienceLabel(campaign.audience as CampaignAudience)} · {campaignGroupLabel(campaign.guest_group_filter, campaign.guest_side_filter)} · {campaign.min_delay_seconds}–{campaign.max_delay_seconds} שניות</p></div><span className="rounded-full bg-[#f4f1e9] px-3 py-1 text-xs font-bold">{statusLabel[campaign.status] ?? campaign.status}</span></div>
          <div className="mt-4 grid grid-cols-3 gap-2 text-center text-sm"><Metric label="נשלחו" value={sent} /><Metric label="בתור" value={remaining} /><Metric label="נכשלו" value={failed} /></div>
          {campaign.next_run_at ? <p className="mt-3 text-xs text-black/50">הפעולה הבאה: {new Intl.DateTimeFormat("he-IL", { dateStyle: "short", timeStyle: "medium", timeZone: "Asia/Jerusalem" }).format(new Date(campaign.next_run_at))}</p> : null}
          {(["queued", "running", "paused"] as string[]).includes(campaign.status) ? <div className="mt-4 flex flex-wrap gap-2">
            <CampaignButton id={campaign.id} status={campaign.status === "paused" ? "queued" : "paused"} label={campaign.status === "paused" ? "המשך" : "עצירה"} />
            <CampaignButton id={campaign.id} status="cancelled" label="ביטול הקמפיין" danger />
          </div> : null}
        </article>;
      })}
      {!campaigns?.length ? <p className="rounded-2xl bg-white p-8 text-center text-black/50">עדיין לא נוצר קמפיין.</p> : null}
    </section>
  </>;
}

function Metric({ label, value }: { label: string; value: number }) { return <div className="rounded-xl bg-[#f7f4ed] p-3"><strong className="block text-xl tabular-nums">{value}</strong><span className="text-xs text-black/55">{label}</span></div>; }
function CampaignButton({ id, status, label, danger = false }: { id: string; status: "queued" | "paused" | "cancelled"; label: string; danger?: boolean }) { return <form action={setWhatsappCampaignStatusAction}><input type="hidden" name="campaignId" value={id} /><input type="hidden" name="status" value={status} /><button className={`min-h-11 rounded-xl px-4 text-sm font-semibold ${danger ? "border border-red-200 text-red-700" : "bg-[#1d1b18] text-white"}`}>{label}</button></form>; }
