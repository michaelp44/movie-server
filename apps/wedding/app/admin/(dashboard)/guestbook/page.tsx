import { moderateGuestbookAction } from "@/app/actions/admin";
import { PageHeader } from "@/components/admin/page-header";
import { SubmitButton } from "@/components/admin/submit-button";
import { listGuestbookMessages } from "@/lib/admin";

export default async function AdminGuestbookPage() {
  const messages = await listGuestbookMessages();
  return (
    <>
      <PageHeader title="ספר האורחים" description="ברכות אינן מתפרסמות אוטומטית. אפשר לאשר ולהסתיר אותן מכאן." />
      <section className="columns-1 gap-5 lg:columns-2">
        {messages.map((message) => (
          <article key={String(message.id)} className="mb-4 break-inside-avoid rounded-2xl border border-black/10 bg-white p-4 sm:mb-5 sm:p-6">
            <blockquote className="whitespace-pre-wrap font-serif text-xl leading-8">“{String(message.message)}”</blockquote>
            <div className="mt-5 flex flex-col gap-3 border-t border-black/10 pt-4 sm:flex-row sm:items-center sm:justify-between"><div><p className="font-semibold">{String(message.display_name)}</p><p className="text-xs text-black/45">{new Date(String(message.created_at)).toLocaleString("he-IL")}</p></div><form action={moderateGuestbookAction} className="[&>button]:w-full sm:[&>button]:w-auto"><input type="hidden" name="id" value={String(message.id)} /><input type="hidden" name="approved" value={message.approved ? "false" : "true"} /><SubmitButton>{message.approved ? "הסתרה" : "אישור"}</SubmitButton></form></div>
          </article>
        ))}
      </section>
      {!messages.length ? <p className="rounded-2xl border border-dashed border-black/20 p-10 text-center text-black/50">עדיין לא התקבלו ברכות.</p> : null}
    </>
  );
}
