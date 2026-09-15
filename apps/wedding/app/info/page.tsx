import type { Metadata } from "next";
import { CalendarPlus, Download } from "lucide-react";
import { Directions } from "@/components/wedding/directions";
import { FAQ } from "@/components/wedding/faq";
import { PageShell } from "@/components/wedding/page-shell";
import { SectionHeading } from "@/components/wedding/section-heading";
import { WeatherCard } from "@/components/wedding/weather-card";
import { getGoogleCalendarUrl, weddingConfig } from "@/lib/wedding-config";

export const metadata: Metadata = {
  title: "מידע שימושי | שובל ומיכאל",
  description: "ניווט, חניה, מזג אוויר, שאלות נפוצות והוספה ליומן לקראת החתונה של שובל ומיכאל.",
};

export default function InfoPage() {
  const googleCalendarUrl = getGoogleCalendarUrl();

  return (
    <PageShell
      eyebrow="לפני שיוצאים לדרך"
      title="כל מה שצריך לדעת"
      description="ניווט, חניה, לו״ז ותשובות לשאלות הקטנות — כדי שתגיעו רגועים ותתרכזו בלחגוג."
      wide
    >
      <div className="space-y-14 sm:space-y-20">
        <Directions />

        <section aria-labelledby="calendar-heading">
          <div className="rounded-[2rem] border border-stone-900/9 bg-white/68 p-6 shadow-[0_18px_58px_rgba(45,37,25,0.06)] sm:p-9">
            <div className="grid items-center gap-7 lg:grid-cols-[1fr_auto]">
              <div>
                <p className="text-[10px] font-semibold tracking-[0.22em] text-[#96713e]">לא שוכחים</p>
                <h2 id="calendar-heading" className="mt-2 font-serif text-3xl font-medium tracking-[-0.025em] sm:text-4xl">
                  הוספה ליומן
                </h2>
                <p className="mt-3 max-w-2xl text-sm leading-7 text-stone-600 sm:text-base">
                  יום חמישי, {weddingConfig.displayDate}, ב־5.91 על הים בנתניה. שמרו את התאריך, השעות והמיקום ישירות ביומן.
                </p>
              </div>
              <div className="flex flex-col gap-3 sm:flex-row lg:flex-col xl:flex-row">
                <a
                  href={weddingConfig.calendar.icsPath}
                  download
                  className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-stone-950 px-5 text-sm font-semibold text-white transition hover:bg-[#785b34] active:scale-[0.99]"
                >
                  <Download aria-hidden="true" size={18} />
                  הורדת קובץ ליומן
                </a>
                <a
                  href={googleCalendarUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-stone-900/12 bg-white px-5 text-sm font-semibold text-stone-800 transition hover:border-[#a9854f]/40 hover:text-[#76572d]"
                >
                  <CalendarPlus aria-hidden="true" size={18} />
                  Google Calendar
                </a>
              </div>
            </div>
          </div>
        </section>

        <WeatherCard />

        <section aria-labelledby="faq-heading">
          <SectionHeading
            eyebrow="שאלות ותשובות"
            title="שאלתם, ענינו"
            description="אם משהו עדיין לא ברור, כנראה שאנחנו עוד סוגרים אותו. נשאיר את העמוד מעודכן ככל שנתקרב."
          />
          <div className="mt-7">
            <FAQ />
          </div>
        </section>
      </div>
    </PageShell>
  );
}
