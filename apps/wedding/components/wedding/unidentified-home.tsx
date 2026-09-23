import Image from "next/image";
import { Navigation } from "lucide-react";
import heroImage from "@/public/images/hero-editorial.jpg";
import { Countdown } from "@/components/wedding/countdown";
import { GuestLoginForm } from "@/components/wedding/guest-login-form";
import { MobileNav } from "@/components/wedding/mobile-nav";
import { SiteHeader } from "@/components/wedding/site-header";
import { weddingConfig } from "@/lib/wedding-config";

export function UnidentifiedHome({ guestIdentificationEnabled }: { guestIdentificationEnabled: boolean }) {
  return (
    <div className="min-h-screen bg-[#f6f2e9]">
      <SiteHeader />
      <MobileNav />
      <main className="overflow-hidden bg-[#f6f2e9] lg:pb-0">
      <section className="mx-auto grid min-h-[100svh] max-w-[1600px] lg:grid-cols-[1.05fr_0.95fr]">
        <div className="relative min-h-[52svh] overflow-hidden bg-[#c9baa2] lg:order-2 lg:min-h-screen">
          <Image src={heroImage} alt="שובל ומיכאל חוגגים יחד במסיבה בחוץ" fill priority quality={88} sizes="(max-width: 1023px) 100vw, 53vw" className="object-cover object-[58%_55%] lg:object-[54%_55%]" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/35 via-transparent to-black/10" />
          <div className="absolute inset-5 rounded-t-[12rem] border border-white/40 sm:inset-8 lg:inset-12" />
        </div>

        <div className="relative flex flex-col justify-between px-5 pb-10 pt-7 sm:px-12 lg:min-h-screen lg:px-16 lg:py-12 xl:px-24">
          <div className="flex items-center justify-between text-[10px] tracking-[0.22em] text-stone-500 sm:text-[11px]">
            <span>10 · 12 · 2026</span>
            <span>SHOVAL &amp; MICHAEL</span>
          </div>
          <div className="mx-auto w-full max-w-xl py-11 text-center lg:py-8">
            <p className="mb-3 text-sm tracking-[0.25em] text-[#9b7845]">מתחתנים ❤️</p>
            <h1 className="font-serif text-[clamp(4.4rem,12vw,8.5rem)] font-light leading-[0.7] tracking-[-0.06em] text-stone-950" dir="ltr">
              Shoval<span className="mx-auto my-5 block text-[0.48em] italic text-[#a9854f]">&amp;</span>Michael
            </h1>
            <div className="mx-auto my-9 h-px w-16 bg-[#b79a68]" />
            <Countdown target={weddingConfig.dateTime} />
            <GuestLoginForm enabled={guestIdentificationEnabled} />
          </div>
          <a href="#more" className="mx-auto inline-flex items-center gap-2 text-sm text-stone-600 transition hover:text-stone-950"><Navigation aria-hidden="true" size={16} /> לכל פרטי האירוע</a>
        </div>
      </section>

      <section id="more" className="mx-auto max-w-4xl px-5 py-20 text-center sm:px-8 sm:py-28">
        <p className="text-xs tracking-[0.22em] text-[#9b7845]">ערב אחד · כל מה שצריך</p>
        <h2 className="mt-4 text-3xl font-semibold tracking-tight sm:text-5xl">האתר שלכם לחתונה שלנו</h2>
        <p className="mx-auto mt-5 max-w-2xl text-base leading-8 text-stone-600">אחרי הזדהות קצרה תוכלו לראות את ההזמנה האישית, השולחן, הניווט, התפריט והלו״ז — ולהעלות אלינו את הרגעים שלכם.</p>
      </section>
      </main>
    </div>
  );
}
