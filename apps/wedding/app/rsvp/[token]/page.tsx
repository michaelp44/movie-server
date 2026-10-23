import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { after } from "next/server";

import { findInvitationBySecureToken } from "@/lib/guest-data";
import { RsvpForm } from "@/components/wedding/rsvp-form";
import { RsvpActivityTracker } from "@/components/wedding/rsvp-activity-tracker";
import { parseRsvpDetails } from "@/lib/rsvp/details";
import { recordInvitationActivity } from "@/lib/rsvp/activity";
import { createAdminClient } from "@/lib/supabase/admin";
import { weddingConfig } from "@/lib/wedding-config";

export const metadata: Metadata = {
  title: "אישור הגעה | Shoval & Michael",
  robots: { index: false, follow: false, nocache: true },
};

export default async function RsvpPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ result?: string }>;
}) {
  const token = (await params).token;
  const invitation = await findInvitationBySecureToken(token);
  if (!invitation) notFound();
  const client = createAdminClient({ optional: true });
  const saved = client ? await client.from("invitations").select("rsvp_details, rsvp_note").eq("id", invitation.id).maybeSingle() : null;
  if (saved?.error) console.error("RSVP details lookup failed", saved.error);
  const initialDetails = parseRsvpDetails(saved?.data?.rsvp_details);
  const result = (await searchParams).result;
  if (!result) after(() => recordInvitationActivity({ invitationId: invitation.id, displayName: invitation.displayName, eventType: "rsvp_page_viewed" }));

  return (
    <main id="rsvp-page" className="min-h-screen bg-[#f6f2e9] px-4 py-8 text-[#1d1b18] sm:grid sm:place-items-center sm:py-14">
      <RsvpActivityTracker token={token} />
      <section className="mx-auto w-full max-w-xl overflow-hidden rounded-[2rem] border border-black/10 bg-white shadow-[0_24px_80px_rgba(29,27,24,.12)]">
        <header className="bg-[#1d1b18] px-6 py-8 text-center text-white sm:px-10">
          <p className="font-serif text-4xl tracking-wide sm:text-5xl">Shoval &amp; Michael</p>
          <p className="mt-2 text-sm tracking-[.24em] text-white/65" dir="ltr">{weddingConfig.displayDate}</p>
        </header>
        <div className="p-6 sm:p-10">
          {result === "success" ? (
            <div className="py-8 text-center">
              <p className="text-5xl" aria-hidden="true">🥂</p>
              <h1 className="mt-5 text-3xl font-bold">תודה שעדכנתם אותנו!</h1>
              <p className="mx-auto mt-3 max-w-sm leading-7 text-black/65">התשובה נשמרה. אפשר לחזור ולעדכן אותה כאן בכל שלב.</p>
              <Link href="/" data-track="home_after_rsvp" className="mt-7 inline-flex min-h-12 items-center justify-center rounded-full bg-[#1d1b18] px-7 font-semibold text-white">לכל פרטי החתונה</Link>
            </div>
          ) : (
            <>
              <p className="text-sm font-semibold text-[#9a7847]">ההזמנה של</p>
              <h1 className="mt-1 text-3xl font-bold sm:text-4xl">{invitation.displayName}</h1>
              <p className="mt-3 leading-7 text-black/65">נשמח מאוד לחגוג איתכם. עדכנו אותנו אם תגיעו וכמה מכם יהיו איתנו ❤️</p>
              {invitation.rsvpStatus !== "pending" ? <div className="mt-5 rounded-2xl border border-[#a9854f]/25 bg-[#f5ecdc] p-4"><p className="text-sm font-semibold text-[#75572d]">התשובה הנוכחית שלכם</p><p className="mt-1 text-lg font-bold">{invitation.rsvpStatus === "confirmed" ? `מגיעים · ${invitation.numberConfirmed} ${invitation.numberConfirmed === 1 ? "אורח/ת" : "אורחים"}` : invitation.rsvpStatus === "declined" ? "לא מגיעים" : "עדיין לא בטוחים"}</p><p className="mt-1 text-xs text-black/50">אפשר לעדכן את התשובה בטופס למטה.</p></div> : null}
              {result === "error" ? <p role="alert" className="mt-5 rounded-2xl bg-red-50 p-4 text-sm font-medium text-red-800">לא הצלחנו לשמור את התשובה. בדקו את הפרטים ונסו שוב.</p> : null}
              <RsvpForm token={token} currentlyConfirmed={invitation.rsvpStatus === "confirmed"} confirmedCount={invitation.numberConfirmed} initialNote={saved?.data?.rsvp_note ?? null} initial={initialDetails} />
            </>
          )}
        </div>
      </section>
    </main>
  );
}
