import {
  BookHeart,
  Camera,
  LayoutDashboard,
  ListMusic,
  LogOut,
  Menu,
  MonitorPlay,
  QrCode,
  Settings,
  Sheet,
  TableProperties,
  Users,
} from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

import { logoutAdminAction } from "@/app/actions/admin-auth";

const links = [
  { href: "/admin", label: "סקירה", icon: LayoutDashboard },
  { href: "/admin/guests", label: "אורחים", icon: Users },
  { href: "/admin/tables", label: "שולחנות", icon: TableProperties },
  { href: "/admin/sync", label: "סנכרון", icon: Sheet },
  { href: "/admin/photos", label: "תמונות", icon: Camera },
  { href: "/admin/live-wall", label: "מסך חי", icon: MonitorPlay },
  { href: "/admin/guestbook", label: "ברכות", icon: BookHeart },
  { href: "/admin/songs", label: "שירים", icon: ListMusic },
  { href: "/admin/qr", label: "QR", icon: QrCode },
  { href: "/admin/settings", label: "הגדרות", icon: Settings },
];

const mobileLinks = links.filter(({ href }) =>
  ["/admin", "/admin/guests", "/admin/photos", "/admin/live-wall"].includes(href),
);

export function AdminShell({ children, email }: { children: ReactNode; email: string }) {
  return (
    <div className="min-h-screen bg-[#f4f1e9] text-[#1d1b18]">
      <header className="sticky top-0 z-40 border-b border-black/10 bg-[#191815] text-white lg:static">
        <div className="mx-auto flex max-w-[1500px] items-center justify-between gap-3 px-4 py-3 sm:px-8 sm:py-4">
          <div>
            <Link href="/admin" className="font-serif text-xl tracking-wide sm:text-2xl">
              Shoval &amp; Michael
            </Link>
            <p className="mt-0.5 text-[11px] text-white/55 sm:text-xs">מרכז ניהול החתונה</p>
          </div>
          <div className="flex items-center gap-2">
            <details className="relative lg:hidden">
              <summary className="grid size-11 cursor-pointer list-none place-items-center rounded-full border border-white/20 [&::-webkit-details-marker]:hidden" aria-label="פתיחת תפריט ניהול">
                <Menu className="size-5" aria-hidden="true" />
              </summary>
              <nav className="absolute end-0 top-[3.25rem] grid w-[min(19rem,calc(100vw-2rem))] grid-cols-2 gap-1 rounded-2xl border border-black/10 bg-white p-2 text-[#1d1b18] shadow-2xl" aria-label="כל מסכי הניהול">
                {links.map(({ href, label, icon: Icon }) => (
                  <Link key={href} href={href} className="flex min-h-12 items-center gap-2 rounded-xl px-3 text-sm font-semibold hover:bg-black/5">
                    <Icon className="size-4 text-[#9a7847]" aria-hidden="true" />{label}
                  </Link>
                ))}
              </nav>
            </details>
            <form action={logoutAdminAction}>
              <button type="submit" className="grid size-11 place-items-center rounded-full border border-white/20 transition hover:bg-white/10" aria-label={`יציאה מהחשבון ${email}`}>
                <LogOut className="size-4" aria-hidden="true" />
              </button>
            </form>
          </div>
        </div>
      </header>
      <div className="mx-auto grid max-w-[1500px] lg:grid-cols-[220px_1fr]">
        <aside className="hidden border-b border-black/10 bg-white/55 lg:block lg:min-h-[calc(100vh-81px)] lg:border-e lg:border-b-0">
          <nav className="flex gap-1 p-3 lg:flex-col lg:p-5" aria-label="ניווט ניהול">
            {links.map(({ href, label, icon: Icon }) => (
              <Link
                key={href}
                href={href}
                className="flex min-h-11 shrink-0 items-center gap-2 rounded-xl px-3 text-sm font-medium transition hover:bg-black/5 focus-visible:bg-black/5"
              >
                <Icon className="size-4 text-[#9a7847]" aria-hidden="true" />
                {label}
              </Link>
            ))}
          </nav>
        </aside>
        <main className="min-w-0 px-4 pb-28 pt-6 sm:p-8 lg:p-10">{children}</main>
      </div>
      <nav className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-4 border-t border-black/10 bg-white/95 pb-[max(.35rem,env(safe-area-inset-bottom))] pt-1 shadow-[0_-8px_30px_rgba(0,0,0,.08)] backdrop-blur lg:hidden" aria-label="ניווט ניהול מהיר">
        {mobileLinks.map(({ href, label, icon: Icon }) => (
          <Link key={href} href={href} className="flex min-h-14 flex-col items-center justify-center gap-1 px-1 text-[11px] font-semibold text-black/65 active:bg-black/5">
            <Icon className="size-5 text-[#9a7847]" aria-hidden="true" />{label}
          </Link>
        ))}
      </nav>
    </div>
  );
}
