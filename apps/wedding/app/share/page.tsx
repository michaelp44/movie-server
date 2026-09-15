import type { Metadata } from "next";
import { GuestbookForm } from "@/components/wedding/guestbook-form";
import { LiveReactions } from "@/components/wedding/live-reactions";
import { PageShell } from "@/components/wedding/page-shell";
import { PhotoUploader } from "@/components/wedding/photo-uploader";
import { isGuestInteractionConfigured } from "@/lib/env";
import { getCurrentInvitation } from "@/lib/guest-data";

export const metadata: Metadata = { title: "שתפו איתנו | שובל ומיכאל", description: "שתפו תמונה או ברכה למסך החתונה של שובל ומיכאל.", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function SharePage() {
  const invitation = await getCurrentInvitation();
  const enabled = isGuestInteractionConfigured();
  return (
    <PageShell eyebrow="אתם חלק מהסיפור" title="שתפו עם מסך החתונה ❤️" description="צלמו רגע, כתבו לנו כמה מילים, ואחרי בדיקה קצרה הם יופיעו על המסך באולם.">
      <div className="grid gap-6 lg:grid-cols-2"><PhotoUploader enabled={enabled} /><GuestbookForm defaultName={invitation?.displayName ?? ""} enabled={enabled} /></div>
      <div className="mt-6"><LiveReactions enabled={enabled} /></div>
    </PageShell>
  );
}
