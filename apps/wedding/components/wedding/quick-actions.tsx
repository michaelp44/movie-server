import Link from "next/link";
import { Camera, ChefHat, Gift, MapPinned, MessageCircleCheck, Table2 } from "lucide-react";
import { cn } from "@/lib/utils";

const actions: ReadonlyArray<{
  href: string;
  label: string;
  note: string;
  icon: typeof MapPinned;
}> = [
  { href: "/info#directions", label: "ניווט לאולם", note: "Waze ומפות", icon: MapPinned },
  { href: "/rsvp", label: "אישור הגעה", note: "עדכון ההזמנה", icon: MessageCircleCheck },
  { href: "/table", label: "השולחן שלי", note: "סידורי הושבה", icon: Table2 },
  { href: "/menu", label: "התפריט", note: "מה אוכלים?", icon: ChefHat },
  { href: "/share", label: "שיתוף למסך", note: "תמונה או ברכה", icon: Camera },
  { href: "/gift", label: "מתנה לזוג", note: "באהבה ובטעם", icon: Gift },
];

export function QuickActions() {
  return (
    <nav className="grid grid-cols-2 gap-3 sm:grid-cols-4" aria-label="פעולות מהירות">
      {actions.map((item) => {
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "group flex min-h-36 flex-col justify-between rounded-[1.55rem] border border-stone-900/10 bg-white/65 p-4 transition duration-300 hover:-translate-y-1 hover:shadow-[0_18px_45px_rgba(45,37,25,.1)]",
            )}
          >
            <span className="grid size-10 place-items-center rounded-full bg-stone-900/[0.06] text-stone-800">
              <Icon size={19} aria-hidden="true" />
            </span>
            <span>
              <strong className="block text-base">{item.label}</strong>
              <small className="mt-0.5 block text-xs text-stone-500">{item.note}</small>
            </span>
          </Link>
        );
      })}
    </nav>
  );
}
