import type { Metadata } from "next";
import { GuestbookForm } from "@/components/wedding/guestbook-form";
import { PageShell } from "@/components/wedding/page-shell";
import { isGuestInteractionConfigured } from "@/lib/env";
import { getCurrentInvitation } from "@/lib/guest-data";

export const metadata: Metadata = {
  title: "השאירו לנו ברכה | שובל ומיכאל",
  description: "כתבו ברכה אישית לשובל ומיכאל לקראת החתונה.",
};

export default async function GuestbookPage() {
  const invitation = await getCurrentInvitation();
  return (
    <PageShell
      eyebrow="משהו שנשמור לתמיד"
      title="השאירו לנו ברכה ❤️"
      description="מילה טובה, זיכרון משותף או עצה קטנה לדרך — נשמח לקרוא הכול."
    >
      <GuestbookForm
        defaultName={invitation?.displayName ?? ""}
        enabled={isGuestInteractionConfigured()}
      />
    </PageShell>
  );
}
