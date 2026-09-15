import type { Metadata } from "next";
import { PageShell } from "@/components/wedding/page-shell";
import { StoryView } from "@/components/wedding/story-view";

export const metadata: Metadata = {
  title: "הסיפור שלנו | שובל ומיכאל",
  description: "הדרך של שובל ומיכאל — מהמפגש הראשון ועד ל-10.12.2026.",
};

export default function StoryPage() {
  return (
    <PageShell
      eyebrow="שני אנשים · סיפור אחד"
      title="הסיפור שלנו"
      description="כמה רגעים קטנים וגדולים הפכו בדרך לחיים שאנחנו אוהבים — ועכשיו לפרק הבא, יחד איתכם."
      wide
    >
      <StoryView />
    </PageShell>
  );
}
