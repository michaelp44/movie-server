import Link from "next/link";
import { ArrowLeft, Sparkles, Table2 } from "lucide-react";

export function TableCard({ tableNumber, published }: { tableNumber: string | null; published: boolean }) {
  return (
    <section className="relative overflow-hidden rounded-[2rem] bg-stone-950 p-7 text-white shadow-[0_28px_80px_rgba(27,23,17,.18)] sm:p-9" aria-labelledby="table-card-title">
      <div className="absolute -left-10 -top-10 size-48 rounded-full border border-[#c7a66e]/20" />
      <div className="absolute -left-2 -top-2 size-28 rounded-full border border-[#c7a66e]/15" />
      <Table2 className="text-[#d4b477]" aria-hidden="true" />
      <p id="table-card-title" className="mt-5 text-sm tracking-[0.16em] text-white/55">השולחן שלכם</p>
      {published && tableNumber ? (
        <>
          <strong className="font-serif mt-1 block text-8xl font-light leading-none text-[#e1c48d]" dir="ltr">{tableNumber}</strong>
          <p className="mt-5 flex items-center gap-2 text-sm text-white/70"><Sparkles size={15} aria-hidden="true" /> נתראה שם — ואחר כך ברחבה</p>
        </>
      ) : published ? (
        <>
          <h2 className="mt-3 text-2xl font-semibold">עוד לא שובצתם לשולחן</h2>
          <p className="mt-3 max-w-md text-sm leading-6 text-white/55">אנחנו עדיין משלימים את הפרטים. השיבוץ יופיע כאן אוטומטית ברגע שיהיה מוכן.</p>
        </>
      ) : (
        <>
          <h2 className="mt-3 text-2xl font-semibold">סידורי ההושבה יופיעו כאן לקראת החתונה ❤️</h2>
          <p className="mt-3 max-w-md text-sm leading-6 text-white/55">אין צורך לחפש שוב — כשההושבה תפורסם, השולחן יופיע כאן אוטומטית.</p>
        </>
      )}
      <Link href="/table" className="mt-7 inline-flex items-center gap-2 text-sm font-semibold text-[#e1c48d] hover:text-white">
        לכל פרטי ההושבה <ArrowLeft size={16} aria-hidden="true" />
      </Link>
    </section>
  );
}
