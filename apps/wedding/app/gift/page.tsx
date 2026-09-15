import type { Metadata } from "next";
import { GiftSection } from "@/components/wedding/gift-section";
import { PageShell } from "@/components/wedding/page-shell";

export const metadata: Metadata = {
  title: "מתנה לזוג | שובל ומיכאל",
  description: "אפשרות נעימה ופשוטה לשלוח מתנה לשובל ומיכאל לקראת החתונה.",
};

export default function GiftPage() {
  return (
    <PageShell
      eyebrow="הכי חשוב שתבואו"
      title="מתנה באהבה"
      description="בחרנו להשאיר את זה פשוט, אישי ולא מחייב — בדיוק כמו שצריך."
    >
      <GiftSection />
    </PageShell>
  );
}
