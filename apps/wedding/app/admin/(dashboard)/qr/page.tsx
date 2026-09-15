/* eslint-disable @next/next/no-img-element -- Protected, generated QR URLs cannot be fetched by the image optimizer without the admin cookie. */
import { rotateInvitationTokenAction } from "@/app/actions/admin";
import { AdminNotice } from "@/components/admin/notice";
import { PageHeader } from "@/components/admin/page-header";
import { SubmitButton } from "@/components/admin/submit-button";
import { getAdminTables, listAdminInvitations } from "@/lib/admin";

export default async function AdminQrPage({ searchParams }: { searchParams: Promise<{ notice?: string }> }) {
  const [invitations, tableData, params] = await Promise.all([listAdminInvitations(), getAdminTables(), searchParams]);
  return (
    <>
      <PageHeader title="קודי QR" description="יצירה להורדה ולהדפסה. קישורים אישיים כוללים טוקן אקראי בלבד — לעולם לא שם או מספר טלפון." />
      <AdminNotice>{params.notice}</AdminNotice>
      <section className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
        <QrCard title="האתר הראשי" src="/api/admin/qr?kind=main" filename="wedding-main.png" />
        <QrCard title="העלאת תמונות" src="/api/admin/qr?kind=photos" filename="wedding-photos.png" />
        {tableData.tables.map((table) => <QrCard key={table.id} title={`שולחן ${table.tableNumber}`} src={`/api/admin/qr?kind=table&table=${encodeURIComponent(table.tableNumber)}`} filename={`wedding-table-${table.tableNumber}.png`} />)}
      </section>
      <section className="mt-10 rounded-2xl border border-black/10 bg-white p-6">
        <h2 className="font-serif text-3xl">הזמנות אישיות</h2>
        <p className="mt-2 text-sm text-black/50">החלפת טוקן מבטלת מיד את הקישור הקודם. בצעו זאת רק אם קישור נחשף בטעות.</p>
        <div className="mt-5 grid gap-3">{invitations.map((invitation) => <div key={invitation.id} className="flex flex-col justify-between gap-3 rounded-xl bg-black/[0.025] p-4 sm:flex-row sm:items-center"><div><p className="font-semibold">{invitation.displayName}</p><p className="mt-1 max-w-[360px] truncate font-mono text-xs text-black/40" dir="ltr">…{invitation.secureToken.slice(-10)}</p></div><div className="flex flex-wrap gap-2"><a href={`/api/admin/qr?kind=invitation&id=${invitation.id}`} download={`wedding-invitation-${invitation.id}.png`} className="inline-flex min-h-11 items-center rounded-xl border border-black/15 bg-white px-4 text-sm font-semibold">הורדת QR</a><form action={rotateInvitationTokenAction}><input type="hidden" name="id" value={invitation.id} /><SubmitButton danger confirmMessage="להחליף את הקישור האישי? הקישור הקודם יפסיק לעבוד מיד.">החלפת קישור</SubmitButton></form></div></div>)}</div>
      </section>
    </>
  );
}

function QrCard({ title, src, filename }: { title: string; src: string; filename: string }) {
  return <article className="rounded-2xl border border-black/10 bg-white p-5 text-center"><h2 className="font-serif text-2xl">{title}</h2><img src={src} alt={`QR עבור ${title}`} className="mx-auto mt-4 size-48 rounded-xl" /><a href={src} download={filename} className="mt-4 inline-flex min-h-11 items-center rounded-xl bg-[#1d1b18] px-5 text-sm font-semibold text-white">הורדה</a></article>;
}
