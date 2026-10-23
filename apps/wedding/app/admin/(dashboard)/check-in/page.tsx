import { toggleCheckInAction } from "@/app/actions/admin";
import { Field } from "@/components/admin/form-fields";
import { PageHeader } from "@/components/admin/page-header";
import { listAdminRsvpInvitations } from "@/lib/admin";

export default async function CheckInPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const params = await searchParams;
  const invitations = await listAdminRsvpInvitations({ search: params.q, status: "confirmed" });
  const checkedIn = invitations.reduce((sum, item) => sum + (item.checkedInAt ? item.numberConfirmed : 0), 0);
  return <>
    <PageHeader title="כניסת אורחים" description="חיפוש מהיר וסימון הגעה בפועל ביום האירוע." />
    <div className="mb-5 grid grid-cols-2 gap-3"><div className="rounded-2xl bg-white p-4"><span className="text-sm text-black/50">נכנסו</span><strong className="block text-3xl">{checkedIn}</strong></div><div className="rounded-2xl bg-white p-4"><span className="text-sm text-black/50">צפויים</span><strong className="block text-3xl">{invitations.reduce((sum, item) => sum + item.numberConfirmed, 0)}</strong></div></div>
    <form action="/admin/check-in" className="mb-5 flex gap-3 rounded-2xl bg-white p-4"><div className="flex-1"><Field label="חיפוש אורח" name="q" type="search" defaultValue={params.q} /></div><button className="min-h-11 self-end rounded-xl bg-black px-5 font-semibold text-white">חיפוש</button></form>
    <div className="space-y-2">{invitations.map((item) => <div key={item.id} className={`flex items-center justify-between gap-3 rounded-2xl border p-4 ${item.checkedInAt ? "border-emerald-300 bg-emerald-50" : "border-black/10 bg-white"}`}><div><strong>{item.displayName}</strong><p className="text-sm text-black/55">{item.numberConfirmed} מגיעים · שולחן {item.tableNumber ?? "טרם שובץ"}</p></div><form action={toggleCheckInAction}><input type="hidden" name="invitationId" value={item.id} /><input type="hidden" name="checkedIn" value={item.checkedInAt ? "false" : "true"} /><button className={`min-h-12 rounded-xl px-4 font-bold ${item.checkedInAt ? "border border-black/15 bg-white" : "bg-emerald-700 text-white"}`}>{item.checkedInAt ? "ביטול כניסה" : "הגיעו"}</button></form></div>)}</div>
  </>;
}
