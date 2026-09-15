import type { Metadata } from "next";
import { SongRequestForm } from "@/components/wedding/song-request-form";
import { PageShell } from "@/components/wedding/page-shell";
import { isGuestInteractionConfigured } from "@/lib/env";
import { getCurrentInvitation } from "@/lib/guest-data";

export const metadata: Metadata = {
  title: "בקשת שיר | שובל ומיכאל",
  description: "שלחו את השיר שחייב להתנגן בחתונה של שובל ומיכאל.",
};

export default async function SongPage() {
  const invitation = await getCurrentInvitation();
  return (
    <PageShell
      eyebrow="בונים את פס הקול של הערב"
      title="השיר שלכם ברחבה"
      description="יש שיר שפשוט אי אפשר לחגוג בלעדיו? זה הזמן לשלוח לנו אותו."
    >
      <SongRequestForm
        defaultName={invitation?.displayName ?? ""}
        enabled={isGuestInteractionConfigured()}
      />
    </PageShell>
  );
}
