import type { Metadata } from "next";
import { PageShell } from "@/components/wedding/page-shell";
import { MenuView } from "@/components/wedding/menu-view";

export const metadata: Metadata = {
  title: "התפריט | שובל ומיכאל",
  description: "המנות שיוגשו בחתונה של שובל ומיכאל באולם 5.91.",
};

export default function MenuPage() {
  return (
    <PageShell
      eyebrow="התפריט שלנו"
      title="מה אוכלים?"
      description="המטבח הפתוח של 5.91 — מטבח שף יצירתי, ים־תיכוני, שמשלב חומרי גלם משובחים וטכניקות בישול חדשניות."
      wide
    >
      <MenuView />
    </PageShell>
  );
}
