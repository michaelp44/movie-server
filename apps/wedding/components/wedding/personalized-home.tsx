import Image from "next/image";
import heroImage from "@/public/images/hero-editorial.jpg";
import { logoutGuest } from "@/app/actions/guest";
import { Button } from "@/components/ui/button";
import { Countdown } from "@/components/wedding/countdown";
import { GuestbookForm } from "@/components/wedding/guestbook-form";
import { QuickActions } from "@/components/wedding/quick-actions";
import { GuestActivityTracker } from "@/components/wedding/rsvp-activity-tracker";
import { Reveal } from "@/components/wedding/reveal";
import { MobileNav } from "@/components/wedding/mobile-nav";
import { SiteHeader } from "@/components/wedding/site-header";
import { SongRequestForm } from "@/components/wedding/song-request-form";
import { TableCard } from "@/components/wedding/table-card";
import type { InvitationDTO } from "@/lib/types";
import { weddingConfig } from "@/lib/wedding-config";

function rsvpCopy(invitation: InvitationDTO) {
  if (invitation.rsvpStatus === "confirmed") {
    return `אישרתם הגעה עבור ${invitation.numberConfirmed ?? invitation.numberInvited} אורחים`;
  }
  if (invitation.rsvpStatus === "declined") return "עדכנתם שלא תוכלו להגיע — נתגעגע אליכם";
  return "נשמח לדעת אם תגיעו וכמה תהיו";
}

export function PersonalizedHome({ invitation, seatingPublished }: { invitation: InvitationDTO; seatingPublished: boolean }) {
  return (
    <div id="personalized-home" className="min-h-screen bg-[#f6f2e9]">
      <GuestActivityTracker rootId="personalized-home" />
      <SiteHeader />
      <MobileNav />
      <main className="overflow-hidden bg-[#f6f2e9] pb-16 lg:pb-24">
      <section className="relative min-h-[74svh] overflow-hidden">
        <Image src={heroImage} alt="שובל ומיכאל חוגגים יחד במסיבה בחוץ" fill priority quality={88} sizes="100vw" className="object-cover object-[58%_55%] sm:object-[54%_55%]" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-black/25" />
        <div className="relative mx-auto flex min-h-[74svh] max-w-6xl flex-col justify-between px-5 pb-10 pt-7 text-white sm:px-8 sm:pb-14">
          <div className="flex items-center justify-between text-[10px] tracking-[0.23em] text-white/75 sm:text-xs"><span>10 · 12 · 2026</span><span>SHOVAL &amp; MICHAEL</span></div>
          <div>
            <p className="text-sm tracking-[0.18em] text-[#e3c995]">ההזמנה האישית שלכם</p>
            <h1 className="mt-3 max-w-3xl text-4xl font-semibold leading-tight tracking-tight sm:text-6xl">היי {invitation.displayName} ❤️</h1>
            <p className="mt-3 max-w-xl text-lg leading-8 text-white/78">מחכים לחגוג איתכם בחתונה של שובל ומיכאל</p>
            <p className="mt-5 inline-flex rounded-full border border-white/25 bg-white/12 px-4 py-2 text-sm backdrop-blur">{rsvpCopy(invitation)}</p>
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-6xl px-5 sm:px-8">
        <section className="relative z-10 -mt-5 rounded-[2rem] border border-stone-900/8 bg-[#fbf9f4] px-5 py-7 text-center shadow-[0_24px_70px_rgba(38,31,21,.12)] sm:-mt-8 sm:px-8">
          <p className="mb-5 text-xs tracking-[0.2em] text-stone-500">עד שניפגש מתחת לחופה</p>
          <Countdown target={weddingConfig.dateTime} />
        </section>

        <Reveal className="mt-10"><QuickActions /></Reveal>

        <div className="mt-16 grid gap-5 lg:grid-cols-[0.85fr_1.15fr]">
          <Reveal><TableCard tableNumber={invitation.tableNumber} published={seatingPublished} /></Reveal>
          <Reveal>
            <section className="flex h-full min-h-72 flex-col justify-between rounded-[2rem] border border-stone-900/10 bg-[#ece2d2] p-7 sm:p-9">
              <div>
                <p className="text-xs tracking-[0.2em] text-[#8c6937]">הערב שלנו</p>
                <h2 className="mt-3 text-3xl font-semibold">כל הפרטים, בכיס שלכם</h2>
                <p className="mt-4 max-w-xl leading-7 text-stone-600">האתר יישאר מעודכן לפני האירוע, יעזור לכם להגיע ולהתמצא בערב עצמו, וישמור אחר כך את התמונות והברכות.</p>
              </div>
              <p className="font-serif mt-8 text-4xl text-[#9a7642]" dir="ltr">S &amp; M</p>
            </section>
          </Reveal>
        </div>

        <Reveal className="mt-20">
          <div className="mb-7">
            <p className="text-xs tracking-[0.22em] text-[#9b7845]">מילים שנשמור</p>
            <h2 className="mt-3 text-3xl font-semibold sm:text-5xl">השאירו לנו ברכה ❤️</h2>
          </div>
          <GuestbookForm defaultName={invitation.displayName} />
        </Reveal>

        <Reveal className="mt-8"><SongRequestForm defaultName={invitation.displayName} /></Reveal>

        <form action={logoutGuest} className="mt-16 text-center">
          <Button type="submit" variant="ghost" size="sm">זה לא אני</Button>
        </form>
      </div>
      </main>
    </div>
  );
}
