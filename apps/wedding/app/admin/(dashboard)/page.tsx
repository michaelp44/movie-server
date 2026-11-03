import { PageHeader } from "@/components/admin/page-header";
import { getAdminOverview } from "@/lib/admin";

const labels = {
  totalInvitations: "הזמנות",
  totalInvited: "מוזמנים",
  confirmed: "אישרו הגעה",
  declined: "הזמנות שסירבו",
  pending: "ממתינים למענה",
  contactedInvitations: "נשלחה להם הודעה",
  openedInvitations: "פתחו את הקישור",
  tablesAssigned: "הזמנות עם שולחן",
  photos: "קבצי מדיה",
  guestbook: "ברכות",
  songs: "בקשות שירים",
};

export default async function AdminOverviewPage() {
  const overview = await getAdminOverview();
  return (
    <>
      <PageHeader title="ערב טוב" description="תמונת מצב עדכנית של ההזמנות, התוכן וסידורי ההושבה." />
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3" aria-label="נתוני החתונה">
        {Object.entries(labels).map(([key, label]) => (
          <article key={key} className="rounded-3xl border border-black/10 bg-white p-6 shadow-[0_12px_40px_rgba(35,29,20,0.04)]">
            <p className="text-sm text-black/55">{label}</p>
            <p className="mt-3 font-serif text-5xl tabular-nums">{overview[key as keyof typeof overview]}</p>
          </article>
        ))}
      </section>
      <p className="mt-4 text-xs leading-5 text-black/55">שליחות ופתיחות נספרות לפי הזמנות ייחודיות. זוג או משפחה נספרים פעם אחת, גם לאחר הודעות או פתיחות חוזרות.</p>
    </>
  );
}
