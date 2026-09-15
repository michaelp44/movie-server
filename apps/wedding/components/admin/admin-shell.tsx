import {
  BookHeart,
  Camera,
  LayoutDashboard,
  ListMusic,
  LogOut,
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
  { href: "/admin/guestbook", label: "ברכות", icon: BookHeart },
  { href: "/admin/songs", label: "שירים", icon: ListMusic },
  { href: "/admin/qr", label: "QR", icon: QrCode },
  { href: "/admin/settings", label: "הגדרות", icon: Settings },
];

export function AdminShell({ children, email }: { children: ReactNode; email: string }) {
  return (
    <div className="min-h-screen bg-[#f4f1e9] text-[#1d1b18]">
      <header className="border-b border-black/10 bg-[#191815] text-white">
        <div className="mx-auto flex max-w-[1500px] items-center justify-between gap-4 px-4 py-4 sm:px-8">
          <div>
            <Link href="/admin" className="font-serif text-2xl tracking-wide">
              Shoval &amp; Michael
            </Link>
            <p className="mt-0.5 text-xs text-white/55">מרכז ניהול החתונה</p>
          </div>
          <form action={logoutAdminAction}>
            <button
              type="submit"
              className="flex min-h-11 items-center gap-2 rounded-full border border-white/20 px-4 text-sm transition hover:bg-white/10"
              aria-label={`יציאה מהחשבון ${email}`}
            >
              <LogOut className="size-4" aria-hidden="true" />
              <span className="hidden sm:inline">יציאה</span>
            </button>
          </form>
        </div>
      </header>
      <div className="mx-auto grid max-w-[1500px] lg:grid-cols-[220px_1fr]">
        <aside className="border-b border-black/10 bg-white/55 lg:min-h-[calc(100vh-81px)] lg:border-e lg:border-b-0">
          <nav className="flex gap-1 overflow-x-auto p-3 lg:flex-col lg:p-5" aria-label="ניווט ניהול">
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
        <main className="min-w-0 p-4 sm:p-8 lg:p-10">{children}</main>
      </div>
    </div>
  );
}
