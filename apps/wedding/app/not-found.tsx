import Link from "next/link";
import { ArrowRight } from "lucide-react";

export default function NotFound() {
  return (
    <main className="grid min-h-[80svh] place-items-center px-5 text-center">
      <div>
        <p className="font-serif text-8xl text-[#a9854f]">404</p>
        <h1 className="mt-5 text-3xl font-semibold">העמוד הזה כנראה יצא לרקוד</h1>
        <p className="mt-3 text-stone-600">אבל כל פרטי החתונה עדיין מחכים לכם בעמוד הבית.</p>
        <Link href="/" className="mt-7 inline-flex min-h-12 items-center gap-2 rounded-full bg-stone-950 px-6 font-semibold text-white"><ArrowRight size={17} aria-hidden="true" /> חזרה הביתה</Link>
      </div>
    </main>
  );
}
