import { CallQueue } from "@/components/admin/call-queue";
import { AdminNotice } from "@/components/admin/notice";
import { PageHeader } from "@/components/admin/page-header";
import { listAdminRsvpInvitations } from "@/lib/admin";

export default async function CallQueuePage({ searchParams }: { searchParams: Promise<{ notice?: string; current?: string }> }) {
  const params = await searchParams;
  const invitations = (await listAdminRsvpInvitations({ status: "pending" }))
    .filter((item): item is typeof item & { normalizedPhone: string } => Boolean(item.normalizedPhone) && !item.contactOptOut)
    .sort((a, b) => {
      if (!a.lastCall && b.lastCall) return -1;
      if (a.lastCall && !b.lastCall) return 1;
      return (a.lastCall?.createdAt ?? "").localeCompare(b.lastCall?.createdAt ?? "");
    });
  return <>
    <PageHeader title="תור שיחות" description="חיוג מהאייפון, תיעוד תשובות ומעבר אוטומטי בין מי שעדיין לא ענו." />
    <AdminNotice>{params.notice}</AdminNotice>
    <p className="mb-5 rounded-2xl border border-black/10 bg-white p-4 text-sm"><strong>{invitations.length}</strong> הזמנות ממתינות לשיחה. הזמנות ללא ניסיון שיחה מוצגות ראשונות.</p>
    <CallQueue items={invitations} initialId={params.current} />
  </>;
}
