import type { Metadata } from "next";
import { PageShell } from "@/components/wedding/page-shell";
import { TimelineView } from "@/components/wedding/timeline-view";

export const metadata: Metadata = {
  title: "לו״ז הערב | שובל ומיכאל",
  description: "לוח הזמנים של החתונה — קבלת הפנים, החופה, ארוחת הערב והמסיבה.",
};

export default function SchedulePage() {
  return (
    <PageShell
      eyebrow="שמרו את הרגע"
      title="לו״ז הערב"
      description="כל התחנות החשובות של הערב במקום אחד. בואו קצת לפני החופה — אנחנו לא רוצים שתפספסו אף רגע."
    >
      <TimelineView />
    </PageShell>
  );
}
