import type { Metadata } from "next";
import { MenuView } from "@/components/wedding/menu-view";
import { PageShell } from "@/components/wedding/page-shell";

export const metadata: Metadata = {
  title: "התפריט | שובל ומיכאל",
  description: "כל מה שמחכה לכם בתפריט החתונה של שובל ומיכאל, כולל סימון טבעוני, צמחוני וללא גלוטן.",
};

export default function MenuPage() {
  return (
    <PageShell
      eyebrow="טעמים של ערב אחד"
      title="מה אוכלים?"
      description="תפריט חגיגי שמתחיל בביס הראשון בקבלת הפנים וממשיך עד למתוק האחרון על הרחבה."
      wide
    >
      <MenuView />
    </PageShell>
  );
}
