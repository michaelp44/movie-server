import type { Metadata } from "next";
import { ChefHat } from "lucide-react";
import { PageShell } from "@/components/wedding/page-shell";

export const metadata: Metadata = {
  title: "התפריט | שובל ומיכאל",
  description: "פרטי התפריט של החתונה של שובל ומיכאל יתעדכנו כאן כשיהיו מוכנים.",
};

export default function MenuPage() {
  return (
    <PageShell
      eyebrow="התפריט שלנו"
      title="מה אוכלים?"
      description="פרטי התפריט יתעדכנו כאן כשהוא יהיה מוכן."
      wide
    >
      <section className="mx-auto max-w-2xl rounded-[2rem] border border-stone-900/10 bg-white/75 px-6 py-12 text-center shadow-[0_18px_58px_rgba(45,37,25,0.06)] sm:px-10 sm:py-16">
        <span className="mx-auto grid size-14 place-items-center rounded-full bg-[#eee3cf] text-[#89683b]"><ChefHat aria-hidden="true" size={25} /></span>
        <h2 className="mt-5 font-serif text-2xl font-medium sm:text-3xl">התפריט עדיין בהכנה</h2>
        <p className="mt-3 leading-7 text-stone-600">כשהתפריט יהיה מוכן, נעדכן אותו כאן. כדאי לחזור בהמשך.</p>
      </section>
    </PageShell>
  );
}
