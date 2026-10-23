import type { Metadata } from "next";
import Link from "next/link";
import { Camera } from "lucide-react";
import { notFound } from "next/navigation";
import { PageShell } from "@/components/wedding/page-shell";
import { parseTableNumber } from "@/lib/table";

type TableQrPageProps = {
  params: Promise<{ number: string }>;
};

export async function generateMetadata({ params }: TableQrPageProps): Promise<Metadata> {
  const tableNumber = parseTableNumber((await params).number);

  if (!tableNumber) return { title: "שולחן | שובל ומיכאל" };

  return {
    title: `שולחן ${tableNumber} | שובל ומיכאל`,
    description: `העמוד של שולחן ${tableNumber} בחתונה של שובל ומיכאל.`,
    robots: { index: false, follow: false },
  };
}

export default async function TableQrPage({ params }: TableQrPageProps) {
  const tableNumber = parseTableNumber((await params).number);
  if (!tableNumber) notFound();

  const tableActions = [
    { href: `/photos?table=${tableNumber}`, label: "מעלים תמונות", description: "תראו לנו את הערב דרך העיניים שלכם", icon: Camera },
  ] as const;

  return (
    <PageShell
      eyebrow="ברוכים הבאים"
      title={`שולחן ${tableNumber}`}
      description="הגעתם למקום הנכון. מכאן אפשר להעלות רגעים מהערב ולשתף אותם עם כולם."
    >
      <div className="grid gap-4 sm:grid-cols-2">
        {tableActions.map((action) => {
          const Icon = action.icon;
          return (
            <Link
              key={action.href}
              href={action.href}
              className="group rounded-[1.5rem] border border-stone-900/9 bg-white/68 p-5 shadow-[0_14px_45px_rgba(45,37,25,0.05)] transition hover:-translate-y-1 hover:border-[#aa8753]/30 sm:p-6"
            >
              <span className="grid size-11 place-items-center rounded-full bg-[#eee3cf] text-[#89683a] transition group-hover:bg-[#dfcba9]">
                <Icon aria-hidden="true" size={20} strokeWidth={1.6} />
              </span>
              <h2 className="mt-5 text-base font-semibold text-stone-950">{action.label}</h2>
              <p className="mt-2 text-sm leading-6 text-stone-600">{action.description}</p>
            </Link>
          );
        })}
      </div>
      <p className="mt-7 text-center text-xs leading-6 text-stone-500">
        מספר השולחן בלבד נשמר בקישור. פרטי האורחים שלכם אינם מופיעים בו.
      </p>
    </PageShell>
  );
}
