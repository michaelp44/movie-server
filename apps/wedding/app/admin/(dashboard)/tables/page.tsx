import { saveTableAction } from "@/app/actions/admin";
import { Field } from "@/components/admin/form-fields";
import { AdminNotice } from "@/components/admin/notice";
import { PageHeader } from "@/components/admin/page-header";
import { SubmitButton } from "@/components/admin/submit-button";
import { getAdminTables } from "@/lib/admin";

export default async function AdminTablesPage({ searchParams }: { searchParams: Promise<{ notice?: string }> }) {
  const [{ tables, unassigned }, params] = await Promise.all([getAdminTables(), searchParams]);
  return (
    <>
      <PageHeader title="סידורי הושבה" description="הכמות המחושבת מעדיפה מספר מאושרים; לפני אישור הגעה היא משתמשת במספר המוזמנים." />
      <AdminNotice>{params.notice}</AdminNotice>
      <form action={saveTableAction} className="mb-8 grid gap-4 rounded-2xl border border-black/10 bg-white p-5 sm:grid-cols-4">
        <Field label="מספר / שם קצר" name="tableNumber" required />
        <Field label="שם תצוגה (לא חובה)" name="name" />
        <Field label="קיבולת" name="capacity" type="number" min={1} />
        <div className="self-end"><SubmitButton>שמירת שולחן</SubmitButton></div>
      </form>
      <section className="grid gap-4 xl:grid-cols-2">
        {tables.map((table) => {
          const overCapacity = table.capacity != null && table.assignedCount > table.capacity;
          return (
            <article key={table.id} className={`rounded-2xl border bg-white p-5 ${overCapacity ? "border-red-400" : "border-black/10"}`}>
              <div className="flex items-start justify-between gap-4">
                <div><p className="text-xs text-black/50">שולחן</p><h2 className="font-serif text-3xl">{table.name || table.tableNumber}</h2></div>
                <div className={`rounded-xl px-3 py-2 text-sm font-semibold ${overCapacity ? "bg-red-100 text-red-800" : "bg-black/5"}`}>
                  {table.assignedCount}{table.capacity != null ? ` / ${table.capacity}` : " אורחים"}
                </div>
              </div>
              <ul className="mt-5 grid gap-2 text-sm">
                {table.invitations.map((invitation) => <li key={invitation.id} className="flex justify-between border-t border-black/5 pt-2"><span>{invitation.displayName}</span><span>{invitation.numberConfirmed || invitation.numberInvited}</span></li>)}
                {!table.invitations.length ? <li className="text-black/45">עדיין אין הזמנות בשולחן.</li> : null}
              </ul>
              {overCapacity ? <p role="alert" className="mt-4 text-sm font-semibold text-red-700">השולחן מעל הקיבולת ב-{table.assignedCount - table.capacity!} אורחים.</p> : null}
            </article>
          );
        })}
      </section>
      <section className="mt-8 rounded-2xl border border-amber-300/50 bg-amber-50 p-5">
        <h2 className="font-serif text-2xl">ללא שולחן ({unassigned.length})</h2>
        <div className="mt-4 flex flex-wrap gap-2">{unassigned.map((item) => <span key={item.id} className="rounded-full bg-white px-3 py-1.5 text-sm">{item.displayName}</span>)}</div>
      </section>
    </>
  );
}
