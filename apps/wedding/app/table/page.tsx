import type { Metadata } from "next";
import Link from "next/link";
import { Armchair, ArrowLeft, Clock3 } from "lucide-react";
import { PageShell } from "@/components/wedding/page-shell";
import { GuestLoginForm } from "@/components/wedding/guest-login-form";
import { isGuestIdentificationConfigured } from "@/lib/env";
import { getCurrentInvitation, isSeatingPublished } from "@/lib/guest-data";

export const metadata: Metadata = {
  title: "השולחן שלי | שובל ומיכאל",
  description: "מצאו במהירות את השולחן שלכם בחתונה של שובל ומיכאל.",
};

export type TableAssignmentViewModel =
  | { status: "assigned"; tableNumber: string; tableName?: string }
  | { status: "unassigned" }
  | { status: "unidentified" }
  | { status: "unpublished" };

export function TableAssignment({
  assignment,
  guestIdentificationEnabled = true,
}: {
  assignment: TableAssignmentViewModel;
  guestIdentificationEnabled?: boolean;
}) {
  if (assignment.status === "assigned") {
    return (
      <div className="relative overflow-hidden rounded-[2.25rem] border border-[#ac8954]/25 bg-[#eee3cf] px-6 py-12 text-center shadow-[0_25px_80px_rgba(57,44,27,0.1)] sm:px-10 sm:py-16">
        <div aria-hidden="true" className="absolute -right-16 -top-16 size-52 rounded-full border border-[#b18d56]/20" />
        <Armchair aria-hidden="true" className="mx-auto text-[#89683a]" size={30} strokeWidth={1.45} />
        <p className="mt-5 text-sm font-semibold tracking-[0.15em] text-[#76572d]">השולחן שלכם</p>
        <p className="mt-2 font-serif text-8xl font-medium leading-none tracking-[-0.06em] text-stone-950 sm:text-9xl" dir="ltr">
          {assignment.tableNumber}
        </p>
        {assignment.tableName ? <p className="mt-3 text-sm text-stone-600">{assignment.tableName}</p> : null}
        <p className="mx-auto mt-7 max-w-md text-sm leading-7 text-stone-600">
          שמרו צילום מסך, ובכניסה לאולם תוכלו למצוא את המספר בקלות.
        </p>
      </div>
    );
  }

  if (assignment.status === "unassigned") {
    return (
      <div className="rounded-[2.25rem] border border-stone-900/9 bg-white/68 px-6 py-12 text-center shadow-[0_20px_65px_rgba(45,37,25,0.06)] sm:px-10 sm:py-16">
        <Armchair aria-hidden="true" className="mx-auto text-[#9a7643]" size={30} strokeWidth={1.45} />
        <h2 className="mt-5 font-serif text-3xl font-medium">עוד לא שובצתם לשולחן</h2>
        <p className="mx-auto mt-3 max-w-lg text-sm leading-7 text-stone-600 sm:text-base">
          אנחנו עדיין משלימים את הפרטים. השיבוץ יופיע כאן אוטומטית ברגע שיהיה מוכן.
        </p>
      </div>
    );
  }

  if (assignment.status === "unidentified") {
    return (
      <div className="mx-auto max-w-2xl">
        <GuestLoginForm enabled={guestIdentificationEnabled} />
      </div>
    );
  }

  return (
    <div className="rounded-[2.25rem] border border-stone-900/9 bg-white/68 px-6 py-12 text-center shadow-[0_20px_65px_rgba(45,37,25,0.06)] sm:px-10 sm:py-16">
      <span className="mx-auto grid size-14 place-items-center rounded-full bg-[#eee3cf] text-[#89683a]">
        <Clock3 aria-hidden="true" size={24} strokeWidth={1.5} />
      </span>
      <h2 className="mt-5 font-serif text-3xl font-medium sm:text-4xl">עוד קצת סבלנות</h2>
      <p className="mx-auto mt-4 max-w-lg text-sm leading-7 text-stone-600 sm:text-base">
        סידורי ההושבה יופיעו כאן לקראת החתונה. אחרי שיפורסמו, השולחן שלכם יחכה כאן בלי צורך בחיפוש נוסף.
      </p>
      <Link
        href="/"
        className="mt-7 inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-stone-950 px-6 text-sm font-semibold text-white transition hover:bg-[#785b34]"
      >
        חזרה לעמוד הבית
        <ArrowLeft aria-hidden="true" size={17} />
      </Link>
    </div>
  );
}

export const dynamic = "force-dynamic";

export default async function TablePage() {
  const invitation = await getCurrentInvitation();
  let assignment: TableAssignmentViewModel = { status: "unidentified" };

  if (invitation) {
    const published = await isSeatingPublished();
    assignment = !published
      ? { status: "unpublished" }
      : invitation.tableNumber
        ? { status: "assigned", tableNumber: invitation.tableNumber }
        : { status: "unassigned" };
  }

  return (
    <PageShell
      eyebrow="מוצאים את המקום"
      title="איזה שולחן אני?"
      description="כשתכנית ההושבה תהיה מוכנה, המספר שלכם יופיע כאן באופן אישי וברור."
    >
      <TableAssignment
        assignment={assignment}
        guestIdentificationEnabled={isGuestIdentificationConfigured()}
      />
    </PageShell>
  );
}
