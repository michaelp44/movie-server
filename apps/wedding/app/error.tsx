"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => console.error("Wedding page error", error), [error]);
  return (
    <main className="grid min-h-[80svh] place-items-center px-5 text-center">
      <div className="max-w-lg">
        <p className="font-serif text-7xl text-[#a9854f]" dir="ltr">S &amp; M</p>
        <h1 className="mt-6 text-3xl font-semibold">אופס, משהו קטן השתבש</h1>
        <p className="mt-3 leading-7 text-stone-600">גם בערב הכי מתוכנן יש הפתעות. נסו שוב, ואנחנו נחזיר אתכם למסיבה ❤️</p>
        <Button type="button" onClick={reset} className="mt-7">ניסיון נוסף</Button>
      </div>
    </main>
  );
}
