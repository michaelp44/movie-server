import Link from "next/link";
import { moderateLiveWallAction } from "@/app/actions/admin";
import { PageHeader } from "@/components/admin/page-header";
import { SubmitButton } from "@/components/admin/submit-button";
import { listLiveWallItems } from "@/lib/admin";

const labels = { PENDING: "ממתינה", APPROVED: "מאושרת", NEEDS_REVIEW: "ממתינה לאישור", BLOCKED: "נדחתה" } as const;

export default async function AdminGuestbookPage() {
  const messages = (await listLiveWallItems()).filter((item) => item.message);
  return (
    <>
      <PageHeader title="ברכות" description="כל הברכות, כולל טקסט שצורף לתמונה. אפשר לאשר, להסתיר או למחוק מכאן." />
      <section className="columns-1 gap-5 lg:columns-2">
        {messages.map((message) => (
          <article key={`${message.kind}:${message.id}`} className="mb-4 break-inside-avoid rounded-2xl border border-black/10 bg-white p-4 sm:mb-5 sm:p-6">
            <p className="mb-3 text-sm text-black/55">{labels[message.status]}{message.hiddenAt ? " · מוסתרת" : ""}{message.kind === "photo" ? " · מצורפת לתמונה" : ""}</p>
            <blockquote className="whitespace-pre-wrap break-words font-serif text-xl leading-8">״{message.message}״</blockquote>
            <p className="mt-4 font-semibold">{message.displayName || "אורח"}</p>
            <p className="mt-1 text-xs text-black/45">{new Date(message.createdAt).toLocaleString("he-IL")}</p>
            {message.kind === "photo" ? <Link href="/admin/live-wall" className="mt-3 inline-block text-sm underline">צפייה בתמונה במסך ניהול הלייב</Link> : null}
            <div className="mt-4 grid grid-cols-2 gap-2">
              {[
                { action: "approve", label: "אישור" },
                { action: message.hiddenAt ? "restore" : "hide", label: message.hiddenAt ? "החזרה למסך" : "הסתרה" },
                { action: "block", label: "דחייה" },
                { action: "delete", label: "מחיקה" },
              ].map(({ action, label }) => <form key={action} action={moderateLiveWallAction} className="[&>button]:w-full">
                <input type="hidden" name="id" value={message.id} />
                <input type="hidden" name="kind" value={message.kind} />
                <input type="hidden" name="moderationAction" value={action} />
                <SubmitButton danger={action === "delete"} confirmMessage={action === "delete" ? message.kind === "photo" ? "למחוק לצמיתות את התמונה ואת הברכה המצורפת?" : "למחוק לצמיתות את הברכה?" : undefined}>{label}</SubmitButton>
              </form>)}
            </div>
            {message.kind === "photo" ? <p className="mt-3 text-xs text-black/50">הפעולות חלות על התמונה והברכה יחד.</p> : null}
          </article>
        ))}
      </section>
      {!messages.length ? <p className="rounded-2xl border border-dashed border-black/20 p-10 text-center text-black/50">עדיין לא התקבלו ברכות.</p> : null}
    </>
  );
}
