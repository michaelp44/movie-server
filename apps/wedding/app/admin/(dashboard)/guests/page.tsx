import { saveInvitationAction } from "@/app/actions/admin";
import { Field, SelectField } from "@/components/admin/form-fields";
import { AdminNotice } from "@/components/admin/notice";
import { PageHeader } from "@/components/admin/page-header";
import { StatusBadge } from "@/components/admin/status-badge";
import { SubmitButton } from "@/components/admin/submit-button";
import { listAdminInvitations } from "@/lib/admin";
import { Download } from "lucide-react";

const statusOptions = [
  ["pending", "ממתינים"],
  ["confirmed", "אישרו"],
  ["declined", "לא מגיעים"],
  ["maybe", "אולי"],
] as const;

export default async function AdminGuestsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; notice?: string }>;
}) {
  const params = await searchParams;
  const invitations = await listAdminInvitations({ search: params.q, status: params.status });
  return (
    <>
      <PageHeader
        title="אורחים והזמנות"
        description="כל הזמנה מייצגת בית, זוג, משפחה או אורח יחיד — ולא בהכרח אדם אחד."
        action={(
          <a href="/api/admin/iplan.xls" download className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-black/15 bg-white px-4 text-sm font-semibold">
            <Download className="size-4" />
            הורדה ל-iPlan
          </a>
        )}
      />
      <AdminNotice>{params.notice}</AdminNotice>
      <aside className="mb-6 rounded-2xl border border-amber-300/50 bg-amber-50 p-4 text-sm leading-6 text-amber-950">
        שדות שמקורם ב-Google Sheets עלולים להידרס בסנכרון הבא. שינויים קבועים ברשימת האורחים יש לבצע בגיליון המקור.
      </aside>
      <form className="mb-6 grid gap-3 rounded-2xl border border-black/10 bg-white p-4 sm:grid-cols-[1fr_190px_auto]" action="/admin/guests">
        <Field label="חיפוש לפי שם או טלפון" name="q" defaultValue={params.q} type="search" />
        <SelectField label="סטטוס" name="status" defaultValue={params.status ?? ""}>
          <option value="">הכול</option>
          {statusOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </SelectField>
        <button type="submit" className="min-h-11 self-end rounded-xl bg-[#1d1b18] px-5 text-sm font-semibold text-white">חיפוש</button>
      </form>

      <details className="mb-8 rounded-2xl border border-black/10 bg-white p-5">
        <summary className="cursor-pointer font-semibold">הוספת הזמנה ידנית</summary>
        <InvitationForm className="mt-5" />
      </details>

      <div className="overflow-hidden rounded-2xl border border-black/10 bg-white">
        <div className="hidden grid-cols-[1.5fr_1fr_100px_100px_100px_80px] gap-4 border-b border-black/10 bg-black/[0.025] px-5 py-3 text-xs font-semibold text-black/55 lg:grid">
          <span>הזמנה</span><span>טלפון</span><span>כמות</span><span>סטטוס</span><span>שולחן</span><span>מקור</span>
        </div>
        {invitations.length ? invitations.map((invitation) => (
          <details key={invitation.id} className="group border-b border-black/10 last:border-0">
            <summary className="grid cursor-pointer gap-2 px-5 py-4 marker:hidden lg:grid-cols-[1.5fr_1fr_100px_100px_100px_80px] lg:items-center lg:gap-4">
              <span className="font-semibold">{invitation.displayName}{invitation.missingFromSource ? <span className="ms-2 text-xs text-red-700">חסר בגיליון</span> : null}</span>
              <span dir="ltr" className="w-fit text-sm tabular-nums text-black/60">
                {invitation.normalizedPhone ?? invitation.primaryPhone ?? "—"}
                {invitation.primaryPhone && !invitation.normalizedPhone ? <small className="ms-2 text-red-700" dir="rtl">דורש תיקון</small> : null}
              </span>
              <span className="text-sm">{invitation.numberConfirmed}/{invitation.numberInvited}</span>
              <span><StatusBadge status={invitation.rsvpStatus} /></span>
              <span className="text-sm">{invitation.tableNumber ?? "—"}</span>
              <span className="text-xs text-black/50">{invitation.sourceRowId ? "Sheets" : "ידני"}</span>
            </summary>
            <div className="border-t border-black/10 bg-[#faf8f3] p-5">
              <InvitationForm invitation={invitation} />
              {invitation.sourceRowId ? <p className="mt-4 text-xs text-black/50">מזהה מקור: <code dir="ltr">{invitation.sourceRowId}</code></p> : null}
            </div>
          </details>
        )) : <p className="p-10 text-center text-black/50">לא נמצאו הזמנות.</p>}
      </div>
    </>
  );
}

function InvitationForm({ invitation, className = "" }: { invitation?: Awaited<ReturnType<typeof listAdminInvitations>>[number]; className?: string }) {
  return (
    <form action={saveInvitationAction} className={`grid gap-4 sm:grid-cols-2 xl:grid-cols-4 ${className}`}>
      {invitation ? <input type="hidden" name="id" value={invitation.id} /> : null}
      <Field label="שם ההזמנה" name="displayName" required defaultValue={invitation?.displayName} />
      <Field label="טלפון (אפשר להשלים בהמשך)" name="phone" dir="ltr" defaultValue={invitation?.primaryPhone ?? invitation?.normalizedPhone ?? ""} />
      <Field label="מספר מוזמנים" name="numberInvited" type="number" min={1} max={30} required defaultValue={invitation?.numberInvited ?? 1} />
      <Field label="מספר מאושרים" name="numberConfirmed" type="number" min={0} required defaultValue={invitation?.numberConfirmed ?? 0} />
      <SelectField label="סטטוס" name="rsvpStatus" defaultValue={invitation?.rsvpStatus ?? "pending"}>
        {statusOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
      </SelectField>
      <Field label="מספר שולחן" name="tableNumber" type="number" min={1} max={999} defaultValue={invitation?.tableNumber ?? ""} />
      <Field label="קבוצה / צד" name="guestGroup" defaultValue={invitation?.guestGroup ?? ""} />
      <div className="self-end"><SubmitButton>{invitation ? "שמירת שינויים" : "הוספת הזמנה"}</SubmitButton></div>
    </form>
  );
}
